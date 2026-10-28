import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { QRCodeSVG } from 'qrcode.react';
import { Award, Phone, Mail, CheckCircle2, RefreshCw, Lock, LogOut, Trash2, Shield, AlertTriangle } from 'lucide-react';

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { t } = useI18n();
  const [qrToken, setQrToken] = useState(null);
  const [loadingQr, setLoadingQr] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/customer/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Account deleted successfully.');
        logout();
        navigate('/customer/login');
      } else {
        setDeleteError(data.error || 'Failed to delete account.');
        setDeleting(false);
      }
    } catch (err) {
      console.error(err);
      setDeleteError('Network error while deleting account.');
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', background: '#050505' }}>
      <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '16px', fontWeight: 800 }}>
        {t('profileTitle')}
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
          {user && user.full_name ? user.full_name.charAt(0).toUpperCase() : 'C'}
        </div>

        <h3 style={{ fontSize: '18px', color: '#FFFFFF', marginBottom: '2px', fontWeight: 800 }}>
          {user ? user.full_name : 'Customer'}
        </h3>
        <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '12px' }}>
          {user ? user.email : 'customer@example.com'}
        </p>

        <span className="badge badge-active" style={{ fontSize: '12px', padding: '6px 12px' }}>
          <CheckCircle2 size={14} color="#F2D675" /> {t('activeRewardsMember')}
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
          <Lock size={12} color="#F2D675" /> {t('cryptoSecureQr')}
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '20px', display: 'inline-block', marginBottom: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
          {loadingQr ? (
            <div style={{ width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777777', fontSize: '12px' }}>
              {t('generatingSecureQr')}
            </div>
          ) : qrToken ? (
            <QRCodeSVG value={qrToken} size={160} />
          ) : (
            <div style={{ color: '#ef4444', fontSize: '12px' }}>Failed to load QR token</div>
          )}
        </div>

        <p style={{ fontSize: '12px', color: '#B8B8B8', marginBottom: '14px' }}>
          {t('showQrToMerchant')}
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
          <RefreshCw size={14} color="#D4AF37" /> {t('rotateSecureToken')}
        </button>
      </div>

      {/* Profile Details List */}
      <div style={{ background: '#111111', borderRadius: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mail size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('emailAddress')}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{user ? user.email : '-'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Phone size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('mobileNumber')}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{user ? user.phone || '-' : '-'}</span>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Award size={18} color="#D4AF37" />
          <div>
            <span style={{ fontSize: '11px', color: '#B8B8B8', display: 'block' }}>{t('availableCoinsBalance')}</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#F2D675' }}>
              🪙 {(user ? user.available_coins || user.balance || 0 : 0).toLocaleString()} Coins
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Policy and Compliance Links */}
      <div style={{
        background: '#111111',
        borderRadius: '16px',
        border: '1px solid rgba(212, 175, 55, 0.15)',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <Link
          to="/privacy"
          style={{
            color: '#D4AF37',
            fontSize: '13px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          <Shield size={16} color="#D4AF37" /> {t('privacyPolicyLink')}
        </Link>
        <Link
          to="/delete-account"
          style={{
            color: '#888888',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={14} color="#888888" /> {t('accountDeletionTitle')}
        </Link>
      </div>

      {/* Action Buttons: Sign Out and Delete Account */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '14px',
            color: '#FFFFFF',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            background: '#151515',
            fontWeight: 700,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <LogOut size={18} color="#D4AF37" /> {t('signOutAccount')}
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: '100%',
            padding: '14px',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.06)',
            fontWeight: 700,
            borderRadius: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Trash2 size={18} color="#ef4444" /> {t('deleteAccountBtn')}
        </button>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#151515',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              color: '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#ef4444' }}>
              <AlertTriangle size={24} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {t('deleteAccountConfirmTitle')}
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: '#CCCCCC', lineHeight: '1.5', marginBottom: '20px' }}>
              {t('deleteAccountWarning')}
            </p>

            {deleteError && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '14px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#222222',
                  border: '1px solid #444444',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('cancelBtn')}
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAccount}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#dc2626',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontWeight: 800,
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? '...' : t('confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
