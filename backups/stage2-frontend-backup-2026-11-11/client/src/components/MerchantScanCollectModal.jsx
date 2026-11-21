import React, { useState, useEffect, useRef } from 'react';
import CameraQRScanner from './CameraQRScanner';
import { useI18n } from '../i18n/I18nContext';
import {
  X,
  QrCode,
  CheckCircle2,
  Coins,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Store,
  User
} from 'lucide-react';

export default function MerchantScanCollectModal({
  isOpen,
  onClose,
  token,
  onCollectionSuccess
}) {
  if (!isOpen) return null;

  return (
    <MerchantScanCollectModalContent
      onClose={onClose}
      token={token}
      onCollectionSuccess={onCollectionSuccess}
    />
  );
}

function MerchantScanCollectModalContent({
  onClose,
  token,
  onCollectionSuccess
}) {
  const { t } = useI18n();
  const lookupInFlightRef = useRef(false);
  const confirmInFlightRef = useRef(false);

  const [step, setStep] = useState('scan'); // 'scan' | 'confirm' | 'success'
  const [scannedRedemption, setScannedRedemption] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successOutcome, setSuccessOutcome] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !document.documentElement.classList.contains('vp52-scanner-active')) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleQRScanned = async (qrPayload) => {
    if (!qrPayload || lookupInFlightRef.current) return;
    lookupInFlightRef.current = true;
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const payloadStr = String(qrPayload).trim();

      const res = await fetch('/api/shop/redemption/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ secure_token: payloadStr })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.redemption) {
        setErrorMsg(data.error || 'Invalid or expired redemption QR code.');
      } else {
        setScannedRedemption(data.redemption);
        setStep('confirm');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to scan redemption QR.');
    } finally {
      lookupInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleConfirmCollection = async () => {
    if (!scannedRedemption || confirmInFlightRef.current) return;
    confirmInFlightRef.current = true;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/shop/redemption/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ secure_token: scannedRedemption.secure_token })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to collect redemption.');
      } else {
        setSuccessOutcome(data.outcome);
        setStep('success');
        if (onCollectionSuccess) onCollectionSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Collection failed.');
    } finally {
      confirmInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleResetForNext = () => {
    lookupInFlightRef.current = false;
    confirmInFlightRef.current = false;
    setStep('scan');
    setScannedRedemption(null);
    setSuccessOutcome(null);
    setErrorMsg(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan and Collect Coins"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#0D0D0D',
          border: '1px solid #D4AF37',
          borderRadius: '24px',
          padding: '24px',
          width: '100%',
          maxWidth: '460px',
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          aria-label={t('closeBtn')}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer',
            padding: '6px'
          }}
        >
          <X size={20} aria-hidden="true" />
        </button>

        {/* STEP 1: SCAN CUSTOMER QR */}
        {step === 'scan' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px', paddingRight: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>
                Scan & Collect Coins
              </h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
                Scan customer's redemption QR code to collect coins and apply discount
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <CameraQRScanner
              variant="embedded"
              title={t('scanCustomerVoucherTitle')}
              subtitle={t('scanCustomerVoucherSubtitle')}
              guideText={t('cameraScanGuide')}
              scanButtonLabel={t('scanQrBtn')}
              manualLabel={t('manualCodeEntry')}
              manualPlaceholder="Enter Customer QR Token"
              manualSubmitLabel={t('verifyVoucherBtn')}
              isSubmitting={isProcessing}
              onScanSuccess={handleQRScanned}
              onClose={onClose}
            />
          </div>
        )}

        {/* STEP 2: CONFIRM COLLECTION */}
        {step === 'confirm' && scannedRedemption && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}
              >
                <Coins size={28} color="#F2D675" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>
                Confirm Coin Collection
              </h3>
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>
                ✅ Verified Customer QR
              </span>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Transaction Details Box */}
            <div
              style={{
                background: '#151515',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '18px',
                padding: '18px',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#222222',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <User size={18} color="#F2D675" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>
                    {scannedRedemption.customer_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#A0A0A0' }}>
                    Phone: {scannedRedemption.customer_phone_masked}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#B8B8B8' }}>Coins to Collect</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675' }}>
                  🪙 {scannedRedemption.coins_amount} Coins
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#B8B8B8' }}>Discount on Bill</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#10B981' }}>
                  ₹{scannedRedemption.discount_inr} OFF
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#777777' }}>Redemption Ref</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#A0A0A0' }}>
                  {scannedRedemption.redemption_id}
                </span>
              </div>
            </div>

            {/* Merchant Instruction Banner */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '20px',
                fontSize: '12px',
                color: '#10B981',
                lineHeight: 1.4
              }}
            >
              👉 Deduct <strong>₹{scannedRedemption.discount_inr}</strong> from the customer's total purchase bill. You will receive <strong>{scannedRedemption.coins_amount} VP52 Coins</strong> in your Merchant Wallet.
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <button
                type="button"
                onClick={handleResetForNext}
                disabled={isProcessing}
                style={{
                  background: '#151515',
                  color: '#FFFFFF',
                  border: '1px solid #333333',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCollection}
                disabled={isProcessing}
                style={{
                  background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
                  color: '#050505',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {isProcessing ? 'Collecting...' : `Confirm & Collect ${scannedRedemption.coins_amount} Coins`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '2px solid #10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <CheckCircle2 size={36} color="#10B981" />
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: '0 0 4px 0' }}>
              COLLECTION SUCCESSFUL
            </h3>
            <span style={{ fontSize: '13px', color: '#10B981', fontWeight: 700, display: 'block', marginBottom: '18px' }}>
              +{successOutcome?.coinsCollected || scannedRedemption?.coins_amount} Coins Added to Merchant Wallet
            </span>

            {/* Outcome Receipt Box */}
            <div
              style={{
                background: '#151515',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Coins Collected</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                  +{successOutcome?.coinsCollected || scannedRedemption?.coins_amount} Coins
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Discount Granted</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>
                  ₹{successOutcome?.discountInr || scannedRedemption?.discount_inr} OFF
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>New Merchant Balance</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                  🪙 {successOutcome?.merchantNewBalance} Coins
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#777777' }}>Transfer ID</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#A0A0A0' }}>
                  {successOutcome?.transferId}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={handleResetForNext}
                style={{
                  background: '#151515',
                  color: '#F2D675',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Scan Another
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
                  color: '#050505',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
