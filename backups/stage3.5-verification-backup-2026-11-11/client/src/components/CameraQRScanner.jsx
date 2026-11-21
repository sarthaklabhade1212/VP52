import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  QrCode,
  X,
  RefreshCw,
  AlertTriangle,
  Lock,
  Flashlight,
  Settings,
  ArrowRight,
  ScanLine,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  isNativeScannerEnvironment,
  checkWebQrScannerSupport,
  createWebQrDetector,
  ensureNativeCameraPermission,
  checkNativeCameraPermissionStatus,
  openNativeAppSettings,
  ensureAndroidGmsScannerModule,
  scanWithNativeUi,
  startNativeLiveScanner,
  stopNativeLiveScanner,
  toggleNativeTorch,
  extractBarcodePayload,
  isUserCancellationError,
  isPermissionDeniedError,
} from '../utils/qrScanner';

export default function CameraQRScanner({
  onScanSuccess,
  onClose,
  variant = 'modal', // 'modal' | 'embedded'
  title,
  subtitle,
  guideText,
  scanButtonLabel,
  manualLabel,
  manualPlaceholder,
  manualSubmitLabel,
  showManualInput = true,
  manualValue,
  onManualValueChange,
  isSubmitting = false,
  autoStart = true,
}) {
  const { t } = useI18n();
  const titleId = useId();
  const manualInputId = useId();

  const videoRef = useRef(null);
  const webStreamRef = useRef(null);
  const webLoopRef = useRef(null);
  const nativeLiveStopRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(0);
  const portalCloseBtnRef = useRef(null);
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  const [internalManualCode, setInternalManualCode] = useState('');
  const isControlledManual = manualValue !== undefined;
  const activeManualCode = isControlledManual ? manualValue : internalManualCode;

  const setActiveManualCode = (val) => {
    if (isControlledManual) {
      onManualValueChange?.(val);
    } else {
      setInternalManualCode(val);
    }
  };

  // 'idle' | 'preparing' | 'native_ui' | 'native_live' | 'web_live'
  // | 'permission_denied' | 'permission_rationale' | 'unsupported' | 'cancelled' | 'error'
  const [scannerStatus, setScannerStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [moduleProgress, setModuleProgress] = useState(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [webStream, setWebStream] = useState(null);

  const resolvedTitle = title || t('scanCustomerVoucherTitle');
  const resolvedSubtitle = subtitle || t('merchantDeviceScannerSubtitle');
  const resolvedGuide = guideText || t('cameraScanGuide');
  const resolvedScanBtn = scanButtonLabel || t('scanQrBtn');
  const resolvedManualLabel = manualLabel || t('manualCodeEntry');
  const resolvedManualPlaceholder = manualPlaceholder || t('enterQrCodePlaceholder');
  const resolvedSubmitLabel = manualSubmitLabel || t('scannerSubmitCodeBtn');

  const isNative = isNativeScannerEnvironment();

  const stopWebScanner = () => {
    if (webLoopRef.current) {
      clearTimeout(webLoopRef.current);
      webLoopRef.current = null;
    }
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      webStreamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // Ignore cleanup errors
      }
    }
    setWebStream(null);
  };

  const stopAllScanners = async ({ invalidateSession = true } = {}) => {
    if (invalidateSession) {
      sessionIdRef.current += 1;
    }
    stopWebScanner();

    if (nativeLiveStopRef.current) {
      const stopHandle = nativeLiveStopRef.current;
      nativeLiveStopRef.current = null;
      try {
        await stopHandle();
      } catch {
        // Ignore stop errors
      }
    } else if (isNative) {
      await stopNativeLiveScanner();
    }

    if (mountedRef.current) {
      setTorchEnabled(false);
      setTorchAvailable(false);
      setModuleProgress(null);
    }
  };

  const deliverScanPayload = async (rawPayload, sessionId) => {
    if (sessionId !== undefined && sessionId !== sessionIdRef.current) return;
    const payload = typeof rawPayload === 'string' ? rawPayload.trim() : '';
    if (!payload || isSubmittingRef.current) return;

    await stopAllScanners({ invalidateSession: true });
    if (!mountedRef.current) return;

    try {
      navigator.vibrate?.(120);
    } catch {
      // Vibration optional
    }

    setScannerStatus('idle');
    setStatusMessage('');

    onScanSuccess?.(payload);
  };

  const startWebBarcodeScanner = async (sessionId) => {
    const support = await checkWebQrScannerSupport();
    if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

    if (!support.supported) {
      setScannerStatus('unsupported');
      setStatusMessage(
        support.reason === 'insecure_origin'
          ? t('scannerHttpsRequired')
          : t('scannerUnsupportedBrowserDesc')
      );
      return;
    }

    let mediaStream = null;
    try {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (!mountedRef.current || sessionId !== sessionIdRef.current) {
        mediaStream.getTracks().forEach((tr) => tr.stop());
        return;
      }

      webStreamRef.current = mediaStream;
      setWebStream(mediaStream);
      setScannerStatus('web_live');
      setStatusMessage('');

      const detector = createWebQrDetector();
      if (!detector) {
        stopWebScanner();
        setScannerStatus('unsupported');
        setStatusMessage(t('scannerUnsupportedBrowserDesc'));
        return;
      }

      const pollDetect = async () => {
        if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

        const videoEl = videoRef.current;
        if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          try {
            const found = await detector.detect(videoEl);
            const payload = extractBarcodePayload(found);
            if (payload) {
              await deliverScanPayload(payload, sessionId);
              return;
            }
          } catch {
            // Transient frame detection errors are safe to ignore
          }
        }

        if (mountedRef.current && sessionId === sessionIdRef.current) {
          webLoopRef.current = setTimeout(pollDetect, 180);
        }
      };

      webLoopRef.current = setTimeout(pollDetect, 250);
    } catch (err) {
      if (mediaStream) {
        mediaStream.getTracks().forEach((tr) => tr.stop());
      }
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

      if (isPermissionDeniedError(err)) {
        setScannerStatus('permission_denied');
        setStatusMessage(t('browserCameraDenied'));
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setScannerStatus('unsupported');
        setStatusMessage(t('scannerNoCameraDesc'));
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setScannerStatus('error');
        setStatusMessage(t('cameraBusyError'));
      } else {
        setScannerStatus('error');
        setStatusMessage(err?.message || t('cameraAccessError'));
      }
    }
  };

  const startNativeLiveFallback = async (sessionId) => {
    if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

    setScannerStatus('native_live');
    setStatusMessage('');

    try {
      const handle = await startNativeLiveScanner({
        onBarcode: (payload) => {
          deliverScanPayload(payload, sessionId);
        },
        onError: (msg) => {
          if (mountedRef.current && sessionId === sessionIdRef.current) {
            setStatusMessage(msg);
          }
        },
      });

      if (!mountedRef.current || sessionId !== sessionIdRef.current) {
        await handle.stop();
        return;
      }

      nativeLiveStopRef.current = handle.stop;
      setTorchAvailable(Boolean(handle.torchAvailable));
    } catch (err) {
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

      if (isPermissionDeniedError(err)) {
        setScannerStatus('permission_denied');
        setStatusMessage(t('cameraPermissionDeniedDesc'));
      } else {
        setScannerStatus('error');
        setStatusMessage(err?.message || t('deviceCameraStartError'));
      }
    }
  };

  const startScanSession = async () => {
    if (isSubmitting) return;

    await stopAllScanners({ invalidateSession: true });
    const sessionId = sessionIdRef.current;

    if (!isNative) {
      setScannerStatus('preparing');
      setStatusMessage(t('preparingScanner'));
      await startWebBarcodeScanner(sessionId);
      return;
    }

    setScannerStatus('preparing');
    setStatusMessage(t('preparingScanner'));
    setModuleProgress(null);

    try {
      const perm = await ensureNativeCameraPermission();
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

      if (!perm.supported) {
        setScannerStatus('unsupported');
        setStatusMessage(t('scannerNoCameraDesc'));
        return;
      }

      if (!perm.granted) {
        if (perm.state === 'denied') {
          setScannerStatus('permission_denied');
          setStatusMessage(t('cameraPermissionDeniedDesc'));
        } else {
          setScannerStatus('permission_rationale');
          setStatusMessage(t('cameraPermissionRationaleDesc'));
        }
        return;
      }

      const modResult = await ensureAndroidGmsScannerModule({
        onProgress: (ev) => {
          if (mountedRef.current && sessionId === sessionIdRef.current && typeof ev?.progress === 'number') {
            setModuleProgress(ev.progress);
          }
        },
        shouldCancel: () => !mountedRef.current || sessionId !== sessionIdRef.current,
      });

      if (!mountedRef.current || sessionId !== sessionIdRef.current) return;
      setModuleProgress(null);

      if (modResult.ready) {
        setScannerStatus('native_ui');
        try {
          const scanResult = await scanWithNativeUi();
          if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

          if (scanResult.cancelled) {
            setScannerStatus('cancelled');
            setStatusMessage(t('scannerCancelledNotice'));
          } else {
            await deliverScanPayload(scanResult.payload, sessionId);
          }
          return;
        } catch (scanErr) {
          if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

          if (isUserCancellationError(scanErr)) {
            setScannerStatus('cancelled');
            setStatusMessage(t('scannerCancelledNotice'));
            return;
          }

          // Play Services Code Scanner unavailable or failed -> fall back to bundled CameraX ML Kit scanner
          await startNativeLiveFallback(sessionId);
          return;
        }
      }

      // Module unavailable/offline -> bundled CameraX ML Kit live scanner works offline
      await startNativeLiveFallback(sessionId);
    } catch (err) {
      if (!mountedRef.current || sessionId !== sessionIdRef.current) return;
      setModuleProgress(null);

      if (isPermissionDeniedError(err)) {
        setScannerStatus('permission_denied');
        setStatusMessage(t('cameraPermissionDeniedDesc'));
      } else {
        await startNativeLiveFallback(sessionId);
      }
    }
  };

  const handleStopOrCancelScan = async () => {
    await stopAllScanners({ invalidateSession: true });
    if (mountedRef.current) {
      setScannerStatus('cancelled');
      setStatusMessage(t('scannerCancelledNotice'));
    }
  };

  const handleOpenSettings = async () => {
    try {
      await openNativeAppSettings();
    } catch {
      // Ignore if unavailable
    }
  };

  const handleToggleTorch = async () => {
    try {
      const enabled = await toggleNativeTorch();
      if (mountedRef.current) {
        setTorchEnabled(enabled);
      }
    } catch {
      // Torch toggle not available
    }
  };

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const trimmed = String(activeManualCode || '').trim();
    if (!trimmed || isSubmitting) return;
    deliverScanPayload(trimmed);
  };

  const handleCloseComponent = async () => {
    await stopAllScanners({ invalidateSession: true });
    onClose?.();
  };

  // Mount & React StrictMode-safe autoStart + guaranteed unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    let startTimer = null;

    if (autoStart) {
      startTimer = setTimeout(() => {
        if (mountedRef.current) {
          startScanSession();
        }
      }, 60);
    }

    return () => {
      mountedRef.current = false;
      if (startTimer) {
        clearTimeout(startTimer);
      }
      stopAllScanners({ invalidateSession: true });
    };
  }, []);

  // Attach MediaStream to <video> cleanly when web_live renders
  useEffect(() => {
    if (scannerStatus === 'web_live' && webStream && videoRef.current) {
      videoRef.current.srcObject = webStream;
      videoRef.current.play().catch(() => {});
    }
  }, [scannerStatus, webStream]);

  // Escape & hardware back button support during live Portal or modal mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (scannerStatus === 'native_live' || scannerStatus === 'web_live') {
          e.stopImmediatePropagation?.();
          handleStopOrCancelScan();
        } else if (variant === 'modal') {
          e.stopImmediatePropagation?.();
          handleCloseComponent();
        }
      }
    };

    const onHardwareBack = (e) => {
      if (scannerStatus === 'native_live') {
        e?.preventDefault?.();
        handleStopOrCancelScan();
      } else if (variant === 'modal') {
        e?.preventDefault?.();
        handleCloseComponent();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('backbutton', onHardwareBack);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('backbutton', onHardwareBack);
    };
  }, [scannerStatus, variant]);

  // Move keyboard focus into native live scanner portal on activation
  useEffect(() => {
    if (scannerStatus === 'native_live') {
      portalCloseBtnRef.current?.focus?.();
    }
  }, [scannerStatus]);

  // Re-check native camera permission silently if user returns from App Settings
  useEffect(() => {
    if (!isNative || (scannerStatus !== 'permission_denied' && scannerStatus !== 'permission_rationale')) {
      return;
    }

    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const permState = await checkNativeCameraPermissionStatus();
      if ((permState === 'granted' || permState === 'limited') && mountedRef.current) {
        setScannerStatus('idle');
        setStatusMessage('');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isNative, scannerStatus]);

  const isBusyScanning =
    scannerStatus === 'preparing' ||
    scannerStatus === 'native_ui' ||
    scannerStatus === 'native_live' ||
    scannerStatus === 'web_live';

  // Fullscreen CameraX Native Live Portal Overlay (visible while #root is hidden behind transparent WebView)
  const nativeLivePortal =
    scannerStatus === 'native_live' && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="vp52-scanner-portal"
            role="dialog"
            aria-modal="true"
            aria-label={resolvedTitle}
          >
            {/* Top Bar */}
            <div
              style={{
                padding: '18px 20px',
                background: 'linear-gradient(180deg, rgba(5,5,5,0.88) 0%, rgba(5,5,5,0.35) 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                  {resolvedTitle}
                </h3>
                <span style={{ fontSize: '12px', color: '#F2D675' }}>
                  {t('scannerLiveHint')}
                </span>
              </div>

              <button
                ref={portalCloseBtnRef}
                type="button"
                aria-label={t('stopScanBtn')}
                onClick={handleStopOrCancelScan}
                style={{
                  minWidth: '42px',
                  minHeight: '42px',
                  borderRadius: '50%',
                  background: 'rgba(17, 17, 17, 0.85)',
                  border: '1px solid rgba(212, 175, 55, 0.5)',
                  color: '#F2D675',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Transparent Center Viewfinder Frame */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '250px',
                  height: '250px',
                  borderRadius: '24px',
                  border: '2px solid rgba(212, 175, 55, 0.85)',
                  boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.55)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  padding: '14px',
                }}
              >
                <div style={{ position: 'absolute', top: '-3px', left: '-3px', width: '28px', height: '28px', borderTop: '4px solid #F2D675', borderLeft: '4px solid #F2D675', borderRadius: '10px 0 0 0' }} />
                <div style={{ position: 'absolute', top: '-3px', right: '-3px', width: '28px', height: '28px', borderTop: '4px solid #F2D675', borderRight: '4px solid #F2D675', borderRadius: '0 10px 0 0' }} />
                <div style={{ position: 'absolute', bottom: '-3px', left: '-3px', width: '28px', height: '28px', borderBottom: '4px solid #F2D675', borderLeft: '4px solid #F2D675', borderRadius: '0 0 0 10px' }} />
                <div style={{ position: 'absolute', bottom: '-3px', right: '-3px', width: '28px', height: '28px', borderBottom: '4px solid #F2D675', borderRight: '4px solid #F2D675', borderRadius: '0 0 10px 0' }} />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    background: 'rgba(5, 5, 5, 0.72)',
                    padding: '4px 10px',
                    borderRadius: '99px',
                  }}
                >
                  {t('qrCodeBadge')}
                </span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div
              style={{
                padding: '20px',
                background: 'linear-gradient(0deg, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.45) 100%)',
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              {torchAvailable && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  aria-pressed={torchEnabled}
                  style={{
                    minHeight: '44px',
                    padding: '10px 18px',
                    borderRadius: '12px',
                    background: torchEnabled ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#151515',
                    color: torchEnabled ? '#050505' : '#F2D675',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    fontWeight: 800,
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Flashlight size={16} aria-hidden="true" />
                  <span>{torchEnabled ? t('scannerTorchOn') : t('scannerTorchOff')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStopOrCancelScan}
                style={{
                  minHeight: '44px',
                  padding: '10px 22px',
                  borderRadius: '12px',
                  background: '#151515',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('stopScanBtn')}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  const scannerBody = (
    <div className="vp52-scanner-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Live Web Camera Viewfinder (Rendered ONLY when BarcodeDetector supports qr_code) */}
      {scannerStatus === 'web_live' ? (
        <div
          style={{
            position: 'relative',
            borderRadius: '18px',
            overflow: 'hidden',
            background: '#000000',
            border: '2px solid rgba(212, 175, 55, 0.5)',
            minHeight: '260px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              width: '190px',
              height: '190px',
              borderRadius: '18px',
              border: '2px solid #D4AF37',
              boxShadow: '0 0 0 2000px rgba(5, 5, 5, 0.5)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '10px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#F2D675', textShadow: '0 1px 4px #000' }}>
              {t('scannerLiveHint')}
            </span>
          </div>
        </div>
      ) : (
        /* Shared Dark-Gold Scanner Status / Launch Panel */
        <div
          style={{
            background: '#070707',
            border: '2px dashed rgba(212, 175, 55, 0.38)',
            borderRadius: '18px',
            padding: '22px 16px',
            textAlign: 'center',
          }}
        >
          {/* Reticle / Status Icon */}
          <div
            style={{
              width: '150px',
              height: '150px',
              margin: '0 auto 14px',
              border: '2px solid rgba(212, 175, 55, 0.65)',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              background: 'rgba(212, 175, 55, 0.04)',
              padding: '12px',
            }}
          >
            <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '18px', height: '18px', borderTop: '4px solid #F2D675', borderLeft: '4px solid #F2D675', borderRadius: '4px 0 0 0' }} />
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '18px', height: '18px', borderTop: '4px solid #F2D675', borderRight: '4px solid #F2D675', borderRadius: '0 4px 0 0' }} />
            <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '18px', height: '18px', borderBottom: '4px solid #F2D675', borderLeft: '4px solid #F2D675', borderRadius: '0 0 0 4px' }} />
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px', borderBottom: '4px solid #F2D675', borderRight: '4px solid #F2D675', borderRadius: '0 0 4px 0' }} />

            {scannerStatus === 'preparing' || scannerStatus === 'native_ui' ? (
              <>
                <RefreshCw size={36} color="#F2D675" className="spin" style={{ marginBottom: '10px' }} aria-hidden="true" />
                <span style={{ fontSize: '12px', color: '#F2D675', fontWeight: 700 }}>
                  {moduleProgress !== null
                    ? `${t('scannerModuleInstalling')} (${moduleProgress}%)`
                    : t('preparingScanner')}
                </span>
              </>
            ) : scannerStatus === 'permission_denied' || scannerStatus === 'permission_rationale' ? (
              <>
                <Lock size={34} color="#F2D675" style={{ marginBottom: '8px' }} aria-hidden="true" />
                <span style={{ fontSize: '12px', color: '#F2D675', fontWeight: 800 }}>
                  {t('cameraPermissionDeniedTitle')}
                </span>
              </>
            ) : scannerStatus === 'unsupported' || scannerStatus === 'error' ? (
              <>
                <AlertTriangle size={34} color="#F2D675" style={{ marginBottom: '8px' }} aria-hidden="true" />
                <span style={{ fontSize: '12px', color: '#F2D675', fontWeight: 800 }}>
                  {t('scannerNoCameraTitle')}
                </span>
              </>
            ) : (
              <>
                <Camera size={38} color="#D4AF37" style={{ marginBottom: '8px' }} aria-hidden="true" />
                <span style={{ fontSize: '11px', color: '#F2D675', fontWeight: 700, lineHeight: 1.35 }}>
                  {resolvedGuide}
                </span>
              </>
            )}
          </div>

          {/* Dynamic Status / Error Explanation */}
          {statusMessage ? (
            <div
              role={scannerStatus === 'error' || scannerStatus === 'permission_denied' ? 'alert' : 'status'}
              aria-live="polite"
              style={{
                background: '#141414',
                border: '1px solid rgba(212, 175, 55, 0.28)',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '12px',
                color: scannerStatus === 'cancelled' ? '#D4AF37' : '#E5E5E5',
                lineHeight: 1.45,
                marginBottom: '12px',
                textAlign: 'left',
              }}
            >
              {statusMessage}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              {resolvedSubtitle}
            </p>
          )}

          {/* Primary Camera Action Row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {isBusyScanning ? (
              <button
                type="button"
                onClick={handleStopOrCancelScan}
                style={{
                  minHeight: '42px',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  background: '#151515',
                  border: '1px solid rgba(212, 175, 55, 0.35)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('stopScanBtn')}
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={startScanSession}
                style={{
                  minHeight: '44px',
                  flex: 1,
                  minWidth: '170px',
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  color: '#050505',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '11px 16px',
                  fontWeight: 800,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                <ScanLine size={16} aria-hidden="true" />
                <span>
                  {scannerStatus === 'idle' ? resolvedScanBtn : t('scanAgainBtn')}
                </span>
              </button>
            )}

            {isNative && (scannerStatus === 'permission_denied' || scannerStatus === 'permission_rationale') && (
              <button
                type="button"
                onClick={handleOpenSettings}
                style={{
                  minHeight: '44px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: '#161616',
                  border: '1px solid rgba(212, 175, 55, 0.45)',
                  color: '#F2D675',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Settings size={15} aria-hidden="true" />
                <span>{t('openSettingsBtn')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Web Live Controls */}
      {scannerStatus === 'web_live' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={startScanSession}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px 12px', fontSize: '13px', borderRadius: '12px', justifyContent: 'center' }}
          >
            <RefreshCw size={15} color="#D4AF37" aria-hidden="true" /> {t('scanAgainBtn')}
          </button>
          <button
            type="button"
            onClick={handleStopOrCancelScan}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '13px',
              borderRadius: '12px',
              background: '#151515',
              color: '#D4D4D4',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {t('stopScanBtn')}
          </button>
        </div>
      )}

      {/* Clean Manual QR Entry Fallback (always available, no fake lockouts) */}
      {showManualInput && (
        <form onSubmit={handleManualSubmit}>
          <div>
            <label
              htmlFor={manualInputId}
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#B8B8B8',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {resolvedManualLabel}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id={manualInputId}
                type="text"
                required
                placeholder={resolvedManualPlaceholder}
                value={activeManualCode}
                onChange={(e) => setActiveManualCode(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: '#141414',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting || !String(activeManualCode || '').trim()}
                aria-label={resolvedSubmitLabel}
                style={{
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  border: 'none',
                  color: '#050505',
                  padding: '0 16px',
                  minHeight: '42px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: isSubmitting || !String(activeManualCode || '').trim() ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSubmitting ? (
                  <RefreshCw size={15} className="spin" aria-hidden="true" />
                ) : (
                  <>
                    <span>{resolvedSubmitLabel}</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  if (variant === 'embedded') {
    return (
      <>
        {scannerBody}
        {nativeLivePortal}
      </>
    );
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.92)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          color: '#FFFFFF',
          fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            background: '#0B0B0B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(212, 175, 55, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#050505',
              }}
            >
              <QrCode size={22} color="#050505" aria-hidden="true" />
            </div>
            <div>
              <h3 id={titleId} style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                {resolvedTitle}
              </h3>
              <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{resolvedSubtitle}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseComponent}
            aria-label={t('closeBtn')}
            style={{
              minWidth: '40px',
              minHeight: '40px',
              borderRadius: '50%',
              background: '#151515',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              color: '#D4AF37',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={20} color="#D4AF37" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Scanner Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: '440px' }}>
            {scannerBody}
          </div>
        </div>
      </div>

      {nativeLivePortal}
    </>
  );
}
