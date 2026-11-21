import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../i18n/I18nContext';
import {
  X,
  Coins,
  QrCode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function CustomerCoinRedemptionModal({
  isOpen,
  onClose,
  token,
  availableBalance = 0,
  onRedemptionCompleted
}) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState('select_amount'); // 'select_amount' | 'show_qr' | 'success'
  const [coinAmount, setCoinAmount] = useState('100');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRedemption, setActiveRedemption] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(900); // 15 mins default
  const [isCancelling, setIsCancelling] = useState(false);

  // Check if user already has an active pending redemption QR on open
  useEffect(() => {
    if (!isOpen || !token) return;

    fetch('/api/customer/redemption/active', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.has_active && data.redemption) {
          setActiveRedemption(data.redemption);
          setStep('show_qr');
        } else {
          setStep('select_amount');
        }
      })
      .catch(console.error);
  }, [isOpen, token]);

  // Countdown timer & auto-polling for merchant scan completion
  useEffect(() => {
    if (step !== 'show_qr' || !activeRedemption) return;

    const expiryTime = new Date(activeRedemption.expires_at).getTime();

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        clearInterval(timerInterval);
        setErrorMsg(t('redemptionQrExpiredError'));
        setStep('select_amount');
      }
    }, 1000);

    // Poll server every 3s to detect when merchant scans and confirms collection
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/customer/redemption/active', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          if (!data.has_active) {
            // Check if it was completed by fetching latest history
            const histRes = await fetch('/api/customer/redemptions/history', {
              headers: { Authorization: `Bearer ${token}` }
            });
            const histData = await histRes.json();
            if (histData.success && histData.redemptions && histData.redemptions.length > 0) {
              const latest = histData.redemptions[0];
              if (latest.redemption_id === activeRedemption.redemption_id && latest.status === 'completed') {
                clearInterval(pollInterval);
                setStep('success');
                if (onRedemptionCompleted) onRedemptionCompleted();
              }
            }
          }
        }
      } catch (err) {
        console.debug('Polling check skipped:', err);
      }
    }, 3000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [step, activeRedemption, token, onRedemptionCompleted]);

  if (!isOpen) return null;

  const handlePresetClick = (amount) => {
    if (amount === 'MAX') {
      setCoinAmount(String(availableBalance));
    } else {
      setCoinAmount(String(Math.min(availableBalance, amount)));
    }
    setErrorMsg(null);
  };

  const handleGenerateQR = async () => {
    const coins = parseInt(coinAmount, 10);
    if (isNaN(coins) || coins <= 0) {
      setErrorMsg(t('invalidCoinPositive'));
      return;
    }
    if (coins > availableBalance) {
      setErrorMsg(t('insufficientCoinsSelected', { available: availableBalance, requested: coins }));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/customer/redemption/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ coins_amount: coins })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || t('failedGenerateRedemptionQr'));
      } else {
        setActiveRedemption(data.redemption);
        setStep('show_qr');
      }
    } catch (err) {
      setErrorMsg(err.message || t('networkErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRedemption = async () => {
    if (!activeRedemption) return;
    setIsCancelling(true);

    try {
      await fetch('/api/customer/redemption/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ redemption_id: activeRedemption.redemption_id })
      });

      setActiveRedemption(null);
      setStep('select_amount');
    } catch (err) {
      console.error('Cancel redemption error:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const parsedCoins = parseInt(coinAmount, 10) || 0;
  const remainingPreview = Math.max(0, availableBalance - parsedCoins);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('redeemCoinsModalTitle')}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
          maxWidth: '440px',
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

        {/* STEP 1: SELECT COIN AMOUNT */}
        {step === 'select_amount' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}
              >
                <Coins size={26} color="#F2D675" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>
                {t('redeemCoinsModalTitle')}
              </h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
                {t('redeemCoinsModalSub')}
              </p>
            </div>

            {/* Available Balance Box */}
            <div
              style={{
                background: '#151515',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '16px',
                padding: '14px 18px',
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('availableBalanceUpper')}
                </span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#F2D675' }}>
                  🪙 {availableBalance.toLocaleString(locale)} <span style={{ fontSize: '13px', color: '#A0A0A0' }}>{t('coinsUnit')}</span>
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('coinDiscountValueLabel')}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#10B981' }}>
                  {t('coinsDiscountAmount', { coins: parsedCoins.toLocaleString(locale) })}
                </span>
              </div>
            </div>

            {/* Error Message */}
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

            {/* Preset Amount Pills */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', display: 'block', marginBottom: '8px' }}>
                {t('quickAmountsLabel')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {[50, 100, 200, 500, 'MAX'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handlePresetClick(val)}
                    style={{
                      background: coinAmount === String(val === 'MAX' ? availableBalance : val)
                        ? 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)'
                        : '#151515',
                      color: coinAmount === String(val === 'MAX' ? availableBalance : val) ? '#050505' : '#FFFFFF',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '10px',
                      padding: '8px 2px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {val === 'MAX' ? t('maxUpper') : `🪙 ${val}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div style={{ marginBottom: '18px' }}>
              <label htmlFor="vp52-redeem-coin-input" style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', display: 'block', marginBottom: '6px' }}>
                {t('coinsToUseLabel')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="vp52-redeem-coin-input"
                  type="number"
                  min="1"
                  max={availableBalance}
                  value={coinAmount}
                  onChange={(e) => {
                    setCoinAmount(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={t('enterCoinAmountPlaceholder')}
                  style={{
                    width: '100%',
                    background: '#151515',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Live Discount & Remaining Preview */}
            <div
              style={{
                background: '#111111',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '20px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('coinDiscountValueLabel')}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#10B981' }}>
                  {t('coinsDiscountAmount', { coins: parsedCoins.toLocaleString(locale) })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('remainingCoinsLabel')}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>
                  {remainingPreview.toLocaleString(locale)} {t('coinsUnit')}
                </span>
              </div>
            </div>

            {/* Generate QR Button */}
            <button
              type="button"
              onClick={handleGenerateQR}
              disabled={isSubmitting || parsedCoins <= 0 || parsedCoins > availableBalance}
              style={{
                width: '100%',
                background: parsedCoins > 0 && parsedCoins <= availableBalance
                  ? 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)'
                  : '#333333',
                color: parsedCoins > 0 && parsedCoins <= availableBalance ? '#050505' : '#888888',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: parsedCoins > 0 && parsedCoins <= availableBalance ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <QrCode size={18} aria-hidden="true" />
              <span>{isSubmitting ? t('generatingProgress') : t('generateRedemptionQrBtn')}</span>
            </button>
          </div>
        )}

        {/* STEP 2: SHOW REDEMPTION QR CODE */}
        {step === 'show_qr' && activeRedemption && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>
              {t('showQrToMerchantTitle')}
            </h3>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '0 0 16px 0' }}>
              {t('merchantScanQrCoinsDesc', { coins: (activeRedemption.coins_amount || activeRedemption.discount_inr || 0).toLocaleString(locale) })}
            </p>

            {/* QR Code Container */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: '20px',
                display: 'inline-block',
                margin: '0 auto 16px auto',
                boxShadow: '0 8px 30px rgba(212, 175, 55, 0.3)'
              }}
            >
              <QRCodeSVG
                value={activeRedemption.secure_token}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Amount & Discount Pill */}
            <div
              style={{
                background: '#151515',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '14px',
                padding: '12px 16px',
                marginBottom: '16px'
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#F2D675', marginBottom: '2px' }}>
                🪙 {t('coinsDiscountAmount', { coins: (activeRedemption.coins_amount || activeRedemption.discount_inr || 0).toLocaleString(locale) })}
              </div>
              {activeRedemption.merchant_name && (
                <div style={{ fontSize: '11px', color: '#B8B8B8' }}>
                  {t('validAtLabel')} <strong style={{ color: '#FFFFFF' }}>{activeRedemption.merchant_name}</strong>
                </div>
              )}
            </div>

            {/* Expiry Countdown & Live Polling Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '18px',
                fontSize: '12px',
                color: remainingSeconds < 120 ? '#EF4444' : '#F2D675',
                fontWeight: 700
              }}
            >
              <Clock size={16} aria-hidden="true" />
              <span>{t('qrExpiresIn', { time: formatTimer(remainingSeconds) })}</span>
            </div>

            <div
              style={{
                background: 'rgba(212, 175, 55, 0.1)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '11px',
                color: '#B8B8B8',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} className="animate-spin" color="#D4AF37" aria-hidden="true" />
              <span>{t('waitingMerchantConfirm')}</span>
            </div>

            {/* Cancel Redemption Button */}
            <button
              type="button"
              onClick={handleCancelRedemption}
              disabled={isCancelling}
              style={{
                background: '#151515',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              {isCancelling ? t('cancellingProgress') : t('cancelKeepCoinsBtn')}
            </button>
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
              <CheckCircle2 size={36} color="#10B981" aria-hidden="true" />
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
              {t('collectionSuccessfulTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: '#10B981', fontWeight: 700, margin: '0 0 16px 0' }}>
              {t('coinsDiscountAppliedToBill', { coins: (activeRedemption?.coins_amount || activeRedemption?.discount_inr || parsedCoins).toLocaleString(locale) })}
            </p>

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
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('coinsRedeemedLabel')}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                  {(activeRedemption?.coins_amount || parsedCoins).toLocaleString(locale)} {t('coinsUnit')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('discountAppliedLabel')}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>
                  {t('coinsDiscountAmount', { coins: (activeRedemption?.coins_amount || activeRedemption?.discount_inr || parsedCoins).toLocaleString(locale) })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{t('merchantLabel')}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
                  {activeRedemption?.merchant_name || t('participatingMerchantFallback')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #F2D675 0%, #D4AF37 100%)',
                color: '#050505',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {t('doneBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
