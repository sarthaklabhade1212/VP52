import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import { ShieldCheck, ArrowRight } from 'lucide-react';

// Merchant self-registration is permanently disabled: merchant / shop accounts are
// created only by VP52 administrators. This screen replaces the old registration
// form with a clear notice and a single action to the (fully functional) merchant
// login. There is no remaining code path here that can create an account.
export default function MerchantRegister() {
  const { t } = useI18n();

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
        maxWidth: '480px',
        width: '100%',
        padding: '36px 32px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', marginBottom: '18px'
        }}>
          <ShieldCheck size={34} />
        </div>

        <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '12px', fontWeight: 800 }}>
          {t('merchantRegDisabledTitle')}
        </h2>

        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, marginBottom: '28px' }}>
          {t('merchantRegDisabledBody')}
        </p>

        <Link
          to="/shop/login"
          className="btn-success"
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
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
