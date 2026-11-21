import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { APP_NAME } from '../../config/brand';
import { parseApiResponse, resolveApiErrorMessage, resolveNetworkErrorMessage } from '../../utils/api';
import { Lock, Mail, Phone, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import vp52Logo from '../../assets/vp52-logo.png';

export default function ShopLogin() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loginMethod, setLoginMethod] = useState('otp');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

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

  const handleSendOtp = async () => {
    if (!mobile) return setError(t('enterMobileError'));
    setError(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success) {
        setOtpSent(true);
        setOtpCode('123456');
      } else {
        setError(resolveApiErrorMessage(parsed, t, 'mobileOtpLoginFailed'));
      }
    } catch (e) {
      setError(resolveNetworkErrorMessage(e, t, 'mobileOtpLoginFailed'));
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    if (!otpCode) return setError(t('enterOtpError'));

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/shop/login-mobile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp_code: otpCode })
      });

      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (!parsed.ok || !data || !data.success) {
        throw new Error(resolveApiErrorMessage(parsed, t, 'mobileOtpLoginFailed'));
      }

      localStorage.setItem('rewards_token', data.token);
      localStorage.setItem('rewards_user', JSON.stringify(data.user));
      window.location.href = (data.user && data.user.must_change_password)
        ? '/shop/change-password'
        : '/shop/dashboard';
    } catch (err) {
      setError(resolveNetworkErrorMessage(err, t, 'mobileOtpLoginFailed'));
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

        {/* Login Method Switcher Pills */}
        <div style={{ display: 'flex', background: '#151515', borderRadius: '12px', padding: '4px', marginBottom: '20px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <button
            type="button"
            onClick={() => setLoginMethod('otp')}
            style={{
              flex: 1, padding: '8px', border: loginMethod === 'otp' ? '1px solid #D4AF37' : 'none', borderRadius: '10px',
              background: loginMethod === 'otp' ? '#111111' : 'transparent',
              color: loginMethod === 'otp' ? '#F2D675' : '#777777',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer'
            }}
          >
            {t('otpMethodLabel')}
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('password')}
            style={{
              flex: 1, padding: '8px', border: loginMethod === 'password' ? '1px solid #D4AF37' : 'none', borderRadius: '10px',
              background: loginMethod === 'password' ? '#111111' : 'transparent',
              color: loginMethod === 'password' ? '#F2D675' : '#777777',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer'
            }}
          >
            {t('passwordMethodLabel')}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {loginMethod === 'otp' ? (
          <form onSubmit={handleOtpLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('registeredMobile')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Phone size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
                  <input
                    type="tel"
                    required
                    className="form-input"
                    style={{ paddingLeft: '42px' }}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '0 14px' }}
                >
                  {otpSent ? t('resend') : t('sendOtp')}
                </button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('enter6DigitOtp')}</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder={t('enterSampleOtpPlaceholder')}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}
            >
              {loading ? t('verifyingMerchantOtp') : t('verifyOtpSignIn')}
              <ArrowRight size={18} color="#050505" />
            </button>
          </form>
        ) : (
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
        )}

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
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
