import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { APP_NAME } from '../../config/brand';
import { Store, Lock, ShieldCheck, ArrowRight, LogOut } from 'lucide-react';

// Forced first-login (and voluntary) merchant password change.
//
// Reached when a merchant logs in with an admin-issued temporary password
// (must_change_password = 1). The merchant cannot reach the dashboard until this
// completes (enforced by ShopLayout's redirect gate + the server flag). On success
// we update the cached user (must_change_password = 0) and hard-navigate to the
// dashboard, matching the existing ShopLogin session pattern (re-inits AuthContext
// from localStorage, then /me confirms the cleared flag — no context race).
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

    // Client-side pre-checks mirror the server policy (which stays authoritative).
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

      // Clear the cached flag so the dashboard gate lets the merchant through.
      try {
        const saved = JSON.parse(localStorage.getItem('rewards_user') || '{}');
        saved.must_change_password = 0;
        localStorage.setItem('rewards_user', JSON.stringify(saved));
      } catch (_) { /* non-fatal: /me will re-sync */ }

      window.location.href = '/shop/dashboard';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: '12px', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)'
          }}>
            <ShieldCheck size={30} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#059669', letterSpacing: '0.5px', marginBottom: '2px' }}>{APP_NAME}</div>
          <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '4px', fontWeight: 800 }}>{t('setNewPasswordTitle')}</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            {user ? (user.shop_name || user.full_name) : t('shopMerchantFallback')}
          </p>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '12px', borderRadius: '12px', fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.5 }}>
          {t('firstLoginPwNotice')}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('temporaryPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('newPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
            <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>{t('pwRequirementHint')}</span>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('confirmNewPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
            className="btn-success"
            style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}
          >
            {loading ? t('updatingPassword') : t('updatePasswordContinue')}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} /> {t('signOutMerchant')}
          </button>
        </div>
      </div>
    </div>
  );
}
