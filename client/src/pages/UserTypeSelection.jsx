import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { Store, ArrowRight, ArrowLeft } from 'lucide-react';
import vp52Logo from '../assets/vp52-logo.png';

export default function UserTypeSelection() {
  const navigate = useNavigate();
  const { t } = useI18n();

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
        maxWidth: '520px',
        width: '100%',
        background: '#111111',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        borderRadius: '28px',
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 20px rgba(212, 175, 55, 0.08)'
      }}>
        <button
          onClick={() => navigate('/welcome')}
          style={{
            border: 'none', background: 'none', color: '#D4AF37', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '16px'
          }}
        >
          <ArrowLeft size={16} color="#D4AF37" /> {t('backToWelcome')}
        </button>

        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
          {t('whoAreYou')}
        </h2>
        <p style={{ fontSize: '14px', color: '#B8B8B8', marginBottom: '28px' }}>
          {t('selectRoleDescription')}
        </p>

        {/* 2 Role Choice Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          {/* Customer Choice Card */}
          <div
            onClick={() => navigate('/customer/login')}
            style={{
              background: '#151515',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '20px',
              padding: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}
            className="hover-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: '#111111', border: '1px solid rgba(212, 175, 55, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <img src={vp52Logo} alt="VP52" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>{t('customerRole')}</h3>
                <p style={{ fontSize: '12px', color: '#B8B8B8', marginTop: '2px' }}>{t('customerDesc')}</p>
              </div>
            </div>
            <ArrowRight size={20} color="#D4AF37" />
          </div>

          {/* Merchant Choice Card */}
          <div
            onClick={() => navigate('/shop/login')}
            style={{
              background: '#151515',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '20px',
              padding: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease'
            }}
            className="hover-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.2)'
              }}>
                <Store size={26} color="#050505" />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>{t('merchantRole')}</h3>
                <p style={{ fontSize: '12px', color: '#B8B8B8', marginTop: '2px' }}>{t('merchantDesc')}</p>
              </div>
            </div>
            <ArrowRight size={20} color="#D4AF37" />
          </div>
        </div>

        {/* Admin Link */}
        <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid rgba(212, 175, 55, 0.15)' }}>
          <button
            onClick={() => navigate('/admin/login')}
            style={{ border: 'none', background: 'none', color: '#777777', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('adminSignInPrompt')}
          </button>
        </div>
      </div>

      <style>{`
        .hover-card:hover {
          transform: translateY(-2px);
          border-color: #D4AF37 !important;
          box-shadow: 0 10px 25px rgba(212, 175, 55, 0.15);
        }
      `}</style>
    </div>
  );
}
