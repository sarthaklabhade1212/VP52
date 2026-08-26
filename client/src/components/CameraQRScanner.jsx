import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';

export default function CameraQRScanner({ onScanSuccess, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const activeStreamRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [insecureContext, setInsecureContext] = useState(false);

  // Manual fallback state
  const [manualCode, setManualCode] = useState('');
  const [scannedPayload, setScannedPayload] = useState(null);

  // Safe Browser API Capabilities Check
  const getGetUserMediaFn = () => {
    if (typeof window === 'undefined' || !navigator) return null;
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      return (constraints) => navigator.mediaDevices.getUserMedia(constraints);
    }
    const legacyFn = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (legacyFn) {
      return (constraints) => new Promise((resolve, reject) => legacyFn.call(navigator, constraints, resolve, reject));
    }
    return null;
  };

  const stopCameraStream = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) { console.error('Track stop error:', e); }
      });
      activeStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setStreamActive(false);
  };

  const startCamera = async () => {
    stopCameraStream();
    setCameraError(null);
    setInsecureContext(false);

    // 1. Check Secure Context (HTTPS or localhost)
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const getUserMedia = getGetUserMediaFn();

    if (!isSecure && !getUserMedia) {
      setInsecureContext(true);
      setCameraError('🔒 Camera hardware access requires HTTPS when opened over network IP address. Please connect via HTTPS or localhost.');
      return;
    }

    if (!getUserMedia) {
      setCameraError('⚠️ Camera API is not supported in this browser. Please use a modern browser like Chrome, Safari, or Edge.');
      return;
    }

    // 2. Try facingMode: "environment" (Rear camera)
    try {
      let mediaStream;
      try {
        mediaStream = await getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (firstErr) {
        // Fall back to simple video constraint if facingMode ideal fails
        console.log('Rear camera constraint fallback:', firstErr.message);
        mediaStream = await getUserMedia({ video: true });
      }

      activeStreamRef.current = mediaStream;
      setStreamActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(console.error);
        animationFrameRef.current = requestAnimationFrame(scanFrameLoop);
      }
    } catch (err) {
      console.warn('Camera Error:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('📷 Camera permission was denied. Please allow camera access in your browser/device settings.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('⚠️ Camera is currently in use by another application. Please close other camera apps and tap "Scan Again".');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('📷 No camera device found on this hardware.');
      } else {
        setCameraError(`⚠️ Camera stream unavailable (${err.message || err.name}).`);
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCameraStream();
    };
  }, []);

  const scanFrameLoop = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    }

    animationFrameRef.current = requestAnimationFrame(scanFrameLoop);
  };

  const handleCompleteScan = (payload) => {
    const code = (payload || manualCode).trim();
    if (!code || scannedPayload === code) return;

    setScannedPayload(code);
    stopCameraStream();

    if (navigator.vibrate) {
      try { navigator.vibrate(120); } catch (e) {}
    }

    if (onScanSuccess) {
      onScanSuccess(code);
    }
  };

  const handleClose = () => {
    stopCameraStream();
    if (onClose) onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0f172a', zIndex: 2000,
      display: 'flex', flexDirection: 'column', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Mobile Top Header */}
      <div style={{
        padding: '16px 20px', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Camera size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#ffffff' }}>Scan Customer QR</h3>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Merchant Device Camera Scanner</span>
          </div>
        </div>

        <button
          onClick={handleClose}
          style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#334155', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Camera Viewport & Frame Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Reticle Scanner Target Frame Wireframe */}
        <div style={{
          position: 'absolute', width: '250px', height: '250px', borderRadius: '24px',
          border: '3px solid #10b981', boxShadow: '0 0 0 4000px rgba(15, 23, 42, 0.78)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '22px', height: '22px', borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981' }}></div>
            <div style={{ width: '22px', height: '22px', borderTop: '4px solid #10b981', borderRight: '4px solid #10b981' }}></div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
            Position QR inside the frame
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '22px', height: '22px', borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981' }}></div>
            <div style={{ width: '22px', height: '22px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981' }}></div>
          </div>
        </div>

        {/* Friendly Camera Exception Banner */}
        {cameraError && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px', right: '16px',
            background: insecureContext ? 'rgba(30, 41, 59, 0.96)' : 'rgba(220, 38, 38, 0.95)',
            border: insecureContext ? '1.5px solid #6366f1' : '1.5px solid #fecaca',
            color: '#ffffff', padding: '16px', borderRadius: '18px', fontSize: '13px',
            lineHeight: 1.4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10
          }}>
            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {insecureContext ? <Lock size={18} color="#818cf8" /> : <AlertTriangle size={18} color="#fca5a5" />}
              {insecureContext ? 'HTTPS / Secure Origin Notice' : 'Camera Access Notice'}
            </div>
            {cameraError}
          </div>
        )}
      </div>

      {/* Mobile Footer & Action Buttons */}
      <div style={{
        padding: '20px', background: '#0f172a', borderTop: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        {/* Action Controls: Scan Again & Cancel */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={startCamera}
            className="btn-secondary"
            style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '12px', justifyContent: 'center', background: '#1e293b', color: '#ffffff', border: '1px solid #334155' }}
          >
            <RefreshCw size={16} /> Scan Again
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
            style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '12px', justifyContent: 'center', background: '#334155', color: '#cbd5e1', border: 'none' }}
          >
            Cancel
          </button>
        </div>

        {/* Development Token Entry Fallback */}
        <div style={{ paddingTop: '10px', borderTop: '1px solid #1e293b' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
            MANUAL TOKEN ENTRY FALLBACK
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#ffffff', fontSize: '14px', borderRadius: '12px' }}
              placeholder="Enter Customer QR Token"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button
              type="button"
              onClick={() => handleCompleteScan(manualCode)}
              className="btn-success"
              style={{ padding: '0 18px', fontSize: '13px', borderRadius: '12px', whiteSpace: 'nowrap' }}
            >
              Verify Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
