import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
        setErrorMsg('Redemption QR has expired. Please create a new one.');
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
      setErrorMsg('Please enter a valid coin amount greater than 0.');
      return;
    }
    if (coins > availableBalance) {
      setErrorMsg(`You have ${availableBalance} coins available. Cannot select ${coins} coins.`);
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
        setErrorMsg(data.error || 'Failed to generate redemption QR.');
      } else {
        setActiveRedemption(data.redemption);
        setStep('show_qr');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error occurred.');
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
          <X size={20} />
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
                Redeem VP52 Coins
              </h3>
              <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
                1 Coin = ₹1 Instant Discount at participating merchants
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
                  Available Balance
                </span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#F2D675' }}>
                  🪙 {availableBalance.toLocaleString()} <span style={{ fontSize: '13px', color: '#A0A0A0' }}>Coins</span>
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Max Value</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>₹{availableBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Error Message */}
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

            {/* Preset Amount Pills */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', display: 'block', marginBottom: '8px' }}>
                Quick Amounts
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
                    {val === 'MAX' ? 'Max' : `🪙 ${val}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#D4AF37', display: 'block', marginBottom: '6px' }}>
                Coins to Use
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="1"
                  max={availableBalance}
                  value={coinAmount}
                  onChange={(e) => {
                    setCoinAmount(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Enter coin amount"
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
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Instant Discount</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#10B981' }}>
                  ₹{parsedCoins.toLocaleString()} OFF
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Remaining Coins</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#A0A0A0' }}>
                  {remainingPreview.toLocaleString()} Coins
                </span>
              </div>
            </div>

            {/* Generate QR Button */}
            <button
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
              <QrCode size={18} />
              <span>{isSubmitting ? 'Generating...' : 'Generate Redemption QR'}</span>
            </button>
          </div>
        )}

        {/* STEP 2: SHOW REDEMPTION QR CODE */}
        {step === 'show_qr' && activeRedemption && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>
              Show QR to Merchant
            </h3>
            <p style={{ fontSize: '12px', color: '#B8B8B8', margin: '0 0 16px 0' }}>
              Merchant will scan this QR to apply your ₹{activeRedemption.discount_inr} discount
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
                🪙 {activeRedemption.coins_amount} Coins = ₹{activeRedemption.discount_inr} OFF
              </div>
              <div style={{ fontSize: '11px', color: '#B8B8B8' }}>
                Valid at: <strong style={{ color: '#FFFFFF' }}>{activeRedemption.merchant_name}</strong>
              </div>
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
              <Clock size={16} />
              <span>QR Expires in {formatTimer(remainingSeconds)}</span>
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
              <RefreshCw size={13} className="animate-spin" color="#D4AF37" />
              <span>Waiting for merchant to scan & confirm collection...</span>
            </div>

            {/* Cancel Redemption Button */}
            <button
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
              {isCancelling ? 'Cancelling...' : 'Cancel Request (Keep Coins)'}
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
              <CheckCircle2 size={36} color="#10B981" />
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
              Collection Successful!
            </h3>
            <p style={{ fontSize: '13px', color: '#10B981', fontWeight: 700, margin: '0 0 16px 0' }}>
              ₹{activeRedemption?.discount_inr || parsedCoins} Discount Applied to Your Bill
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
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Coins Redeemed</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F2D675' }}>
                  {activeRedemption?.coins_amount || parsedCoins} Coins
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Discount Received</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>
                  ₹{activeRedemption?.discount_inr || parsedCoins}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#B8B8B8' }}>Merchant</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>
                  {activeRedemption?.merchant_name || 'Participating Merchant'}
                </span>
              </div>
            </div>

            <button
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
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
