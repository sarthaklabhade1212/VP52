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
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', background: '#050505' }}>
      <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '16px', fontWeight: 800 }}>
        My Profile & Secure Customer QR
      </h2>

      {/* User Info Card */}
      <div style={{
        background: '#111111',
        borderRadius: '20px',
        padding: '20px',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        textAlign: 'center',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#050505',
          fontWeight: 800,
          fontSize: '28px',
          marginBottom: '12px',
          boxShadow: '0 8px 20px rgba(212, 175, 55, 0.3)'
        }}>
          {user ? user.full_name.charAt(0) : 'C'}
        </div>

        <h3 style={{ fontSize: '18px', color: '#FFFFFF', marginBottom: '2px', fontWeight: 800 }}>
          {user ? user.full_name : 'Customer Name'}
        </h3>
        <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '12px' }}>
          {user ? user.email : 'customer@example.com'}
        </p>

        <span className="badge badge-active" style={{ fontSize: '12px', padding: '6px 12px' }}>
          <CheckCircle2 size={14} color="#F2D675" /> Active Rewards Member
        </span>
      </div>

      {/* CRYPTOGRAPHICALLY SECURE CUSTOMER QR CARD */}
      <div style={{
        background: '#111111',
        borderRadius: '24px',
        padding: '24px',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: '20px',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 800, color: '#F2D675', marginBottom: '16px' }}>
          <Lock size={12} color="#F2D675" /> CRYPTOGRAPHICALLY SECURE QR
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '20px', display: 'inline-block', marginBottom: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
          {loadingQr ? (
            <div style={{ width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777777', fontSize: '12px' }}>
              Generating secure QR...
            </div>
          ) : qrToken ? (
            <QRCodeSVG value={qrToken} size={160} />
          ) : (
            <div style={{ color: '#ef4444', fontSize: '12px' }}>Failed to load QR token</div>
          )}
        </div>

        <p style={{ fontSize: '12px', color: '#B8B8B8', marginBottom: '14px' }}>
          Show this QR code to the merchant to verify identity & redeem rewards.
        </p>

        <button
          type="button"
          onClick={() => fetchQrToken(true)}
          className="btn-secondary"
          style={{
            padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}
        >
          <RefreshCw size={14} color="#D4AF37" /> Rotate Secure Token
        </button>
      </div>

      {/* Profile Details List */}
      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mail size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Email Address</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{user ? user.email : '-'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Phone size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Phone Number</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{user ? user.phone || '9876543210' : '9876543210'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Award size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>Available Coins Balance</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675' }}>🪙 {(user ? user.available_coins || user.balance || 0 : 0).toLocaleString()} Coins (₹{(user ? user.available_coins || user.balance || 0 : 0).toLocaleString()})</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        style={{ width: '100%', padding: '14px', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', background: '#151515', fontWeight: 700, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <LogOut size={18} color="#ef4444" /> Sign Out of Account
      </button>
    </div>
  );
}
