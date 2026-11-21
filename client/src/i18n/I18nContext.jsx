import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { translations, translateCategoryName, translateSubcategoryName } from './translations';

const I18nContext = createContext();

const SUPPORTED_LANGS = ['en', 'hi', 'mr'];

function interpolate(template, params) {
  if (!params || typeof params !== 'object' || typeof template !== 'string') {
    return template;
  }
  return template.replace(/%\{([a-zA-Z0-9_]+)\}%|\{([a-zA-Z0-9_]+)\}/g, (match, pctKey, braceKey) => {
    const k = pctKey || braceKey;
    if (Object.prototype.hasOwnProperty.call(params, k)) {
      const val = params[k];
      return val === undefined || val === null ? '' : String(val);
    }
    return match;
  });
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('rewards_lang');
      return SUPPORTED_LANGS.includes(saved) ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (SUPPORTED_LANGS.includes(newLang)) {
      setLangState(newLang);
      try {
        localStorage.setItem('rewards_lang', newLang);
      } catch {
        // Ignore storage write errors in restricted contexts
      }
    }
  }, []);

  const t = useCallback(
    (key, params) => {
      const activeDict = translations[lang];
      const fallbackDict = translations.en;
      let template = key;

      if (activeDict && Object.prototype.hasOwnProperty.call(activeDict, key)) {
        template = activeDict[key];
      } else if (fallbackDict && Object.prototype.hasOwnProperty.call(fallbackDict, key)) {
        template = fallbackDict[key];
      }

      return interpolate(template, params);
    },
    [lang]
  );

  const translateCategory = useCallback(
    (name) => translateCategoryName(name, lang),
    [lang]
  );

  const translateSubcategory = useCallback(
    (name) => translateSubcategoryName(name, lang),
    [lang]
  );

  const locale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';

  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        locale,
        t,
        translateCategory,
        translateSubcategory,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
