import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import CameraQRScanner from '../../components/CameraQRScanner';
import {
  QrCode,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export default function ShopDashboard() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Real Camera Scanner Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedCustomer, setScannedCustomer] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanningCode, setScanningCode] = useState(false);

  const fetchDashboard = () => {
    fetch('/api/shop/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(d => {
        if (d.success) setData(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const handleScanCustomerPayload = async (qrPayload) => {
    setIsCameraOpen(false);
    setScanError(null);
    setScannedCustomer(null);
    setScanningCode(true);

    try {
      const res = await fetch('/api/shop/scan-customer-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ qr_payload: qrPayload })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success || !resData.customer) {
        setScanError(resData.error || 'Failed to scan customer QR token.');
      } else {
        setScannedCustomer(resData.customer);
      }
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanningCode(false);
    }
  };

  const handleProceedToBilling = () => {
    if (scannedCustomer) {
      navigate('/shop/billing', { state: { customer: scannedCustomer } });
    }
  };

  if (loading || !data) {
    return <div style={{ padding: '40px', color: '#B8B8B8', textAlign: 'center' }}>Loading merchant dashboard...</div>;
  }

  const { shop, stats, recentRedemptions } = data;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#050505' }}>
      {/* Top Header & Store ID Badge */}
      <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.25)', marginBottom: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 10px', borderRadius: '6px' }}>
          VERIFIED MERCHANT STORE
        </span>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginTop: '6px', marginBottom: '2px' }}>
          {shop.name}
        </h1>
        <p style={{ fontSize: '12px', color: '#B8B8B8', margin: 0 }}>
          {shop.address} • {shop.category}
        </p>
      </div>

      {/* PROMINENT MOBILE CTA: SCAN CUSTOMER QR */}
      <button
        onClick={() => setIsCameraOpen(true)}
        className="btn-primary pulse-glow"
        style={{
          width: '100%',
          padding: '18px',
          fontSize: '16px',
          borderRadius: '20px',
          marginBottom: '20px',
          justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(212, 175, 55, 0.3)'
        }}
      >
        <QrCode size={24} color="#050505" /> {t('scanCustomerQrBtn')}
      </button>

      {/* Customer Found Card Modal / Banner */}
      {scannedCustomer && (
        <div style={{
          background: '#111111', borderRadius: '24px', padding: '24px', border: '1px solid rgba(212, 175, 55, 0.3)',
          marginBottom: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '4px 12px', borderRadius: '99px', fontWeight: 800, fontSize: '12px', marginBottom: '16px' }}>
            <CheckCircle2 size={14} color="#F2D675" /> {t('verifiedCustomerBadge')}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <img src={scannedCustomer.profile_photo} alt={scannedCustomer.full_name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{scannedCustomer.full_name}</h3>
              <span style={{ fontSize: '12px', color: '#B8B8B8' }}>{scannedCustomer.email} • {scannedCustomer.phone}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ background: '#151515', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('availableCoins')}</span>
              <strong style={{ fontSize: '18px', color: '#F2D675' }}>🪙 {scannedCustomer.balance.toLocaleString()} Coins</strong>
            </div>

            <div style={{ background: '#151515', padding: '12px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('yourMembershipTier')}</span>
              <strong style={{ fontSize: '18px', color: '#D4AF37' }}>🏆 {scannedCustomer.current_level}</strong>
            </div>
          </div>

          <button
            onClick={handleProceedToBilling}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center', borderRadius: '14px' }}
          >
            {t('createBillRedeemBtn')} <ArrowRight size={18} color="#050505" />
          </button>
        </div>
      )}

      {scanError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontSize: '13px', fontWeight: 700 }}>
          {scanError}
        </div>
      )}

      {/* KPI Mobile Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('todaysRedemptions')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '4px 0 0 0' }}>{stats.todayRedemptions}</h2>
        </div>

        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('totalRedeemed')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '4px 0 0 0' }}>{stats.totalRedemptions}</h2>
        </div>

        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('rewardsTab')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#F2D675', margin: '4px 0 0 0' }}>{stats.activeOffersCount}</h2>
        </div>

        <div style={{ background: '#111111', borderRadius: '16px', padding: '16px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <span style={{ fontSize: '11px', color: '#B8B8B8', fontWeight: 700 }}>{t('totalDiscountsApproved')}</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#D4AF37', margin: '4px 0 0 0' }}>₹{stats.totalDiscountsGiven}</h2>
        </div>
      </div>

      {/* Recent Redemptions Card List */}
      <div style={{ background: '#111111', borderRadius: '20px', padding: '20px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginBottom: '14px' }}>{t('recentStoreRedemptions')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentRedemptions.length === 0 ? (
            <div style={{ color: '#888888', fontSize: '13px', textAlign: 'center', padding: '16px' }}>{t('noRedemptionsToday')}</div>
          ) : (
            recentRedemptions.map(r => (
              <div key={r.id} style={{ background: '#151515', padding: '12px', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 800, color: '#F2D675', fontSize: '13px' }}>{r.redemption_code}</span>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>{r.customer_name}</div>
                  <span style={{ fontSize: '11px', color: '#B8B8B8' }}>{r.offer_title}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#D4AF37', fontSize: '13px' }}>{r.discount_percent}% OFF</span>
                  <span className={`badge ${r.status === 'USED' ? 'badge-used' : 'badge-active'}`} style={{ display: 'block', marginTop: '4px', fontSize: '10px' }}>{r.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* REAL CAMERA QR SCANNER MODAL */}
      {isCameraOpen && (
        <CameraQRScanner
          onScanSuccess={(qrPayload) => handleScanCustomerPayload(qrPayload)}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
