import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CameraQRScanner from '../../components/CameraQRScanner';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Tag,
  Calendar,
  IndianRupee,
  Search,
  Store,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Award,
  User,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function ShopDashboard() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
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
    return <div style={{ padding: '40px', color: '#64748b', textAlign: 'center' }}>Loading merchant dashboard...</div>;
  }

  const { shop, stats, recentRedemptions, activeOffers } = data;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Top Header & Store ID Badge */}
      <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>
          VERIFIED MERCHANT STORE
        </span>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '6px', marginBottom: '2px' }}>
          {shop.name}
        </h1>
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
          {shop.address} • {shop.category}
        </p>
      </div>

      {/* PROMINENT MOBILE CTA: SCAN CUSTOMER QR */}
      <button
        onClick={() => setIsCameraOpen(true)}
        className="btn-success pulse-glow"
        style={{
          width: '100%',
          padding: '18px',
          fontSize: '16px',
          borderRadius: '20px',
          marginBottom: '20px',
          justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)'
        }}
      >
        <QrCode size={24} /> Scan Customer QR (Device Camera)
      </button>

      {/* Customer Found Card Modal / Banner */}
      {scannedCustomer && (
        <div style={{
          background: '#ffffff', borderRadius: '24px', padding: '24px', border: '2px solid #a7f3d0',
          marginBottom: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '99px', fontWeight: 800, fontSize: '12px', marginBottom: '16px' }}>
            <CheckCircle2 size={14} /> CUSTOMER VERIFIED
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <img src={scannedCustomer.profile_photo} alt={scannedCustomer.full_name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{scannedCustomer.full_name}</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{scannedCustomer.email} • {scannedCustomer.phone}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Available Points</span>
              <strong style={{ fontSize: '18px', color: '#4f46e5' }}>🪙 {scannedCustomer.balance.toLocaleString()} Pts</strong>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Current Tier</span>
              <strong style={{ fontSize: '18px', color: '#10b981' }}>🏆 {scannedCustomer.current_level}</strong>
            </div>
          </div>

          <button
            onClick={handleProceedToBilling}
            className="btn-success"
            style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center', borderRadius: '14px' }}
          >
            Create Bill / Redeem Reward <ArrowRight size={18} />
          </button>
        </div>
      )}

      {scanError && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', color: '#b91c1c', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontSize: '13px', fontWeight: 700 }}>
          {scanError}
        </div>
      )}

      {/* KPI Mobile Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Today's Redemptions</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>{stats.todayRedemptions}</h2>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Redemptions</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>{stats.totalRedemptions}</h2>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Active Offers</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#4f46e5', margin: '4px 0 0 0' }}>{stats.activeOffersCount}</h2>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>Total Discounts</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', margin: '4px 0 0 0' }}>₹{stats.totalDiscountsGiven}</h2>
        </div>
      </div>

      {/* Recent Redemptions Card List */}
      <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>Recent Store Redemptions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentRedemptions.map(r => (
            <div key={r.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 800, color: '#4f46e5', fontSize: '13px' }}>{r.redemption_code}</span>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{r.customer_name}</div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{r.offer_title}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: '#10b981', fontSize: '13px' }}>{r.discount_percent}% OFF</span>
                <span className={`badge ${r.status === 'USED' ? 'badge-used' : 'badge-active'}`} style={{ display: 'block', marginTop: '4px', fontSize: '10px' }}>{r.status}</span>
              </div>
            </div>
          ))}
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
