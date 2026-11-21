import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import { APP_NAME } from '../../config/brand';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import vp52Logo from '../../assets/vp52-logo.png';

export default function ShopLogin() {
  const { t } = useI18n();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/shop/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password })
      });

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success) {
        throw new Error(resolveApiErrorMessage(parsed, t, 'shopLoginFailed'));
      }

      localStorage.setItem('rewards_token', data.token);
      localStorage.setItem('rewards_user', JSON.stringify(data.user));
      window.location.href = (data.user && data.user.must_change_password)
        ? '/shop/change-password'
        : '/shop/dashboard';
    } catch (err) {
      setError(resolveNetworkErrorMessage(err, t, 'shopLoginFailed'));
    } finally {
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
      padding: '24px',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
        <LanguageSwitcher tone="dark" compact={true} />
      </div>
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
              width: '90px',
              height: '90px',
              objectFit: 'contain',
              display: 'inline-block',
              marginBottom: '12px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#D4AF37', letterSpacing: '0.5px', marginBottom: '2px' }}>{APP_NAME}</div>
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', marginBottom: '4px' }}>{t('merchantStoreLogin')}</h2>
          <p style={{ fontSize: '13px', color: '#B8B8B8' }}>
            {t('merchantLoginSubtitle')}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('shopEmailOrMobile')}</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="text"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder={t('shopEmailMobilePlaceholder')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('password')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="password"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}
          >
            {loading ? t('authenticatingMerchant') : t('signInWithPassword')}
            <ArrowRight size={18} color="#050505" />
          </button>
        </form>

        <div style={{
          marginTop: '16px',
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(212, 175, 55, 0.08)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          fontSize: '12px',
          color: '#B8B8B8',
          textAlign: 'center',
          lineHeight: 1.45
        }}>
          {t('merchantAccountRecoveryNote')}
        </div>

        <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '12.5px' }}>
          <Link to="/merchant/register" style={{ color: '#F2D675', textDecoration: 'none', fontWeight: 700 }}>
            {t('registerAsMerchantBtn')}
          </Link>
        </div>

        <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <Link to="/customer/login" style={{ color: '#D4AF37', textDecoration: 'none', fontWeight: 700 }}>
            {t('customerAppLink')}
          </Link>
          <Link to="/admin/login" style={{ color: '#B8B8B8', textDecoration: 'none', fontWeight: 700 }}>
            {t('adminPortalLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
