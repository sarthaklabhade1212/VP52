import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { APP_NAME } from '../../config/brand';
import { Store, Lock, Mail, Phone, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ShopLogin() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' | 'password'

  // Password Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Mobile OTP State
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

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Shop merchant login failed');
      }

      localStorage.setItem('rewards_token', data.token);
      localStorage.setItem('rewards_user', JSON.stringify(data.user));
      // Merchants created/reset by an admin must set their own password before
      // reaching the dashboard. Both login methods honour the same gate.
      window.location.href = (data.user && data.user.must_change_password)
        ? '/shop/change-password'
        : '/shop/dashboard';
    } catch (err) {
      setError(err.message);
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
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpCode('123456'); // Dev mock prefill
      }
    } catch (e) {
      setError(e.message);
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

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Mobile OTP login failed');
      }

      localStorage.setItem('rewards_token', data.token);
      localStorage.setItem('rewards_user', JSON.stringify(data.user));
      // Merchants created/reset by an admin must set their own password before
      // reaching the dashboard. Both login methods honour the same gate.
      window.location.href = (data.user && data.user.must_change_password)
        ? '/shop/change-password'
        : '/shop/dashboard';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillShopDemo = () => {
    setLoginMethod('password');
    setIdentifier('shop@example.com');
    setPassword('Shop@123');
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
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            marginBottom: '12px',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)'
          }}>
            <Store size={30} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#059669', letterSpacing: '0.5px', marginBottom: '2px' }}>{APP_NAME}</div>
          <h2 style={{ fontSize: '24px', color: '#0f172a', marginBottom: '4px' }}>{t('merchantStoreLogin')}</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            {t('merchantLoginSubtitle')}
          </p>
        </div>

        {/* Login Method Switcher Pills */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setLoginMethod('otp')}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '10px',
              background: loginMethod === 'otp' ? '#ffffff' : 'transparent',
              color: loginMethod === 'otp' ? '#065f46' : '#64748b',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer'
            }}
          >
            {t('otpMethodLabel')}
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('password')}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '10px',
              background: loginMethod === 'password' ? '#ffffff' : 'transparent',
              color: loginMethod === 'password' ? '#065f46' : '#64748b',
              fontWeight: 700, fontSize: '12px', cursor: 'pointer'
            }}
          >
            {t('passwordMethodLabel')}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {loginMethod === 'otp' ? (
          <form onSubmit={handleOtpLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('registeredMobile')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('enter6DigitOtp')}</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Enter 123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-success"
              style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}
            >
              {loading ? t('verifyingMerchantOtp') : t('verifyOtpSignIn')}
              <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('shopEmailOrMobile')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
                <input
                  type="text"
                  required
                  className="form-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="shop@example.com or 9876543210"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>{t('password')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
              className="btn-success"
              style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}
            >
              {loading ? t('authenticatingMerchant') : t('signInWithPassword')}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <Link to="/customer/login" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
            {t('customerAppLink')}
          </Link>
          <Link to="/admin/login" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 700 }}>
            {t('adminPortalLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
