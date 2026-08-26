import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Gift, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';

export default function WelcomeScreen() {
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
        maxWidth: '480px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '28px',
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative'
      }}>
        {/* Language Selection Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <LanguageSwitcher tone="light" />
        </div>

        {/* App Logo */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 12px 30px rgba(79, 70, 229, 0.4)',
          marginBottom: '20px'
        }}>
          <Gift size={38} />
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          {t('welcomeTitle')}
        </h1>

        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', lineHeight: 1.5, padding: '0 10px' }}>
          {t('welcomeSubtitle')}
        </p>

        {/* Feature Badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '14px', fontSize: '12px', color: '#15803d', fontWeight: 700 }}>
            ✨ {t('watchEarn')}
          </div>
          <div style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', padding: '12px', borderRadius: '14px', fontSize: '12px', color: '#3730a3', fontWeight: 700 }}>
            🏬 {t('benefitsNearYou')}
          </div>
        </div>

        <button
          onClick={() => navigate('/user-type-selection')}
          className="btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '14px', justifyContent: 'center' }}
        >
          {t('getStarted')} <ArrowRight size={20} />
        </button>

        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
          <ShieldCheck size={16} color="#10b981" />
          <span>{t('productionReadyMultiLang')}</span>
        </div>
      </div>
    </div>
  );
}
