import React from 'react';
import { Link } from 'react-router-dom';
import { Store, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { APP_NAME } from '../config/brand';
import vp52Logo from '../assets/vp52-logo.png';

export default function LoginSelector() {
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
        maxWidth: '960px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Header Branding */}
        <div style={{ marginBottom: '36px' }}>
          <img
            src={vp52Logo}
            alt="VP52 Logo"
            draggable="false"
            style={{
              width: '96px',
              height: '96px',
              objectFit: 'contain',
              display: 'inline-block',
              marginBottom: '16px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          <h1 style={{ fontSize: '34px', color: '#FFFFFF', marginBottom: '8px', letterSpacing: '0.02em' }}>
            {APP_NAME} <span style={{ color: '#F2D675' }}>{t('portalSelection')}</span>
          </h1>
          <p style={{ fontSize: '15px', color: '#B8B8B8', maxWidth: '500px', margin: '0 auto' }}>
            {t('portalSelectionSubtitle')}
          </p>
        </div>

        {/* 3 Portal Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          textAlign: 'left'
        }}>
          {/* 1. Customer Login Card */}
          <div style={{
            background: '#111111',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9)'
          }}>
            <div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <img src={vp52Logo} alt="VP52" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
              </div>
              <span className="badge badge-active" style={{ marginBottom: '8px' }}>{t('customerRoleBadge')}</span>
              <h3 style={{ fontSize: '20px', color: '#FFFFFF', marginBottom: '6px' }}>{t('customerAppTitle')}</h3>
              <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '20px', lineHeight: 1.5 }}>
                {t('customerAppDesc')}
              </p>
            </div>

            <Link to="/customer/login" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', textDecoration: 'none' }}>
              {t('customerSignIn')} <ArrowRight size={16} color="#050505" />
            </Link>
          </div>

          {/* 2. Shop / Merchant Login Card */}
          <div style={{
            background: '#111111',
            border: '1px solid #D4AF37',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9)'
          }}>
            <div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #C9A227 0%, #F2D675 100%)', color: '#050505',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <Store size={26} color="#050505" />
              </div>
              <span className="badge badge-active" style={{ marginBottom: '8px' }}>{t('shopMerchantBadge')}</span>
              <h3 style={{ fontSize: '20px', color: '#FFFFFF', marginBottom: '6px' }}>{t('shopPortalTitle')}</h3>
              <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '20px', lineHeight: 1.5 }}>
                {t('shopPortalDesc')}
              </p>
            </div>

            <Link to="/shop/login" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', textDecoration: 'none', justifyContent: 'center' }}>
              {t('shopMerchantSignIn')} <ArrowRight size={16} color="#050505" />
            </Link>
          </div>

          {/* 3. Admin Login Card */}
          <div style={{
            background: '#111111',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '24px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9)'
          }}>
            <div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: '#151515', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#D4AF37',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <Shield size={26} color="#D4AF37" />
              </div>
              <span className="badge" style={{ background: '#151515', color: '#F2D675', border: '1px solid rgba(212, 175, 55, 0.3)', marginBottom: '8px' }}>{t('adminRole')}</span>
              <h3 style={{ fontSize: '20px', color: '#FFFFFF', marginBottom: '6px' }}>{t('adminDashboardTitle')}</h3>
              <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '20px', lineHeight: 1.5 }}>
                {t('adminDashboardDesc')}
              </p>
            </div>

            <Link to="/admin/login" className="btn-secondary" style={{ width: '100%', padding: '14px', fontSize: '14px', textDecoration: 'none', justifyContent: 'center' }}>
              {t('adminSignIn')} <ArrowRight size={16} color="#D4AF37" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
