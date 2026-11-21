import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import vp52Logo from '../assets/vp52-logo.png';

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9082c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9082-2.2581c-.8059.54-1.8368.8595-3.0482.8595-2.344 0-4.3282-1.5831-5.0364-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
    <path fill="#FBBC05" d="M3.9636 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9636 10.71z"/>
    <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9636 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
  </svg>
);

export default function CustomerCompleteProfile() {
  const navigate = useNavigate();
  const { user, loading: authLoading, completeCustomerProfile, logout } = useAuth();
  const { t } = useI18n();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize prefilled fields from user object
  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== 'customer') {
        navigate('/customer/login', { replace: true });
        return;
      }
      if (user.profile_completed === true && user.phone) {
        navigate('/customer/home', { replace: true });
        return;
      }
      if (user.full_name && !fullName) {
        setFullName(user.full_name);
      }
      if (user.phone && !mobileNumber) {
        setMobileNumber(user.phone.replace(/^\+91/, ''));
      }
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Validation
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError(t('nameRequired') || 'Please enter your full name (minimum 2 characters)');
      return;
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      setError(t('validMobileRequired') || 'Please enter a valid 10-digit mobile number');
      return;
    }

    if (!password || password.length < 8) {
      setError(t('passwordMinLength') || 'Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch') || 'Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      await completeCustomerProfile({
        full_name: fullName.trim(),
        mobile_number: mobileNumber.trim(),
        password,
        confirm_password: confirmPassword
      });

      // Once successfully completed, proceed to customer dashboard
      navigate('/customer/home', { replace: true });
    } catch (err) {
      setError(err.message || t('completeProfileFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await logout();
    navigate('/customer/login', { replace: true });
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
          maxWidth: '440px',
          background: '#0e0e0e',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '24px',
          padding: '32px 24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.08)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
            {t('completeProfileTitle') || 'Complete Your Profile'}
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#B8B8B8',
              lineHeight: 1.45,
              margin: 0
            }}
          >
            {t('completeProfileSubtitle') || 'Just a few more details to activate your VP52 rewards account.'}
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
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Verified Google Email Address (Locked & Display-Only) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#B8B8B8'
                }}
              >
                {t('emailAddress') || 'Email Address'}
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(52, 168, 83, 0.12)',
                  border: '1px solid rgba(52, 168, 83, 0.35)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  color: '#4ade80',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                <ShieldCheck size={12} />
                <span>{t('verifiedByGoogle') || 'Verified by Google'}</span>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#777777" style={{ position: 'absolute', left: '14px', top: '14px' }} />
              <input
                type="email"
                disabled
                readOnly
                value={user?.email || ''}
                style={{
                  width: '100%',
                  background: '#121212',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#9ca3af',
                  padding: '12px 14px 12px 42px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed'
                }}
              />
            </div>
            <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#666666' }}>
              {t('googleLinkedHint')}
            </p>
          </div>

          {/* Full Name */}
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
              {t('fullName') || 'Full Name'} *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '14px' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('namePlaceholder')}
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

          {/* Mobile Number */}
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
              {t('mobileNumber') || 'Mobile Number'} *
            </label>
            <div style={{ position: 'relative', display: 'flex' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: '#1c1c1c',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRight: 'none',
                  borderRadius: '12px 0 0 12px',
                  color: '#D4AF37',
                  fontSize: '14px',
                  fontWeight: 700,
                  gap: '6px'
                }}
              >
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="98765 43210"
                maxLength={14}
                style={{
                  flex: 1,
                  background: '#151515',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '0 12px 12px 0',
                  color: '#FFFFFF',
                  padding: '12px 14px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#666666' }}>
              {t('mobileRecoveryHint')}
            </p>
          </div>

          {/* Create Password */}
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
              {t('createPassword') || 'Create Password'} *
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
            <p style={{ margin: '4px 0 0 2px', fontSize: '11px', color: '#666666' }}>
              {t('min8CharsHint')}
            </p>
          </div>

          {/* Confirm Password */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              marginTop: '8px',
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {submitting ? (
              <span>{t('pleaseWait') || 'Saving profile...'}</span>
            ) : (
              <>
                <span>{t('completeProfileSubmit') || 'Complete Profile & Start Earning'}</span>
                <ArrowRight size={18} color="#050505" />
              </>
            )}
          </button>

          {/* Cancel & Sign Out Option */}
          <div style={{ textAlign: 'center', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                color: '#888888',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px'
              }}
            >
              <LogOut size={14} />
              <span>{t('cancelAndSignOut') || 'Cancel & Sign Out'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
