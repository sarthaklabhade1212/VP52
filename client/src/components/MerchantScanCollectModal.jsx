import React, { useState, useEffect, useRef } from 'react';
import CameraQRScanner from './CameraQRScanner';
import { useI18n } from '../i18n/I18nContext';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../utils/api';
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
  const { t, locale } = useI18n();
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

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success || !data.redemption) {
        setErrorMsg(resolveApiErrorMessage(parsed, t, 'invalidExpiredRedemptionQr'));
      } else {
        setScannedRedemption(data.redemption);
        setStep('confirm');
      }
    } catch (err) {
      setErrorMsg(resolveNetworkErrorMessage(err, t, 'failedScanRedemptionQr'));
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

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success) {
        setErrorMsg(resolveApiErrorMessage(parsed, t, 'failedCollectRedemption'));
      } else {
        setSuccessOutcome(data.outcome);
        setStep('success');
        if (onCollectionSuccess) onCollectionSuccess();
      }
    } catch (err) {
      setErrorMsg(resolveNetworkErrorMessage(err, t, 'collectionFailedError'));
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

  const collectedCoinsCount = Number(successOutcome?.coinsCollected ?? scannedRedemption?.coins_amount ?? 0);
  const formattedCollectedCoins = collectedCoinsCount.toLocaleString(locale);
  const formattedDiscountCoins = Number(successOutcome?.coinsCollected ?? successOutcome?.discountInr ?? scannedRedemption?.coins_amount ?? scannedRedemption?.discount_inr ?? 0).toLocaleString(locale);
  const formattedConfirmCoins = Number(scannedRedemption?.coins_amount || 0).toLocaleString(locale);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('scanAndCollectCoinsTitle')}
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
                {t('scanAndCollectCoinsTitle')}
              </h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
                {t('scanAndCollectCoinsSub')}
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
              manualPlaceholder={t('enterCustomerQrTokenPlaceholder')}
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
                {t('confirmCoinCollectionTitle')}
              </h3>
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700, textTransform: 'uppercase' }}>
                {t('verifiedCustomerQrBadge')}
              </span>
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
                    {t('phoneColonLabel')} {scannedRedemption.customer_phone_masked}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#B8B8B8' }}>{t('coinsToCollectLabel')}</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#F2D675' }}>
                  🪙 {formattedConfirmCoins} {t('coinsUnit')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#B8B8B8' }}>{t('coinDiscountValueLabel')}</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#10B981' }}>
                  {t('coinsDiscountAmount', { coins: formattedConfirmCoins })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#777777' }}>{t('redemptionRefLabel')}</span>
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
              👉 {t('merchantApplyCoinsBillNote', { coins: formattedConfirmCoins })}
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
                {t('backLabel')}
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
                {isProcessing ? t('collectingProgress') : t('confirmAndCollectCoinsBtn', { coins: formattedConfirmCoins })}
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
              {t('collectionSuccessfulUpper')}
            </h3>
            <span style={{ fontSize: '13px', color: '#10B981', fontWeight: 700, display: 'block', marginBottom: '18px' }}>
              {t('coinsAddedToMerchantWallet', { coins: formattedCollectedCoins })}
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
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('coinsCollectedLabel')}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                  +{formattedCollectedCoins} {t('coinsUnit')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('discountGrantedLabel')}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>
                  {t('coinsDiscountAmount', { coins: formattedDiscountCoins })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('newMerchantBalanceLabel')}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF' }}>
                  🪙 {Number(successOutcome?.merchantNewBalance || 0).toLocaleString(locale)} {t('coinsUnit')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#777777' }}>{t('transferIdLabel')}</span>
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
                {t('scanAnotherBtn')}
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
                {t('doneBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
