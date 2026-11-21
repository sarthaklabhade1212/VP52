import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Store,
  Coins,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import CameraQRScanner from './CameraQRScanner';

export default function CustomerScanPayModal({ isOpen, onClose, onPaymentSuccess, initialQrCode = '' }) {
  if (!isOpen) return null;

  return (
    <CustomerScanPayModalContent
      key={String(initialQrCode || 'scan-modal')}
      onClose={onClose}
      onPaymentSuccess={onPaymentSuccess}
      initialQrCode={initialQrCode}
    />
  );
}

function CustomerScanPayModalContent({ onClose, onPaymentSuccess, initialQrCode = '' }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const lookupInFlightRef = useRef(false);
  const payInFlightRef = useRef(false);

  const initialTrimmedQr = String(initialQrCode || '').trim();
  const hasInitialQr = Boolean(initialTrimmedQr);

  // Modal Step: 'scan' | 'amount' | 'confirm' | 'success'
  const [step, setStep] = useState('scan');
  const [qrInput, setQrInput] = useState(initialTrimmedQr);
  const [allowAutoScan, setAllowAutoScan] = useState(!hasInitialQr);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(hasInitialQr);

  // Verified Merchant from lookup
  const [merchant, setMerchant] = useState(null);
  const [customerBalance, setCustomerBalance] = useState(0);

  // Payment Inputs
  const [coinAmount, setCoinAmount] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Successful outcome
  const [receipt, setReceipt] = useState(null);
  const [copiedTx, setCopiedTx] = useState(false);

  // Trigger deep-linked / card-initiated merchant lookup cleanly on mount
  useEffect(() => {
    if (hasInitialQr) {
      lookupMerchant(initialTrimmedQr);
    }
  }, []);

  // Dismiss outer dialog cleanly with Escape when native live camera overlay is not active
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !document.documentElement.classList.contains('vp52-scanner-active')) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Step 1: Look up merchant permanent QR
  const lookupMerchant = async (codeToLookup) => {
    const code = (codeToLookup !== undefined ? String(codeToLookup) : qrInput || '').trim();
    if (!code) {
      setErrorMsg('Please enter or scan a merchant QR code.');
      return;
    }
    if (lookupInFlightRef.current) return;
    lookupInFlightRef.current = true;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/customer/merchant-qr/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ qr_code: code })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMerchant(data.merchant);
        setCustomerBalance(data.customer_balance || 0);
        setStep('amount');
        // Preset default amount if available
        if (data.customer_balance >= 100) {
          setCoinAmount('100');
        } else if (data.customer_balance > 0) {
          setCoinAmount(String(data.customer_balance));
        } else {
          setCoinAmount('');
        }
      } else {
        setErrorMsg(data.error || 'Merchant QR code not recognized.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to connect to server.');
    } finally {
      lookupInFlightRef.current = false;
      setLoading(false);
    }
  };

  // Step 2: Validate amount and proceed to confirmation
  const handleProceedToConfirm = (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const num = Number(coinAmount);
    if (!Number.isInteger(num) || num <= 0) {
      setErrorMsg('Please enter a valid positive whole number of coins.');
      return;
    }

    if (num > customerBalance) {
      setErrorMsg(`Amount exceeds your balance of ${customerBalance} coins.`);
      return;
    }

    // Generate unique client idempotency key for this payment flow
    setIdempotencyKey(`IDEMP-TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
    setStep('confirm');
  };

  // Step 3: Execute atomic coin payment
  const handleConfirmPayment = async () => {
    if (payInFlightRef.current) return;
    payInFlightRef.current = true;
    setLoading(true);
    setErrorMsg('');

    const num = parseInt(coinAmount, 10);

    try {
      const res = await fetch('/api/customer/merchant-qr/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          qr_code: merchant.permanent_qr_code,
          coins_amount: num,
          idempotency_key: idempotencyKey
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReceipt(data.transfer);
        setStep('success');

        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (_) {}

        if (onPaymentSuccess) {
          onPaymentSuccess(data.transfer);
        }
      } else {
        setErrorMsg(data.error || 'Payment failed. Please check your coin balance.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error occurred during payment.');
    } finally {
      payInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleCopyReceiptTx = () => {
    if (receipt?.transfer_id) {
      navigator.clipboard.writeText(receipt.transfer_id);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  };

  const parsedCoins = parseInt(coinAmount, 10) || 0;
  const remainingBalance = Math.max(0, customerBalance - parsedCoins);

  const handleBackToScan = () => {
    setErrorMsg('');
    setAllowAutoScan(false);
    setStep('scan');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan and Pay Coins"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div style={{
        background: '#0E0E0E',
        border: '1px solid #D4AF37',
        borderRadius: '24px',
        width: '460px',
        maxWidth: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.95)',
        position: 'relative'
      }}>
        {/* Modal Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
              color: '#050505',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900
            }}>
              <QrCode size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                {step === 'scan' && 'Scan & Pay Coins'}
                {step === 'amount' && 'Enter Coin Amount'}
                {step === 'confirm' && 'Confirm Coin Payment'}
                {step === 'success' && 'Payment Successful'}
              </h3>
              <span style={{ fontSize: '11px', color: '#D4AF37' }}>
                1 VP52 Coin = ₹1 Instant Bill Discount
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label={t('closeBtn')}
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              padding: '12px 14px',
              color: '#ef4444',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 1: SCAN MERCHANT PERMANENT QR                   */}
        {/* ==================================================== */}
        {step === 'scan' && (
          <CameraQRScanner
            variant="embedded"
            title={t('scanMerchantQrTitle')}
            subtitle={t('scanMerchantCounterQrHint')}
            guideText={t('cameraScanGuideMerchant')}
            scanButtonLabel={t('scanMerchantQrBtn')}
            manualLabel={t('orEnterMerchantQrLabel')}
            manualPlaceholder="e.g. VP52-MCH-7B4D1A9F..."
            manualSubmitLabel={t('scannerSubmitCodeBtn')}
            manualValue={qrInput}
            onManualValueChange={setQrInput}
            isSubmitting={loading}
            autoStart={allowAutoScan}
            onScanSuccess={(scannedCode) => {
              setQrInput(scannedCode);
              lookupMerchant(scannedCode);
            }}
            onClose={onClose}
          />
        )}

        {/* ==================================================== */}
        {/* STEP 2: VERIFIED MERCHANT & AMOUNT ENTRY SCREEN      */}
        {/* ==================================================== */}
        {step === 'amount' && merchant && (
          <div>
            {/* Verified Merchant Summary Card */}
            <div style={{
              background: '#141414',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#222',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D4AF37',
                  border: '1px solid rgba(212, 175, 55, 0.2)'
                }}>
                  <Store size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>
                      {merchant.name}
                    </h4>
                    <ShieldCheck size={16} color="#22c55e" title="Verified Merchant" />
                  </div>
                  <div style={{ fontSize: '11px', color: '#A0A0A0', marginTop: '2px' }}>
                    {merchant.category} • {merchant.address || merchant.city || 'Verified Counter'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBackToScan}
                style={{
                  background: '#202020',
                  border: 'none',
                  color: '#888',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Change
              </button>
            </div>

            {/* Available Wallet Balance Badge */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0B0B0B',
              border: '1px solid rgba(212, 175, 55, 0.15)',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Coins size={16} color="#F2D675" />
                <span style={{ fontSize: '12px', color: '#A0A0A0', fontWeight: 600 }}>Available Coins:</span>
              </div>
              <span style={{ fontSize: '14px', color: '#F2D675', fontWeight: 800 }}>
                🪙 {customerBalance.toLocaleString()} Coins (₹{customerBalance.toLocaleString()})
              </span>
            </div>

            {/* Amount Input Form */}
            <form onSubmit={handleProceedToConfirm}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#A0A0A0', marginBottom: '8px' }}>
                  HOW MANY COINS DO YOU WANT TO REDEEM?
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="1"
                    max={customerBalance}
                    step="1"
                    required
                    placeholder="Enter coin amount..."
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#141414',
                      border: '2px solid rgba(212, 175, 55, 0.4)',
                      borderRadius: '14px',
                      padding: '14px 18px',
                      color: '#FFFFFF',
                      fontSize: '22px',
                      fontWeight: 800,
                      outline: 'none',
                      textAlign: 'center',
                      letterSpacing: '1px'
                    }}
                  />
                </div>
              </div>

              {/* Preset Quick-Pick Chips */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
                {[50, 100, 200, 500].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    disabled={customerBalance < preset}
                    onClick={() => setCoinAmount(String(preset))}
                    style={{
                      flex: 1,
                      minWidth: '60px',
                      background: coinAmount === String(preset) ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#181818',
                      color: coinAmount === String(preset) ? '#050505' : customerBalance < preset ? '#444' : '#F2D675',
                      border: '1px solid rgba(212, 175, 55, 0.25)',
                      borderRadius: '10px',
                      padding: '8px 4px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: customerBalance < preset ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🪙 {preset}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={customerBalance <= 0}
                  onClick={() => setCoinAmount(String(customerBalance))}
                  style={{
                    flex: 1,
                    minWidth: '60px',
                    background: coinAmount === String(customerBalance) ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)' : '#181818',
                    color: coinAmount === String(customerBalance) ? '#050505' : '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '10px',
                    padding: '8px 4px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: customerBalance <= 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  MAX
                </button>
              </div>

              {/* Live Conversion Preview Card */}
              <div style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '14px',
                padding: '14px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: '#A0A0A0', textTransform: 'uppercase', fontWeight: 700 }}>
                  Instant Counter Bill Discount
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e', marginTop: '2px' }}>
                  ₹{parsedCoins.toLocaleString()} DISCOUNT
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Remaining balance after payment: <span style={{ color: '#F2D675', fontWeight: 700 }}>{remainingBalance.toLocaleString()} Coins</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleBackToScan}
                  style={{
                    flex: 1,
                    background: '#1A1A1A',
                    color: '#A0A0A0',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={parsedCoins <= 0 || parsedCoins > customerBalance}
                  style={{
                    flex: 2,
                    background: parsedCoins > 0 && parsedCoins <= customerBalance
                      ? 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)'
                      : '#2A2A2A',
                    color: parsedCoins > 0 && parsedCoins <= customerBalance ? '#050505' : '#777',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 900,
                    cursor: parsedCoins > 0 && parsedCoins <= customerBalance ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  Review Payment <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 3: FINAL PAYMENT CONFIRMATION SCREEN            */}
        {/* ==================================================== */}
        {step === 'confirm' && merchant && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(212, 175, 55, 0.15)',
                color: '#F2D675',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                border: '1px solid rgba(212, 175, 55, 0.4)'
              }}>
                <Sparkles size={28} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                Confirm Payment to Merchant
              </h3>
              <p style={{ fontSize: '12px', color: '#A0A0A0', margin: '4px 0 0 0' }}>
                Please verify the shop name and discount amount
              </p>
            </div>

            {/* Confirmation Breakdown Box */}
            <div style={{
              background: '#121212',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '22px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #222' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Merchant:</span>
                <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 800 }}>{merchant.name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #222' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Coins to Send:</span>
                <span style={{ fontSize: '14px', color: '#F2D675', fontWeight: 900 }}>🪙 {parsedCoins} Coins</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #222' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Instant Bill Discount:</span>
                <span style={{ fontSize: '15px', color: '#22c55e', fontWeight: 900 }}>₹{parsedCoins} OFF</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>Balance After Payment:</span>
                <span style={{ fontSize: '13px', color: '#A0A0A0', fontWeight: 700 }}>{remainingBalance} Coins</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep('amount')}
                style={{
                  flex: 1,
                  background: '#1A1A1A',
                  color: '#A0A0A0',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmPayment}
                style={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                  color: '#050505',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Authorizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Pay ₹{parsedCoins} (🪙 {parsedCoins})
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 4: SUCCESS RECEIPT SCREEN                       */}
        {/* ==================================================== */}
        {step === 'success' && receipt && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                border: '2px solid rgba(34, 197, 94, 0.4)'
              }}>
                <CheckCircle2 size={36} />
              </div>

              <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                TRANSACTION COMPLETE
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', margin: '4px 0 0 0' }}>
                ₹{receipt.discount_inr} Saved
              </h2>
              <div style={{ fontSize: '13px', color: '#F2D675', fontWeight: 700, marginTop: '4px' }}>
                🪙 {receipt.coins_amount} VP52 Coins Transferred
              </div>
            </div>

            {/* Official Digital Receipt Card */}
            <div style={{
              background: '#121212',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '16px',
              padding: '18px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #1F1F1F' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Paid To:</span>
                <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 800 }}>{receipt.merchant_name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1F1F1F' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Category:</span>
                <span style={{ fontSize: '12px', color: '#A0A0A0' }}>{receipt.merchant_category || 'Retail'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1F1F1F' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Transaction ID:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#D4AF37', fontFamily: 'monospace', fontWeight: 700 }}>
                    {receipt.transfer_id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReceiptTx}
                    title="Copy Transaction ID"
                    style={{ background: 'none', border: 'none', color: copiedTx ? '#22c55e' : '#888', cursor: 'pointer', padding: '2px', display: 'flex' }}
                  >
                    {copiedTx ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1F1F1F' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Date & Time:</span>
                <span style={{ fontSize: '11px', color: '#A0A0A0' }}>{new Date(receipt.timestamp).toLocaleString('en-IN')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>New Coin Balance:</span>
                <span style={{ fontSize: '13px', color: '#F2D675', fontWeight: 800 }}>{receipt.customer_balance_after} Coins</span>
              </div>
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
                color: '#050505',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '14px',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Done & Return to Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
