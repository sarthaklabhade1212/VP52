import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CATEGORIES } from '../../config/categories';
import { getCurrentLocation } from '../../utils/location';
import { signInWithGoogle } from '../../utils/googleAuth';
import vp52Logo from '../../assets/vp52-logo.png';
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
      alert('Unable to fetch GPS location: ' + err.message);
    } finally {
      setGettingLocation(false);
    }
  };

  // Upload Logo or Cover Image
  const handleImageUpload = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const res = await fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: evt.target.result, folder: 'merchant' })
        });
        const data = await res.json();
        if (data.success && data.url) {
          setFormData(prev => ({ ...prev, [field]: data.url }));
        }
      } catch (err) {
        console.error('Upload failed', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // 1. Google Sign-In for Merchants
  const handleGoogleMerchantAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) {
        throw new Error('Google Sign-In was cancelled or failed to return a valid token.');
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
        setError(data.error || 'Google merchant onboarding failed.');
      }
    } catch (err) {
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. Form Self-Registration
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password && formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
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
        setError(data.error || 'Registration failed. Please check the fields and try again.');
      }
    } catch (err) {
      setError(err.message || 'Network error during registration');
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
      color: '#FFFFFF'
    }}>
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
            VP52 Merchant Registration
          </h2>
          <span style={{ fontSize: '12px', color: '#F2D675', fontWeight: 700, display: 'inline-block', marginTop: '4px' }}>
            ✨ 100% FREE • Zero Setup Cost • Zero Subscription Fees
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
              Register your local shop, restaurant, clinic, or service on VP52. Reach thousands of customers and offer direct VP52 coin discounts.
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
              {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', color: '#666666', fontSize: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ padding: '0 10px', fontWeight: 600 }}>OR REGISTER WITH EMAIL</span>
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
              Fill Registration Form <ArrowRight size={16} color="#050505" />
            </button>

            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <span style={{ fontSize: '13px', color: '#B8B8B8' }}>Already have a registered shop? </span>
              <Link to="/shop/login" style={{ color: '#F2D675', fontWeight: 800, textDecoration: 'none', fontSize: '13px' }}>
                Sign In Here
              </Link>
            </div>
          </div>
        )}

        {/* MODE 2: REGISTRATION FORM */}
        {mode === 'form' && (
          <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#D4AF37', margin: '0 0 4px 0', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px' }}>
              1. Business Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Shop / Business Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Royal Sweets & Bakery"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Owner / Contact Person *
                </label>
                <input
                  type="text"
                  name="owner_name"
                  required
                  placeholder="e.g. Rahul Sharma"
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
                  Category (17 Master Categories) *
                </label>
                <select
                  value={formData.category}
                  onChange={handleCategoryChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px', background: '#111111', color: '#FFFFFF' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Subcategory *
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
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#D4AF37', margin: '12px 0 4px 0', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px' }}>
              2. Credentials & Contact
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Email Address *
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
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  name="mobile_number"
                  required
                  placeholder="e.g. 9876543210"
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
                  Create Password *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  required
                  placeholder="Confirm password"
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#D4AF37', margin: '12px 0 4px 0', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px' }}>
              3. Physical Address & Location
            </h3>

            <div>
              <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Full Street Address *
              </label>
              <input
                type="text"
                name="address"
                required
                placeholder="Shop No. 5, Galaxy Plaza, Main Road"
                value={formData.address}
                onChange={handleInputChange}
                className="form-input"
                style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Area / Locality
                </label>
                <input
                  type="text"
                  name="area_locality"
                  placeholder="e.g. Kothrud"
                  value={formData.area_locality}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  City *
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
                  PIN Code *
                </label>
                <input
                  type="text"
                  name="pincode"
                  required
                  placeholder="e.g. 411038"
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
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFFFFF' }}>GPS Coordinates (For Customer Distance Search)</span>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  style={{ padding: '6px 12px', borderRadius: '8px', background: '#222222', border: '1px solid rgba(212,175,55,0.3)', color: '#F2D675', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Navigation size={12} color="#F2D675" />
                  {gettingLocation ? 'Locating...' : 'Use My GPS Location'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  placeholder="Latitude (e.g. 18.5204)"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="form-input"
                  style={{ borderRadius: '8px', padding: '8px', fontSize: '12px' }}
                />
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  placeholder="Longitude (e.g. 73.8567)"
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
                  Shop Logo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload('logo_url', e)}
                  style={{ fontSize: '11px', color: '#888888' }}
                />
                {formData.logo_url && (
                  <img src={formData.logo_url} alt="Logo preview" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', marginTop: '6px' }} />
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#B8B8B8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Cover Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload('cover_photo_url', e)}
                  style={{ fontSize: '11px', color: '#888888' }}
                />
                {formData.cover_photo_url && (
                  <img src={formData.cover_photo_url} alt="Cover preview" style={{ width: '80px', height: '48px', borderRadius: '8px', objectFit: 'cover', marginTop: '6px' }} />
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
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ flex: 2, padding: '12px', justifyContent: 'center' }}
              >
                {submitting ? 'Submitting Application...' : 'Submit Application (Free)'}
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
              Application Submitted!
            </h3>

            <p style={{ fontSize: '13.5px', color: '#B8B8B8', lineHeight: 1.6, marginBottom: '20px' }}>
              Your merchant application for <strong style={{ color: '#F2D675' }}>{successInfo?.shopName}</strong> has been registered successfully.
            </p>

            <div style={{ background: '#151515', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '16px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '13px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#888888' }}>Application Status:</span>
                <span style={{ color: '#F2D675', fontWeight: 800, marginLeft: '8px' }}>⏳ Pending Admin Review</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#888888' }}>Assigned Code:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 800, marginLeft: '8px' }}>{successInfo?.shopCode}</span>
              </div>
              <div>
                <span style={{ color: '#888888' }}>Notice:</span>
                <span style={{ color: '#B8B8B8', marginLeft: '8px' }}>
                  Our team verifies all physical stores to maintain platform quality. You can sign in to your dashboard to manage products and setup hours while review is in progress.
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
              Go to Merchant Sign In <ArrowRight size={16} color="#050505" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
