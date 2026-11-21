import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import {
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import vp52Logo from '../assets/vp52-logo.png';

export default function CustomerForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { forgotPassword, resetPassword } = useAuth();
  const { t } = useI18n();

  // 'request' step or 'reset' step
  const initialToken = searchParams.get('token') || '';
  const [step, setStep] = useState(initialToken ? 'reset' : 'request');

  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Dev token banner if available
  const [devToken, setDevToken] = useState(null);

  // Step 1: Request Password Reset
  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const res = await forgotPassword(email.trim());
      setSuccessMessage(res.message || 'If an account exists with this email, password reset instructions have been initiated.');

      if (res.dev_reset_token) {
        setDevToken(res.dev_reset_token);
        setToken(res.dev_reset_token);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Apply New Password with Token
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccessMessage(null);

    if (!token.trim()) {
      setError('Password reset token is required');
      return;
    }

    if (password.length < 8) {
      setError(t('passwordMinLength') || 'Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch') || 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await resetPassword({
        token: token.trim(),
        password,
        confirm_password: confirmPassword
      });
      setSuccessMessage(res.message || 'Password reset successfully! You can now sign in.');
      setStep('done');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Link may be expired or invalid.');
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
          padding: '32px 24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.08)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
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
            {step === 'reset' ? (t('resetPassword') || 'Reset Password') : (t('forgotPassword') || 'Forgot Password?')}
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#B8B8B8',
              lineHeight: 1.45,
              margin: 0
            }}
          >
            {step === 'reset'
              ? 'Enter your reset token and choose a new secure password.'
              : 'Enter your registered customer email to recover your account.'}
          </p>
        </div>

        {/* Error Alert */}
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

        {/* Success Alert */}
        {successMessage && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              color: '#86efac',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{successMessage}</span>
          </div>
        )}

        {/* Dev Token Quick-Action Card */}
        {devToken && step === 'request' && (
          <div
            style={{
              background: '#151515',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D4AF37', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
              <Key size={16} />
              <span>Development Reset Token</span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#999999', wordBreak: 'break-all' }}>
              Code: <strong style={{ color: '#FFFFFF' }}>{devToken}</strong>
            </p>
            <button
              type="button"
              onClick={() => setStep('reset')}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#D4AF37',
                color: '#050505',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Proceed to Enter New Password →
            </button>
          </div>
        )}

        {/* STEP 1: REQUEST FORM */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#B8B8B8',
                  marginBottom: '6px',
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
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
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <span>{t('pleaseWait') || 'Sending instructions...'}</span>
              ) : (
                <>
                  <span>{t('sendResetInstructions') || 'Send Reset Instructions'}</span>
                  <ArrowRight size={18} color="#050505" />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setStep('reset')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#B8B8B8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Already have a reset code? Click here
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: RESET FORM */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#B8B8B8',
                  marginBottom: '6px',
                  display: 'block'
                }}
              >
                Reset Token *
              </label>
              <div style={{ position: 'relative' }}>
                <Key size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your 64-character token"
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
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#B8B8B8',
                  marginBottom: '6px',
                  display: 'block'
                }}
              >
                {t('newPassword') || 'New Password'} *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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

            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#B8B8B8',
                  marginBottom: '6px',
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
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
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <span>{t('pleaseWait') || 'Updating password...'}</span>
              ) : (
                <>
                  <span>{t('resetPassword') || 'Set New Password'}</span>
                  <ArrowRight size={18} color="#050505" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <Link
              to="/customer/login"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '14px',
                textDecoration: 'none',
                borderRadius: '12px',
                boxSizing: 'border-box'
              }}
            >
              <span>{t('signInToAccount') || 'Sign In to Account'}</span>
              <ArrowRight size={18} color="#050505" />
            </Link>
          </div>
        )}

        {/* Back to Sign In Link */}
        <div style={{ textAlign: 'center', marginTop: '22px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', paddingTop: '16px' }}>
          <Link
            to="/customer/login"
            style={{
              color: '#D4AF37',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={14} />
            <span>{t('backToSignIn') || 'Back to Sign In'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
