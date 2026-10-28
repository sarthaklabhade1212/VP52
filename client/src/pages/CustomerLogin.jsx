import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Store,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { signInWithGoogle, isNativeApp } from '../utils/googleAuth';
import LanguageSwitcher from '../components/LanguageSwitcher';
import vp52Logo from '../assets/vp52-logo.png';

const GoogleGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9082c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9082-2.2581c-.8059.54-1.8368.8595-3.0482.8595-2.344 0-4.3282-1.5831-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
    <path fill="#FBBC05" d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"/>
    <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
  </svg>
);

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { user, loading: authLoading, loginCustomer, registerCustomer, loginCustomerGoogle } = useAuth();
  const { t } = useI18n();

  // Clear switch between Google Sign-In and Email/Password
  const [authMethod, setAuthMethod] = useState('google'); // 'google' | 'credentials'
  const [isRegister, setIsRegister] = useState(false);

  // Form input state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: ''
  });

  // Password visibility controls
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already authenticated as customer
  useEffect(() => {
    if (!authLoading && user && user.role === 'customer') {
      if (user.profile_completed === false) {
        navigate('/customer/complete-profile', { replace: true });
      } else {
        navigate('/customer/home', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  // Primary: Google Sign-In Flow
  const handleGoogleLogin = async () => {
    if (loading || googleLoading) return;
    setError(null);
    setGoogleLoading(true);

    try {
      // 1. Trigger native Google Sign-In (Credential Manager on Android)
      const idToken = await signInWithGoogle();

      // 2. Transmit returned ID token to backend for cryptographic verification
      const loggedInUser = await loginCustomerGoogle(idToken);

      // 3. If new customer or profile incomplete, guide to Complete Profile
      if (loggedInUser && loggedInUser.profile_completed === false) {
        navigate('/customer/complete-profile', { replace: true });
      } else {
        navigate('/customer/home', { replace: true });
      }
    } catch (err) {
      const code = err && err.code;
      if (code === 'cancelled') {
        return;
      }

      if (code === 'not_configured') {
        setError(
          err.message ||
          t('googleNotConfigured') ||
          'Google Cloud OAuth is not configured for this build.'
        );
      } else if (code === 'reauth_failed') {
        setError(
          err.message ||
          'Google authentication could not be completed. Please ensure your device has internet connectivity to Google services, and that your account is registered as an authorized test user in Google Cloud Console if the project is in Testing mode.'
        );
      } else if (code === 'unavailable') {
        setError(t('googleUnavailable') || 'Google sign-in is only available in the mobile app.');
      } else if (code === 'network' || (err && /network|failed to fetch/i.test(err.message || ''))) {
        setError(
          err.message && (err.message.includes('Unable to reach server') || err.message.includes('Network error'))
            ? err.message
            : (t('googleNetworkError') || 'Network error during Google sign-in. Please check your internet connection.')
        );
      } else {
        setError(err.message || t('googleAuthFailed') || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Secondary: Email / Password Flow (Sign In or Registration)
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (loading || googleLoading) return;
    setError(null);

    if (isRegister) {
      if (!formData.full_name.trim()) {
        setError(t('nameRequired') || 'Full name is required');
        return;
      }
      if (!formData.phone.trim()) {
        setError(t('mobileRequired') || 'Mobile number is required');
        return;
      }
      if (formData.password.length < 8) {
        setError(t('passwordMinLength') || 'Password must be at least 8 characters');
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setError(t('passwordMismatch') || 'Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const newUser = await registerCustomer({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          password: formData.password,
          confirm_password: formData.confirm_password
        });
        if (newUser && newUser.profile_completed === false) {
          navigate('/customer/complete-profile', { replace: true });
        } else {
          navigate('/customer/home', { replace: true });
        }
      } else {
        const loggedInUser = await loginCustomer(formData.email.trim(), formData.password);
        if (loggedInUser && loggedInUser.profile_completed === false) {
          navigate('/customer/complete-profile', { replace: true });
        } else {
          navigate('/customer/home', { replace: true });
        }
      }
    } catch (err) {
      setError(err.message || t('loginFailed') || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050505',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        position: 'relative'
      }}
    >
      {/* Top Language Switcher */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10
        }}
      >
        <LanguageSwitcher tone="dark" compact={true} />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#0e0e0e',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '24px',
          padding: '30px 22px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.08)',
          boxSizing: 'border-box'
        }}
      >
        {/* VP52 Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <img
            src={vp52Logo}
            alt="VP52 Logo"
            draggable="false"
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'contain',
              display: 'inline-block',
              marginBottom: '10px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.35))'
            }}
          />
          <h1
            style={{
              fontSize: '24px',
              color: '#FFFFFF',
              marginBottom: '6px',
              fontWeight: 800,
              letterSpacing: '0.3px'
            }}
          >
            {t('welcomeToVp52') || 'Welcome to VP52'}
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#B8B8B8',
              lineHeight: 1.45,
              margin: 0
            }}
          >
            {t('customerLoginTagline') || 'Sign in to earn coins, unlock store discounts, and redeem rewards.'}
          </p>
        </div>

        {/* Clear Switch Between Google and Email/Password Login */}
        <div
          style={{
            display: 'flex',
            background: '#151515',
            borderRadius: '14px',
            padding: '4px',
            marginBottom: '22px',
            border: '1px solid rgba(212, 175, 55, 0.2)'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMethod('google');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '11px 8px',
              borderRadius: '10px',
              border: 'none',
              background: authMethod === 'google' ? 'linear-gradient(135deg, #D4AF37 0%, #AA820A 100%)' : 'transparent',
              color: authMethod === 'google' ? '#050505' : '#B8B8B8',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <GoogleGlyph />
            <span>{t('methodGoogle') || 'Google Sign-In'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMethod('credentials');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '11px 8px',
              borderRadius: '10px',
              border: 'none',
              background: authMethod === 'credentials' ? 'linear-gradient(135deg, #D4AF37 0%, #AA820A 100%)' : 'transparent',
              color: authMethod === 'credentials' ? '#050505' : '#B8B8B8',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Mail size={16} />
            <span>{t('methodEmail') || 'Email & Password'}</span>
          </button>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {/* ========================================================
            TAB 1: GOOGLE SIGN-IN
            ======================================================== */}
        {authMethod === 'google' && (
          <div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#1f2937',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: (googleLoading || loading) ? 'not-allowed' : 'pointer',
                opacity: (googleLoading || loading) ? 0.75 : 1,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              {googleLoading ? (
                <>
                  <RefreshCw size={18} className="spin-anim" color="#1f2937" />
                  <span>{t('googleSigningIn') || 'Signing in with Google...'}</span>
                </>
              ) : (
                <>
                  <GoogleGlyph />
                  <span>{t('continueWithGoogle') || 'Continue with Google'}</span>
                </>
              )}
            </button>

            {/* Google Features & Trust Signals */}
            <div
              style={{
                marginTop: '20px',
                padding: '14px',
                background: '#121212',
                borderRadius: '12px',
                border: '1px solid rgba(212, 175, 55, 0.12)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D4AF37', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                <ShieldCheck size={16} />
                <span>Fast & Secure Verification</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#888888', lineHeight: 1.45 }}>
                New customers will complete full name, mobile number, and password setup in the next step. Returning customers sign in instantly.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: EMAIL & PASSWORD (LOGIN / REGISTER)
            ======================================================== */}
        {authMethod === 'credentials' && (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isRegister && (
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#B8B8B8',
                    marginBottom: '5px',
                    display: 'block'
                  }}
                >
                  {t('fullName') || 'Full Name'} *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{
                      width: '100%',
                      background: '#151515',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      padding: '12px 14px 12px 42px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#B8B8B8',
                  marginBottom: '5px',
                  display: 'block'
                }}
              >
                {t('emailAddress') || 'Email Address'} *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type="email"
                  required
                  className="form-input"
                  style={{
                    width: '100%',
                    background: '#151515',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    padding: '12px 14px 12px 42px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="customer@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#B8B8B8',
                    marginBottom: '5px',
                    display: 'block'
                  }}
                >
                  {t('mobileNumber') || 'Mobile Number'} *
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                  <input
                    type="tel"
                    required
                    className="form-input"
                    style={{
                      width: '100%',
                      background: '#151515',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      padding: '12px 14px 12px 42px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#B8B8B8',
                    display: 'block'
                  }}
                >
                  {isRegister ? (t('createPassword') || 'Create Password') : (t('password') || 'Password')} *
                </label>

                {!isRegister && (
                  <Link
                    to="/customer/forgot-password"
                    style={{
                      color: '#D4AF37',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    {t('forgotPassword') || 'Forgot Password?'}
                  </Link>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  style={{
                    width: '100%',
                    background: '#151515',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    padding: '12px 42px 12px 42px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#888888',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field (Displayed ONLY during Registration) */}
            {isRegister && (
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#B8B8B8',
                    marginBottom: '5px',
                    display: 'block'
                  }}
                >
                  {t('confirmPassword') || 'Confirm Password'} *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className="form-input"
                    style={{
                      width: '100%',
                      background: '#151515',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      padding: '12px 42px 12px 42px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="••••••••"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '12px',
                      background: 'none',
                      border: 'none',
                      color: '#888888',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                marginTop: '6px',
                opacity: (loading || googleLoading) ? 0.6 : 1,
                cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <span>{t('pleaseWait') || 'Please wait...'}</span>
              ) : (
                <>
                  <span>
                    {isRegister
                      ? (t('createAndStartEarning') || 'Create Account & Start Earning')
                      : (t('signInToAccount') || 'Sign In to Account')}
                  </span>
                  <ArrowRight size={18} color="#050505" />
                </>
              )}
            </button>

            {/* Toggle between Sign In and Register within Email tab */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#D4AF37',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {isRegister
                  ? (t('toggleToSignIn') || 'Already have an account? Sign in')
                  : (t('toggleToRegister') || "Don't have an account? Create Account")}
              </button>
            </div>
          </form>
        )}

        {/* Portal Switching & Compliance Links */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(212, 175, 55, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            textAlign: 'center'
          }}
        >
          <Link
            to="/shop/login"
            style={{
              color: '#B8B8B8',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <Store size={15} color="#D4AF37" />
            <span>{t('loginAsMerchant') || 'Login as Merchant'}</span>
            <ArrowRight size={13} color="#D4AF37" />
          </Link>

          <Link
            to="/privacy"
            style={{
              color: '#777777',
              fontSize: '12px',
              textDecoration: 'none',
              fontWeight: 600,
              marginTop: '2px'
            }}
          >
            {t('privacyPolicy') || 'Privacy Policy'}
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
