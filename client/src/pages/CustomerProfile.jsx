import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { User, LogOut, Award, Phone, Mail, Shield, CheckCircle2, RefreshCw, QrCode, Lock } from 'lucide-react';

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [qrToken, setQrToken] = useState(null);
  const [loadingQr, setLoadingQr] = useState(true);

  const fetchQrToken = (rotate = false) => {
    setLoadingQr(true);
    fetch('/api/customer/qr-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rotate })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setQrToken(data.qrToken);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingQr(false));
  };

  useEffect(() => {
    if (token) fetchQrToken(false);
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/customer/login');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '16px' }}>
        My Profile & Secure Customer QR
      </h2>

      {/* User Info Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        marginBottom: '20px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: '28px',
          marginBottom: '12px',
          boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)'
        }}>
          {user ? user.full_name.charAt(0) : 'C'}
        </div>

        <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '2px' }}>
          {user ? user.full_name : 'Customer Name'}
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          {user ? user.email : 'customer@example.com'}
        </p>

        <span className="badge badge-active" style={{ fontSize: '12px', padding: '6px 12px' }}>
          <CheckCircle2 size={14} /> Active Rewards Member
        </span>
      </div>

      {/* CRYPTOGRAPHICALLY SECURE CUSTOMER QR CARD */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        borderRadius: '24px',
        padding: '24px',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: '20px',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.4)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 800, color: '#a5b4fc', marginBottom: '16px' }}>
          <Lock size={12} /> CRYPTOGRAPHICALLY SECURE QR
        </div>

        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '20px', display: 'inline-block', marginBottom: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>
          {loadingQr ? (
            <div style={{ width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
              Generating secure QR...
            </div>
          ) : qrToken ? (
            <QRCodeSVG value={qrToken} size={160} />
          ) : (
            <div style={{ color: '#dc2626', fontSize: '12px' }}>Failed to load QR token</div>
          )}
        </div>

        <p style={{ fontSize: '12px', color: '#c7d2fe', marginBottom: '14px' }}>
          Show this QR code to the merchant to verify identity & redeem rewards.
        </p>

        <button
          type="button"
          onClick={() => fetchQrToken(true)}
          style={{
            background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)',
            padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}
        >
          <RefreshCw size={14} /> Rotate Secure Token
        </button>
      </div>

      {/* Profile Details List */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mail size={18} color="#4f46e5" />
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Email Address</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{user ? user.email : '-'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Phone size={18} color="#4f46e5" />
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Phone Number</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{user ? user.phone || '9876543210' : '9876543210'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Award size={18} color="#4f46e5" />
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Available Coins Balance</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>🪙 {(user ? user.available_coins || user.balance || 0 : 0).toLocaleString()} Coins (₹{(user ? user.available_coins || user.balance || 0 : 0).toLocaleString()})</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="btn-secondary"
        style={{ width: '100%', padding: '14px', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', fontWeight: 700 }}
      >
        <LogOut size={18} /> Sign Out of Account
      </button>
    </div>
  );
}
