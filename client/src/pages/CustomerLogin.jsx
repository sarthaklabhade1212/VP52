import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { APP_NAME } from '../config/brand';
import { Lock, Mail, User, Phone, ArrowRight, Store } from 'lucide-react';
import { signInWithGoogle, isNativeApp } from '../utils/googleAuth';
import vp52Logo from '../assets/vp52-logo.png';

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9082c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9082-2.2581c-.8059.54-1.8368.8595-3.0482.8595-2.344 0-4.3282-1.5831-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
    <path fill="#FBBC05" d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"/>
    <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
  </svg>
);

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { loginCustomer, registerCustomer, loginCustomerGoogle } = useAuth();
  const { t } = useI18n();

  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const isNative = isNativeApp();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await registerCustomer(formData);
      } else {
        await loginCustomer(formData.email, formData.password);
      }
      navigate('/customer/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isNative || loading || googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      await loginCustomerGoogle(idToken);
      navigate('/customer/home');
    } catch (err) {
      const code = err && err.code;
      if (code === 'cancelled') {
      } else if (code === 'not_configured') {
        setError(t('googleNotConfigured'));
      } else if (code === 'unavailable') {
        if (isNative) {
          setError(t('googleUnavailable'));
        }
      } else if (err && /network/i.test(err.message || '')) {
        setError(t('googleNetworkError'));
      } else {
        setError(t('googleAuthFailed'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '24px', background: '#050505' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <img
          src={vp52Logo}
          alt="VP52 Logo"
          draggable="false"
          style={{
            width: '88px',
            height: 'auto',
            maxHeight: '88px',
            objectFit: 'contain',
            display: 'inline-block',
            marginBottom: '14px'
          }}
        />
        <h1 style={{ fontSize: '28px', color: '#FFFFFF', marginBottom: '6px' }}>{APP_NAME}</h1>
        <p style={{ fontSize: '14px', color: '#B8B8B8' }}>
          {t('customerLoginTagline')}
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {isRegister && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('fullName')}</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="text"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="Sarthak Labhade"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('emailAddress')}</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
            <input
              type="email"
              required
              className="form-input"
              style={{ paddingLeft: '42px' }}
              placeholder="customer@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        {isRegister && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('mobileNumber')}</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        )}

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
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: '16px', marginTop: '8px' }}
        >
          {loading ? t('pleaseWait') : (isRegister ? t('createAndStartEarning') : t('signInToAccount'))}
          <ArrowRight size={18} color="#050505" />
        </button>
      </form>

      {/* OR divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.2)' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#777777', letterSpacing: '0.5px' }}>{t('orDivider')}</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(212, 175, 55, 0.2)' }} />
      </div>

      {/* Continue with Google */}
      {isNative ? (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 700,
            color: '#1f2937',
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: (googleLoading || loading) ? 'not-allowed' : 'pointer',
            opacity: (googleLoading || loading) ? 0.7 : 1
          }}
        >
          <GoogleGlyph />
          {googleLoading ? t('googleSigningIn') : t('continueWithGoogle')}
        </button>
      ) : (
        <div>
          <button
            type="button"
            disabled
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#888888',
              background: '#151515',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'not-allowed',
              opacity: 0.75
            }}
          >
            <GoogleGlyph />
            {t('continueWithGoogle')}
          </button>
          <p style={{
            fontSize: '12px',
            color: '#888888',
            marginTop: '8px',
            marginBottom: 0,
            textAlign: 'center'
          }}>
            ℹ️ {t('googleMobileOnlyNotice')}
          </p>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
          style={{ background: 'none', border: 'none', color: '#D4AF37', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
        >
          {isRegister ? t('toggleToSignIn') : t('toggleToRegister')}
        </button>
      </div>

      <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', textAlign: 'center' }}>
        <Link to="/shop/login" style={{ color: '#B8B8B8', fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
          <Store size={16} color="#D4AF37" /> {t('loginAsMerchant')} <ArrowRight size={14} color="#D4AF37" />
        </Link>
      </div>
    </div>
  );
}
