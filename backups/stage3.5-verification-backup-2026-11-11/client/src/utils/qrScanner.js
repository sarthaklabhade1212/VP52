import { Capacitor } from '@capacitor/core';
import {
  BarcodeScanner,
  BarcodeFormat,
  LensFacing,
  GoogleBarcodeScannerModuleInstallState,
} from '@capacitor-mlkit/barcode-scanning';

const MODULE_INSTALL_TIMEOUT_MS = 15000;

export function isNativeScannerEnvironment() {
  try {
    return typeof Capacitor !== 'undefined' && Boolean(Capacitor.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function getNativePlatform() {
  try {
    return Capacitor.getPlatform?.() || 'web';
  } catch {
    return 'web';
  }
}

/**
 * Extracts a trimmed verbatim QR payload from plugin or BarcodeDetector output.
 * Preserves exact casing, colons, hyphens, URLs, or JSON content.
 */
export function extractBarcodePayload(barcodesOrSingle) {
  const list = Array.isArray(barcodesOrSingle) ? barcodesOrSingle : [barcodesOrSingle];
  for (const item of list) {
    if (!item) continue;
    const raw = typeof item.rawValue === 'string' ? item.rawValue : '';
    const display = typeof item.displayValue === 'string' ? item.displayValue : '';
    const candidate = (raw || display).trim();
    if (candidate.length > 0) {
      return candidate;
    }
  }
  return '';
}

export function isUserCancellationError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('cancel') ||
    err?.name === 'AbortError'
  );
}

export function isPermissionDeniedError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const name = String(err?.name || '').toLowerCase();
  return (
    name === 'notallowederror' ||
    name === 'permissiondeniederror' ||
    msg.includes('permission') ||
    msg.includes('denied access to camera')
  );
}

/**
 * Checks whether browser live QR scanning is genuinely supported
 * (secure origin + getUserMedia + native BarcodeDetector supporting qr_code).
 */
export async function checkWebQrScannerSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'no_browser_env' };
  }

  const isSecure =
    Boolean(window.isSecureContext) ||
    window.location?.hostname === 'localhost' ||
    window.location?.hostname === '127.0.0.1';

  if (!isSecure) {
    return { supported: false, reason: 'insecure_origin' };
  }

  const hasGetUserMedia = Boolean(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
  );
  if (!hasGetUserMedia) {
    return { supported: false, reason: 'no_media_devices' };
  }

  const Detector = window.BarcodeDetector;
  if (typeof Detector !== 'function') {
    return { supported: false, reason: 'no_barcode_detector' };
  }

  try {
    if (typeof Detector.getSupportedFormats === 'function') {
      const formats = await Detector.getSupportedFormats();
      if (!Array.isArray(formats) || !formats.includes('qr_code')) {
        return { supported: false, reason: 'qr_not_supported' };
      }
    } else {
      new Detector({ formats: ['qr_code'] });
    }
    return { supported: true, reason: null };
  } catch {
    return { supported: false, reason: 'detector_init_failed' };
  }
}

export function createWebQrDetector() {
  if (typeof window === 'undefined' || typeof window.BarcodeDetector !== 'function') {
    return null;
  }
  return new window.BarcodeDetector({ formats: ['qr_code'] });
}

/**
 * Native camera hardware & permission guard. Call ONLY from an explicit user gesture.
 */
export async function ensureNativeCameraPermission() {
  if (!isNativeScannerEnvironment()) {
    return { granted: true, state: 'granted', supported: true };
  }

  let supported = true;
  try {
    const res = await BarcodeScanner.isSupported();
    supported = Boolean(res?.supported);
  } catch {
    supported = true;
  }

  if (!supported) {
    return { granted: false, state: 'unsupported', supported: false };
  }

  let perm = await BarcodeScanner.checkPermissions();
  let state = perm?.camera || 'prompt';

  if (state === 'granted' || state === 'limited') {
    return { granted: true, state, supported: true };
  }

  if (state === 'denied') {
    return { granted: false, state: 'denied', supported: true };
  }

  // 'prompt' or 'prompt-with-rationale'
  perm = await BarcodeScanner.requestPermissions();
  state = perm?.camera || 'denied';

  return {
    granted: state === 'granted' || state === 'limited',
    state,
    supported: true,
  };
}

export async function checkNativeCameraPermissionStatus() {
  if (!isNativeScannerEnvironment()) return 'granted';
  try {
    const perm = await BarcodeScanner.checkPermissions();
    return perm?.camera || 'prompt';
  } catch {
    return 'prompt';
  }
}

export async function openNativeAppSettings() {
  if (!isNativeScannerEnvironment()) return false;
  await BarcodeScanner.openSettings();
  return true;
}

/**
 * Ensures Android Google Barcode Scanner UI module is installed and ready.
 * Awaits async install completion via googleBarcodeScannerModuleInstallProgress.
 */
