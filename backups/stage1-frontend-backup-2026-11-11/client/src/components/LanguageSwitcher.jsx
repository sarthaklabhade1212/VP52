import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

// Reusable language selector used across all three dashboards + auth/landing.
// It is intentionally thin: it reuses the SINGLE existing i18n system
// (useI18n -> setLang), which already persists the choice to
// localStorage['rewards_lang'] and live-updates the whole React tree.
//
// Switching language here does NOT touch AuthContext, tokens, navigation,
// selected shop, chat, location or reward data — it only changes `lang`.
//
// Props:
//   tone: 'light' (default, for white/light headers) | 'dark' (for dark headers)
//   compact: tighter padding/sizing for crowded headers
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' }
];

export default function LanguageSwitcher({ tone = 'light', compact = false }) {
  const { lang, setLang, t } = useI18n();
  const isDark = tone === 'dark';

  return (
    <div
      title={t('language')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: isDark ? 'rgba(255,255,255,0.12)' : '#f8fafc',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.28)' : '#cbd5e1'}`,
        borderRadius: '99px',
        padding: compact ? '4px 8px' : '6px 10px'
      }}
    >
      <Globe size={compact ? 14 : 16} color={isDark ? '#e2e8f0' : '#64748b'} />
      <select
        aria-label={t('language')}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: compact ? '12px' : '13px',
          fontWeight: 700,
          color: isDark ? '#ffffff' : '#0f172a',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          paddingRight: '2px'
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} style={{ color: '#0f172a' }}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
