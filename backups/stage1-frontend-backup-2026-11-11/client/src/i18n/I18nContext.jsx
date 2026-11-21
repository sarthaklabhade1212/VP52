import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('rewards_lang') || 'en';
  });

  const setLang = (newLang) => {
    if (['en', 'hi', 'mr'].includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('rewards_lang', newLang);
    }
  };

  const t = (key) => {
    if (translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    if (translations['en'] && translations['en'][key]) {
      return translations['en'][key];
    }
    return key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
