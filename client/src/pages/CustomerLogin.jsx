import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gift, Lock, Mail, User, Phone, ArrowRight, Shield } from 'lucide-react';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { loginCustomer, registerCustomer } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const autofillDemoCustomer = () => {
    setFormData({
      full_name: 'Sarthak Labhade',
      email: 'customer@example.com',
      phone: '+91 98765 43210',
      password: 'Customer@123'
    });
    setIsRegister(false);
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)',
          marginBottom: '16px'
        }}>
          <Gift size={34} />
        </div>
        <h1 style={{ fontSize: '28px', color: '#0f172a', marginBottom: '6px' }}>Rewardify</h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          Watch Ads • Earn Points • Unlock Shop Discounts
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {isRegister && (
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Email Address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Mobile Number</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '16px' }} />
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
          {loading ? 'Please wait...' : (isRegister ? 'Create Account & Start Earning' : 'Sign In to Account')}
          <ArrowRight size={18} />
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
          style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
        >
          {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create Account"}
        </button>
      </div>

      {/* Switch to Admin Login Link */}
      <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <Link to="/admin/login" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <Shield size={16} color="#475569" /> Switch to Admin Portal Login →
        </Link>
      </div>
    </div>
  );
}
