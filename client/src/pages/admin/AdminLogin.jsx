import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { APP_NAME } from '../../config/brand';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import vp52Logo from '../../assets/vp52-logo.png';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginAdmin(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
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
      padding: '24px'
    }}>
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
          <h2 style={{ fontSize: '24px', color: '#FFFFFF', marginBottom: '4px' }}>{t('adminManagementPortal')}</h2>
          <p style={{ fontSize: '13px', color: '#B8B8B8' }}>
            {t('authorizedAdminOnly')}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#B8B8B8', marginBottom: '4px', display: 'block' }}>{t('adminEmail')}</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#C9A227" style={{ position: 'absolute', left: '14px', top: '16px' }} />
              <input
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            {loading ? t('authenticatingAdmin') : t('signInToAdminDashboard')}
            <ArrowRight size={18} color="#050505" />
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', textAlign: 'center' }}>
          <Link to="/customer/login" style={{ color: '#D4AF37', fontSize: '13px', textDecoration: 'none', fontWeight: 700 }}>
            {t('switchToCustomerLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
