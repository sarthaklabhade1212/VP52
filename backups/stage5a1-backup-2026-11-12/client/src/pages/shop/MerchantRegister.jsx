import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { CATEGORIES } from '../../config/categories';
import { getCurrentLocation } from '../../utils/location';
import { signInWithGoogle } from '../../utils/googleAuth';
import { parseApiResponse, resolveApiErrorMessage, resolveMediaUrl, resolveNetworkErrorMessage } from '../../utils/api';
import {
  compressImageToDataUrl,
  validateImageFile,
  IMAGE_UPLOAD_PRESETS,
  ImageCompressionError
} from '../../utils/imageCompression';
import vp52Logo from '../../assets/vp52-logo.png';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import {
  Store,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Navigation,
  Upload
} from 'lucide-react';

export default function MerchantRegister() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { t, translateCategory, translateSubcategory } = useI18n();

  // Registration Mode: 'choice', 'form', 'submitted'
  const [mode, setMode] = useState('choice');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    owner_name: '',
    email: '',
    mobile_number: '',
    password: '',
    confirm_password: '',
    name: '',
    category: CATEGORIES[0].name,
    subcategory: CATEGORIES[0].subcategories[0],
    address: '',
    area_locality: '',
    city: 'Pune',
    pincode: '',
    latitude: '',
    longitude: '',
    opening_time: '09:00',
    closing_time: '21:00',
    description: '',
    logo_url: '',
    cover_photo_url: ''
  });

  const [gettingLocation, setGettingLocation] = useState(false);

  // Handle Category Change (updates dependent subcategory list)
  const handleCategoryChange = (e) => {
    const newCatName = e.target.value;
    const catObj = CATEGORIES.find(c => c.name === newCatName) || CATEGORIES[0];
    setFormData(prev => ({
      ...prev,
      category: newCatName,
      subcategory: catObj.subcategories[0] || ''
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Get Current GPS Location
  const handleGetLocation = async () => {
    setGettingLocation(true);
    try {
      const coords = await getCurrentLocation();
      setFormData(prev => ({
        ...prev,
        latitude: coords.lat.toFixed(6),
        longitude: coords.lng.toFixed(6)
      }));
    } catch (err) {
      alert(t('mrGpsFetchError', { message: err.message }));
    } finally {
      setGettingLocation(false);
    }
  };

  // Upload Logo or Cover Image
  const handleImageUpload = async (field, e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, {
      allowAnyRasterImage: true,
      maxInputBytes: IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO.maxInputBytes
    });
    if (!validation.valid) {
      setError(
        validation.reason === 'FILE_TOO_LARGE'
          ? t('apiErrorPayloadTooLarge')
          : t('photoTypeError')
      );
      input.value = '';
      return;
    }

    setError(null);
    try {
      const { dataUrl } = await compressImageToDataUrl(file, IMAGE_UPLOAD_PRESETS.GENERAL_PHOTO);
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, folder: 'merchant' })
      });
      const parsed = await parseApiResponse(res);
      const data = parsed.data;
      if (parsed.ok && data && data.success && data.url) {
        setFormData(prev => ({ ...prev, [field]: data.url }));
      } else {
        setError(resolveApiErrorMessage(parsed, t, 'photoUploadFailed'));
      }
    } catch (err) {
      console.error('Upload failed', err);
      if (err instanceof ImageCompressionError) {
        setError(
          err.code === 'COMPRESSED_TOO_LARGE'
            ? t('apiErrorPayloadTooLarge')
            : t('photoCompressionFailed')
        );
      } else {
        setError(resolveNetworkErrorMessage(err, t, 'photoUploadFailed'));
      }
    } finally {
      input.value = '';
    }
  };

  // 1. Google Sign-In for Merchants
  const handleGoogleMerchantAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) {
        throw new Error(t('mrGoogleCancelled'));
      }

      // Check if merchant already exists or start onboarding with prefilled Google details
      const res = await fetch('/api/auth/merchant/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });
      const data = await res.json();

      if (data.success && data.token && data.user) {
        // Already registered and approved merchant
        if (setSession) setSession(data.token, data.user);
        navigate('/shop/dashboard');
      } else if (data.onboardingRequired) {
        // Needs to fill out shop details with prefilled email & name
        setFormData(prev => ({
          ...prev,
          owner_name: data.prefill?.name || '',
          email: data.prefill?.email || '',
          name: data.prefill?.name ? `${data.prefill.name}'s Shop` : ''
        }));
        setMode('form');
      } else {
        setError(data.error || t('mrGoogleOnboardingFailed'));
      }
    } catch (err) {
      setError(err.message || t('googleAuthFailed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. Form Self-Registration
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password && formData.password !== formData.confirm_password) {
      setError(t('passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        owner_name: formData.owner_name,
        email: formData.email,
        mobile_number: formData.mobile_number,
        password: formData.password,
        category: formData.category,
        subcategory: formData.subcategory,
        address: formData.address,
        area_locality: formData.area_locality,
        city: formData.city,
        pincode: formData.pincode,
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null,
        opening_time: formData.opening_time,
        closing_time: formData.closing_time,
        description: formData.description,
        logo_url: formData.logo_url,
        cover_photo_url: formData.cover_photo_url
      };

      const res = await fetch('/api/auth/merchant/self-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessInfo({
          shopCode: data.shop?.shop_code || 'SHOP-PENDING',
          shopName: data.shop?.name || formData.name,
          message: data.message
        });
        setMode('submitted');
      } else {
        setError(data.error || t('mrRegistrationFailed'));
      }
    } catch (err) {
      setError(err.message || t('mrNetworkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryObj = CATEGORIES.find(c => c.name === formData.category) || CATEGORIES[0];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 20%, rgba(212, 175, 55, 0.12) 0%, #050505 75%)',
      padding: '24px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
        <LanguageSwitcher tone="dark" compact={true} />
      </div>
      <div style={{
        background: '#0B0B0B',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        borderRadius: '24px',
        maxWidth: mode === 'form' ? '680px' : '480px',
        width: '100%',
        padding: '32px 24px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.9)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src={vp52Logo}
            alt="VP52 Logo"
            style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 12px auto', filter: 'drop-shadow(0 4px 16px rgba(212, 175, 55, 0.3))' }}
          />
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
            {t('mrTitle')}
          </h2>
          <span style={{ fontSize: '12px', color: '#F2D675', fontWeight: 700, display: 'inline-block', marginTop: '4px' }}>
            {t('mrFreeBadge')}
          </span>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '12px', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>
            <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {error}
          </div>
        )}

        {/* MODE 1: METHOD SELECTION */}
        {mode === 'choice' && (
          <div>
            <p style={{ fontSize: '13.5px', color: '#B8B8B8', textAlign: 'center', lineHeight: 1.5, marginBottom: '24px' }}>
              {t('mrIntro')}
            </p>

            <button
              onClick={handleGoogleMerchantAuth}
              disabled={googleLoading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: '#FFFFFF',
                color: '#1F2937',
                border: 'none',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                marginBottom: '14px',
                boxShadow: '0 4px 15px rgba(255,255,255,0.1)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {googleLoading ? t('googleSigningIn') : t('continueWithGoogle')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', color: '#666666', fontSize: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ padding: '0 10px', fontWeight: 600 }}>{t('mrOrRegisterEmail')}</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button
              onClick={() => setMode('form')}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                justifyContent: 'center',
                marginBottom: '20px'
              }}
            >
              {t('mrFillFormBtn')} <ArrowRight size={16} color="#050505" />
            </button>

            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <span style={{ fontSize: '13px', color: '#B8B8B8' }}>{t('mrAlreadyHaveShop')} </span>
              <Link to="/shop/login" style={{ color: '#F2D675', fontWeight: 800, textDecoration: 'none', fontSize: '13px' }}>
                {t('mrSignInHere')}
              </Link>
            </div>
          </div>
        )}

        {/* MODE 2: REGISTRATION FORM */}
        {mode === 'form' && (
          <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#D4AF37', margin: '0 0 4px 0', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px' }}>
              {t('mrSec1Title')}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrShopNameLabel')}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder={t('mrShopNamePlaceholder')}
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrOwnerNameLabel')}
                </label>
                <input
                  type="text"
                  name="owner_name"
                  required
                  placeholder={t('mrOwnerPlaceholder')}
                  value={formData.owner_name}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>
            </div>

            {/* Category and Subcategory selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrCategoryLabel')}
                </label>
                <select
                  value={formData.category}
                  onChange={handleCategoryChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px', background: '#111111', color: '#FFFFFF' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.name}>
                      {translateCategory(c.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrSubcategoryLabel')}
                </label>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px', background: '#111111', color: '#FFFFFF' }}
                >
                  {selectedCategoryObj.subcategories.map(sub => (
                    <option key={sub} value={sub}>
                      {translateSubcategory(sub)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#D4AF37', margin: '12px 0 4px 0', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px' }}>
              {t('mrSec2Title')}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('emailAddress')} *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="merchant@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mobileNumber')} *
                </label>
                <input
                  type="tel"
                  name="mobile_number"
                  required
                  placeholder={t('mobileNumberPlaceholder')}
                  value={formData.mobile_number}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('createPassword')} *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder={t('min8CharsShortPlaceholder')}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('confirmPassword')} *
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  required
                  placeholder={t('confirmPassword')}
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#D4AF37', margin: '12px 0 4px 0', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px' }}>
              {t('mrSec3Title')}
            </h3>

            <div>
              <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                {t('mrFullAddressLabel')}
              </label>
              <input
                type="text"
                name="address"
                required
                placeholder={t('mrFullAddressPlaceholder')}
                value={formData.address}
                onChange={handleInputChange}
                className="form-input"
                style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrAreaLocalityLabel')}
                </label>
                <input
                  type="text"
                  name="area_locality"
                  placeholder={t('mrAreaPlaceholder')}
                  value={formData.area_locality}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrCityLabel')}
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrPinCodeLabel')}
                </label>
                <input
                  type="text"
                  name="pincode"
                  required
                  placeholder={t('mrPinPlaceholder')}
                  value={formData.pincode}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>
            </div>

            {/* GPS Coordinates & Current Location Button */}
            <div style={{ background: '#151515', padding: '14px', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>{t('mrGpsHeading')}</span>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#222222', border: '1px solid rgba(212,175,55,0.3)', color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Navigation size={12} color="#F2D675" />
                  {gettingLocation ? t('locLocating') : t('mrUseMyGpsBtn')}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  placeholder={t('mrLatPlaceholder')}
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ borderRadius: '8px', padding: '8px', fontSize: '12px' }}
                />
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  placeholder={t('mrLngPlaceholder')}
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ borderRadius: '8px', padding: '8px', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Photo Uploads */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrShopLogoOptional')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload('logo_url', e)}
                  style={{ fontSize: '11px', color: '#888888' }}
                />
                {formData.logo_url && (
                  <img src={resolveMediaUrl(formData.logo_url)} alt={t('logoPreviewAlt')} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', marginTop: '6px' }} />
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t('mrCoverPhotoOptional')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload('cover_photo_url', e)}
                  style={{ fontSize: '11px', color: '#888888' }}
                />
                {formData.cover_photo_url && (
                  <img src={resolveMediaUrl(formData.cover_photo_url)} alt={t('coverPreviewAlt')} style={{ width: '80px', height: '48px', borderRadius: '8px', objectFit: 'cover', marginTop: '6px' }} />
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setMode('choice')}
                className="btn-secondary"
                style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
              >
                {t('backLabel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ flex: 2, padding: '12px', justifyContent: 'center' }}
              >
                {submitting ? t('mrSubmittingApp') : t('mrSubmitAppFree')}
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: APPLICATION SUBMITTED CONFIRMATION */}
        {mode === 'submitted' && (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle2 size={36} color="#10b981" />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF', marginBottom: '8px' }}>
              {t('mrSubmittedTitle')}
            </h3>

            <p style={{ fontSize: '13.5px', color: '#B8B8B8', lineHeight: 1.6, marginBottom: '20px' }}>
              {t('mrSubmittedBody', { shopName: successInfo?.shopName || '' })}
            </p>

            <div style={{ background: '#151515', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '16px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '13px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#888888' }}>{t('mrAppStatusLabel')}</span>
                <span style={{ color: '#F2D675', fontWeight: 800, marginLeft: '8px' }}>{t('mrPendingAdminReview')}</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#888888' }}>{t('mrAssignedCodeLabel')}</span>
                <span style={{ color: '#FFFFFF', fontWeight: 800, marginLeft: '8px' }}>{successInfo?.shopCode}</span>
              </div>
              <div>
                <span style={{ color: '#888888' }}>{t('mrNoticeLabel')}</span>
                <span style={{ color: '#B8B8B8', marginLeft: '8px' }}>
                  {t('mrSubmittedNotice')}
                </span>
              </div>
            </div>

            <Link
              to="/shop/login"
              className="btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                justifyContent: 'center',
                textDecoration: 'none',
                display: 'inline-flex'
              }}
            >
              {t('mrGoToSignIn')} <ArrowRight size={16} color="#050505" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
