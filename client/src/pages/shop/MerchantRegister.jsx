import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import MerchantMap from '../../components/MerchantMap';
import { Store, User, Mail, Phone, MapPin, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function MerchantRegister() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [ownerName, setOwnerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Restaurant');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState({ lat: 18.5204, lng: 73.8567 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSendOtp = async () => {
    if (!mobile) return setError('Please enter mobile number');
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

  const handleVerifyOtp = async () => {
    if (!otpCode) return;
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp_code: otpCode })
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setOtpVerified(true);
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setAddress(`GPS Position (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}), Main Street`);
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/merchant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: ownerName,
          shop_name: shopName,
          mobile,
          email,
          category,
          address,
          latitude: location.lat,
          longitude: location.lng,
          password
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Merchant registration failed');
      }

      setSuccessMsg(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
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
        maxWidth: '560px',
        width: '100%',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '12px'
          }}>
            <Store size={30} />
          </div>
          <h2 style={{ fontSize: '24px', color: '#0f172a', marginBottom: '4px' }}>Register Merchant / Store</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Register your physical store location & manage customer reward discounts
          </p>
        </div>

        {successMsg ? (
          <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', padding: '24px', borderRadius: '18px', textAlign: 'center' }}>
            <CheckCircle2 size={42} color="#059669" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#065f46', marginBottom: '8px' }}>Registration Submitted!</h3>
            <p style={{ fontSize: '14px', color: '#047857', marginBottom: '20px' }}>{successMsg}</p>
            <Link to="/shop/login" className="btn-success" style={{ padding: '12px 24px', fontSize: '14px', textDecoration: 'none', display: 'inline-flex' }}>
              Proceed to Merchant Login →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Owner Full Name</label>
              <input type="text" required className="form-input" placeholder="e.g. Rahul Sharma" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Shop / Business Name</label>
              <input type="text" required className="form-input" placeholder="e.g. Royal Sweets & Bakers" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            </div>

            {/* Mobile & OTP Section */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Mobile Number (OTP Verification)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="tel" required className="form-input" placeholder="9876543210" value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={otpVerified} />
                <button type="button" onClick={handleSendOtp} disabled={otpVerified} className="btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '0 12px' }}>
                  {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>

              {otpSent && !otpVerified && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input type="text" className="form-input" placeholder="Enter 123456" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                  <button type="button" onClick={handleVerifyOtp} className="btn-success" style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '0 12px' }}>
                    Verify
                  </button>
                </div>
              )}

              {otpVerified && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, marginTop: '4px', display: 'block' }}>✅ Mobile Number Verified</span>}
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Business Category</label>
              <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Restaurant">Restaurant & Food</option>
                <option value="Clothing">Clothing & Apparel</option>
                <option value="Paithani">Paithani & Sarees</option>
                <option value="Salon">Salon & Beauty Spa</option>
                <option value="Grocery">Grocery & Supermarket</option>
                <option value="Jewellery">Jewellery Store</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Shop Email</label>
              <input type="email" required className="form-input" placeholder="shop@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Shop Physical Address</label>
              <input type="text" required className="form-input" placeholder="Shop #12, Main Market, FC Road, Pune" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            {/* GPS Location Pin Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Shop Location Pin on Map</label>
                <button type="button" onClick={handleUseCurrentLocation} style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                  📍 Use Current GPS Location
                </button>
              </div>
              <div style={{ height: '220px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                <MerchantMap
                  userLat={location.lat}
                  userLng={location.lng}
                  isPinDropMode={true}
                  onPinDropped={(lat, lng) => setLocation({ lat, lng })}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Password</label>
              <input type="password" required className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button type="submit" disabled={loading} className="btn-success" style={{ width: '100%', padding: '16px', fontSize: '15px', marginTop: '8px', justifyContent: 'center' }}>
              {loading ? 'Submitting Registration...' : 'Submit Merchant Registration'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <div style={{ marginTop: '20px', textCenter: 'center', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
          Already have a Merchant Account? <Link to="/shop/login" style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none' }}>Sign In →</Link>
        </div>
      </div>
    </div>
  );
}
