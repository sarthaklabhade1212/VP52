import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, Trash2, CheckCircle2, Lock } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useI18n } from '../i18n/I18nContext';
import vp52Logo from '../assets/vp52-logo.png';

export default function PrivacyPolicy() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#E0E0E0', padding: '24px 16px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {/* Top Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#D4AF37',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700
            }}
          >
            <ArrowLeft size={16} /> {t('navHome')}
          </Link>
          <LanguageSwitcher tone="dark" compact={true} />
        </div>

        {/* Header Hero */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src={vp52Logo}
            alt="VP52"
            style={{
              width: '88px',
              height: '88px',
              objectFit: 'contain',
              marginBottom: '16px',
              filter: 'drop-shadow(0 6px 20px rgba(212, 175, 55, 0.3))'
            }}
          />
          <h1 style={{ fontSize: '28px', color: '#FFFFFF', fontWeight: 800, margin: '0 0 8px 0' }}>
            {t('privacyPolicyTitle')}
          </h1>
          <p style={{ fontSize: '14px', color: '#A0A0A0', margin: 0 }}>
            {t('privacyLastUpdated')}
          </p>
        </div>

        {/* Operator Identification Notice */}
        <div style={{
          background: '#111111',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '28px'
        }}>
          <h2 style={{ fontSize: '18px', color: '#F2D675', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="#D4AF37" /> {t('privacyOperatorHeading')}
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#CCCCCC' }}>
            {t('privacyOperatorBody')}
          </p>
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#D4AF37' }}>
            {t('privacyContactEmail')} <a href="mailto:shindesanket.vp52@gmail.com" style={{ color: '#F2D675', textDecoration: 'underline' }}>shindesanket.vp52@gmail.com</a>
          </div>
        </div>

        {/* Section 1: Data We Collect */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            {t('privacySec1Heading')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#111111', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <strong style={{ color: '#F2D675', fontSize: '15px' }}>{t('privacyAccountInfoTitle')}</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.5', color: '#B8B8B8' }}>
                {t('privacyAccountInfoBody')}
              </p>
            </div>

            <div style={{ background: '#111111', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <strong style={{ color: '#F2D675', fontSize: '15px' }}>{t('privacyLocationInfoTitle')}</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.5', color: '#B8B8B8' }}>
                {t('privacyLocationInfoBody')}
              </p>
            </div>

            <div style={{ background: '#111111', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <strong style={{ color: '#F2D675', fontSize: '15px' }}>{t('privacyRewardInfoTitle')}</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.5', color: '#B8B8B8' }}>
                {t('privacyRewardInfoBody')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: How Data is Used */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            {t('privacySec2Heading')}
          </h2>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.7', color: '#B8B8B8' }}>
            <li>{t('privacySec2Bullet1')}</li>
            <li>{t('privacySec2Bullet2')}</li>
            <li>{t('privacySec2Bullet3')}</li>
            <li>{t('privacySec2Bullet4')}</li>
            <li>{t('privacySec2Bullet5')}</li>
          </ul>
        </div>

        {/* Section 3: Data Sharing & Third Parties */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            {t('privacySec3Heading')}
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#B8B8B8' }}>
            {t('privacySec3Intro')}
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.7', color: '#B8B8B8' }}>
            <li><strong>{t('privacySec3GoogleTitle')}</strong> {t('privacySec3GoogleBody')}</li>
            <li><strong>{t('privacySec3MerchantTitle')}</strong> {t('privacySec3MerchantBody')}</li>
          </ul>
        </div>

        {/* Section 4: Data Retention & Account Deletion */}
        <div style={{
          background: '#151515',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '28px'
        }}>
          <h2 style={{ fontSize: '18px', color: '#f87171', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={20} color="#f87171" /> {t('privacySec4Heading')}
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#E0E0E0', marginBottom: '12px' }}>
            {t('privacySec4Intro')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#CCCCCC' }}>
            <div>
              <strong>{t('privacySec4Opt1Title')}</strong> {t('privacySec4Opt1Body')}
            </div>
            <div>
              <strong>{t('privacySec4Opt2Title')}</strong> {t('privacySec4Opt2Body')}
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <Link
              to="/delete-account"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#dc2626',
                color: '#FFFFFF',
                padding: '10px 18px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <Trash2 size={16} /> {t('privacyRequestDeleteBtn')}
            </Link>
          </div>
          <p style={{ fontSize: '12px', color: '#888888', marginTop: '12px', margin: '12px 0 0 0' }}>
            {t('privacySec4Footnote')}
          </p>
        </div>

        {/* Section 5: Security */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
            {t('privacySec5Heading')}
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#B8B8B8' }}>
            {t('privacySec5Body')}
          </p>
        </div>

        {/* Section 6: Contact & Operator Details */}
        <div style={{
          background: '#111111',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '18px', color: '#FFFFFF', fontWeight: 700, marginBottom: '6px' }}>
            {t('privacyQuestionsTitle')}
          </h2>
          <p style={{ fontSize: '13px', color: '#B8B8B8', marginBottom: '14px' }}>
            {t('privacyQuestionsSub')}
          </p>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#F2D675' }}>
            {t('privacyDevCredit')}
          </div>
          <div style={{ fontSize: '13px', color: '#A0A0A0', marginTop: '4px' }}>
            {t('emailAddress')}: <a href="mailto:shindesanket.vp52@gmail.com" style={{ color: '#D4AF37' }}>shindesanket.vp52@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
