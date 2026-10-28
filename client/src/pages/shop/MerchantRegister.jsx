import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import { ArrowRight } from 'lucide-react';
import vp52Logo from '../../assets/vp52-logo.png';

export default function MerchantRegister() {
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
        background: '#111111',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        borderRadius: '24px',
        maxWidth: '480px',
        width: '100%',
        padding: '36px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        textAlign: 'center'
      }}>
        <img
          src={vp52Logo}
          alt="VP52 Logo"
          draggable="false"
          style={{
            width: '92px',
            height: '92px',
            objectFit: 'contain',
            display: 'inline-block',
            marginBottom: '16px',
            filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
          }}
        />

        <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '12px', fontWeight: 800 }}>
          {t('merchantRegDisabledTitle')}
        </h2>

        <p style={{ fontSize: '14px', color: '#B8B8B8', lineHeight: 1.6, marginBottom: '28px' }}>
          {t('merchantRegDisabledBody')}
        </p>

        <Link
          to="/shop/login"
          className="btn-primary"
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '15px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {t('goToMerchantLogin')}
          <ArrowRight size={18} color="#050505" />
        </Link>
      </div>
    </div>
  );
}
