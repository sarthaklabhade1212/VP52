import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { APP_NAME } from '../../config/brand';
import { Lock, ArrowRight, LogOut } from 'lucide-react';
import vp52Logo from '../../assets/vp52-logo.png';

export default function ShopChangePassword() {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogout = () => {
    logout();
    window.location.href = '/shop/login';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      return setError(t('pwMismatch'));
    }
    if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return setError(t('pwWeak'));
    }
    if (newPassword === currentPassword) {
      return setError(t('pwSameAsOld'));
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('rewards_token');
      const res = await fetch('/api/auth/shop/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('pwChangeFailed'));
      }

      try {
        const saved = JSON.parse(localStorage.getItem('rewards_user') || '{}');
        saved.must_change_password = 0;
        localStorage.setItem('rewards_user', JSON.stringify(saved));
      } catch (_) {}

      window.location.href = '/shop/dashboard';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.12) 0%, #050505 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: '#111111',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src={vp52Logo}
            alt="VP52 Logo"
            draggable="false"
            style={{
              width: '86px',
              height: '86px',
              objectFit: 'contain',
              display: 'inline-block',
              marginBottom: '12px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#D4AF37', letterSpacing: '0.5px', marginBottom: '2px' }}>{APP_NAME}</div>
          <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '4px', fontWeight: 800 }}>{t('setNewPasswordTitle')}</h2>
          <p style={{ fontSize: '13px', color: '#B8B8B8' }}>
            {user ? (user.shop_name || user.full_name) : t('shopMerchantFallback')}
          </p>
        </div>

        <div style={{ background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#F2D675', padding: '12px', borderRadius: '12px', fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.5 }}>
          {t('firstLoginPwNotice')}
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('temporaryPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="password"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('newPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="password"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#777777', marginTop: '4px', display: 'block' }}>{t('pwRequirementHint')}</span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('confirmNewPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="password"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}
          >
            {loading ? t('updatingPassword') : t('updatePasswordContinue')}
            <ArrowRight size={18} color="#050505" />
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', textAlign: 'center' }}>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#B8B8B8', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} color="#D4AF37" /> {t('signOutMerchant')}
          </button>
        </div>
      </div>
    </div>
  );
}
