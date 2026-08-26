import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { Gift, Store, ArrowRight, ArrowLeft } from 'lucide-react';

export default function UserTypeSelection() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '28px',
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <button
          onClick={() => navigate('/welcome')}
          style={{
            border: 'none', background: 'none', color: '#64748b', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '16px'
          }}
        >
          <ArrowLeft size={16} /> {t('backToWelcome')}
        </button>

        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
          {t('whoAreYou')}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px' }}>
          {t('selectRoleDescription')}
        </p>

        {/* 2 Role Choice Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          {/* Customer Choice Card */}
          <div
            onClick={() => navigate('/customer/login')}
            style={{
              background: '#f8fafc',
              border: '2px solid #e0e7ff',
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
                width: '48px', height: '48px', borderRadius: '14px', background: '#e0e7ff', color: '#4f46e5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Gift size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{t('customerRole')}</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{t('customerDesc')}</p>
              </div>
            </div>
            <ArrowRight size={20} color="#4f46e5" />
          </div>

          {/* Merchant Choice Card */}
          <div
            onClick={() => navigate('/shop/login')}
            style={{
              background: '#f8fafc',
              border: '2px solid #a7f3d0',
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
                width: '48px', height: '48px', borderRadius: '14px', background: '#dcfce7', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Store size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{t('merchantRole')}</h3>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{t('merchantDesc')}</p>
              </div>
            </div>
            <ArrowRight size={20} color="#059669" />
          </div>
        </div>

        {/* Admin Link */}
        <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
          <button
            onClick={() => navigate('/admin/login')}
            style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('adminSignInPrompt')}
          </button>
        </div>
      </div>

      <style>{`
        .hover-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.06);
        }
      `}</style>
    </div>
  );
}