export async function ensureAndroidGmsScannerModule({
  onProgress,
  shouldCancel,
  timeoutMs = MODULE_INSTALL_TIMEOUT_MS,
} = {}) {
  if (!isNativeScannerEnvironment() || getNativePlatform() !== 'android') {
    return { ready: true, reason: null };
  }

  const initial = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (initial?.available) {
    return { ready: true, reason: null };
  }

  let settled = false;
  let listenerHandle = null;
  let timerId = null;

  const cleanup = async () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (listenerHandle) {
      const handle = listenerHandle;
      listenerHandle = null;
      try {
        await handle.remove();
      } catch {
        // Ignore cleanup listener errors
      }
    }
  };

  return new Promise(async (resolve) => {
    const finish = async (result) => {
      if (settled) return;
      settled = true;
      await cleanup();
      resolve(result);
    };

    try {
      listenerHandle = await BarcodeScanner.addListener(
        'googleBarcodeScannerModuleInstallProgress',
        async (event) => {
          if (settled || shouldCancel?.()) {
            await finish({ ready: false, reason: 'cancelled' });
            return;
          }

          onProgress?.(event);

          if (event?.state === GoogleBarcodeScannerModuleInstallState.COMPLETED) {
            try {
              const after = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
              await finish({ ready: Boolean(after?.available), reason: after?.available ? null : 'unavailable' });
            } catch {
              await finish({ ready: true, reason: null });
            }
          } else if (
            event?.state === GoogleBarcodeScannerModuleInstallState.FAILED ||
            event?.state === GoogleBarcodeScannerModuleInstallState.CANCELED
          ) {
            await finish({ ready: false, reason: 'install_failed' });
          }
        }
      );

      timerId = setTimeout(async () => {
        try {
          const check = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          await finish({ ready: Boolean(check?.available), reason: check?.available ? null : 'timeout' });
        } catch {
          await finish({ ready: false, reason: 'timeout' });
        }
      }, timeoutMs);

      await BarcodeScanner.installGoogleBarcodeScannerModule();

      if (shouldCancel?.()) {
        await finish({ ready: false, reason: 'cancelled' });
        return;
      }

      const postStart = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (postStart?.available) {
        await finish({ ready: true, reason: null });
      }
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('already installed')) {
        try {
          const recheck = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          await finish({ ready: Boolean(recheck?.available), reason: recheck?.available ? null : 'unavailable' });
          return;
        } catch {
          await finish({ ready: true, reason: null });
          return;
        }
      }
      await finish({ ready: false, reason: err?.message || 'install_error' });
    }
  });
}

/**
 * Primary native Google Code Scanner UI (QR_CODE only, with autoZoom).
 */
export async function scanWithNativeUi() {
  const result = await BarcodeScanner.scan({
    formats: [BarcodeFormat.QrCode],
    autoZoom: true,
  });

  const payload = extractBarcodePayload(result?.barcodes);
  if (!payload) {
    return { cancelled: true, payload: '' };
  }
  return { cancelled: false, payload };
}

export function setLiveScannerDomActive(active) {
  if (typeof document === 'undefined') return;
  const htmlEl = document.documentElement;
  const bodyEl = document.body;
  const rootEl = document.getElementById('root');

  if (active) {
    htmlEl?.classList.add('vp52-scanner-active');
    bodyEl?.classList.add('vp52-scanner-active');
    if (rootEl && 'inert' in rootEl) {
      rootEl.inert = true;
    }
  } else {
    htmlEl?.classList.remove('vp52-scanner-active');
    bodyEl?.classList.remove('vp52-scanner-active');
    if (rootEl && 'inert' in rootEl) {
      rootEl.inert = false;
    }
  }
}

export async function stopNativeLiveScanner() {
  setLiveScannerDomActive(false);
  if (!isNativeScannerEnvironment()) return;
  try {
    await BarcodeScanner.disableTorch();
  } catch {
    // Torch may not be active/available
  }
  try {
    await BarcodeScanner.stopScan();
  } catch {
    // No active session
  }
}

/**
 * Fallback embedded CameraX + bundled ML Kit QR scanner when GMS Code Scanner UI
 * cannot be used (e.g. offline first run, Play Services missing/outdated).
 */
export async function startNativeLiveScanner({ onBarcode, onError }) {
  let active = true;
  let delivered = false;
  let scannedListener = null;
  let errorListener = null;

  const stop = async () => {
    if (!active) return;
    active = false;
    const listeners = [scannedListener, errorListener].filter(Boolean);
    scannedListener = null;
    errorListener = null;
    await Promise.allSettled(listeners.map((l) => l.remove()));
    await stopNativeLiveScanner();
  };

  try {
    setLiveScannerDomActive(true);

    scannedListener = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
      if (!active || delivered) return;
      const payload = extractBarcodePayload(event?.barcodes);
      if (!payload) return;

      delivered = true;
      await stop();
      onBarcode?.(payload);
    });

    errorListener = await BarcodeScanner.addListener('scanError', (event) => {
      if (!active) return;
      if (event?.message) {
        onError?.(event.message);
      }
    });

    await BarcodeScanner.startScan({
      formats: [BarcodeFormat.QrCode],
      lensFacing: LensFacing.Back,
    });

    if (!active) {
      await stopNativeLiveScanner();
      return { started: false, torchAvailable: false, stop };
    }

    let torchAvailable = false;
    try {
      const torchRes = await BarcodeScanner.isTorchAvailable();
      torchAvailable = Boolean(torchRes?.available);
    } catch {
      torchAvailable = false;
    }

    return { started: true, torchAvailable, stop };
  } catch (err) {
    await stop();
    throw err;
  }
}

export async function toggleNativeTorch() {
  if (!isNativeScannerEnvironment()) return false;
  await BarcodeScanner.toggleTorch();
  try {
    const res = await BarcodeScanner.isTorchEnabled();
    return Boolean(res?.enabled);
  } catch {
    return false;
  }
}
