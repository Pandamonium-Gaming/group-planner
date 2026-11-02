'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Language = 'en-GB' | 'es' | 'nl';

interface Translations {
  [key: string]: string | Translations;
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Detect browser language
function detectBrowserLanguage(): Language {
  if (typeof window === 'undefined') return 'en-GB';
  
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en-GB';
  const langCode = browserLang.toLowerCase();
  
  // Match en-GB, en-gb, or just 'en' to British English
  if (langCode.startsWith('en')) return 'en-GB';
  if (langCode.startsWith('es')) return 'es';
  
  return 'en-GB'; // Default fallback
}

// Get nested value from object using dot notation
function getNestedValue(obj: Translations, path: string): string | undefined {
  const keys = path.split('.');
  let current: string | Translations = obj;
  
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = current[key];
  }
  
  return typeof current === 'string' ? current : undefined;
}

// Replace {{param}} with values
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en-GB');
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load translations for a language
  const loadTranslations = useCallback(async (lang: Language) => {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error('Failed to load translations');
      const data = await response.json();
      setTranslations(data);
    } catch (error) {
      console.error('Error loading translations:', error);
      // Fallback to empty object
      setTranslations({});
    }
  }, []);

  // Initialize language from localStorage or browser
  useEffect(() => {
    const init = async () => {
      // Check localStorage first
      const stored = localStorage.getItem('language') as Language | null;
      const initialLang = stored || detectBrowserLanguage();
      
      setLanguageState(initialLang);
      await loadTranslations(initialLang);
      setIsLoading(false);
    };
    
    init();
  }, [loadTranslations]);

  // Set language and persist
  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    await loadTranslations(lang);
  }, [loadTranslations]);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(translations, key);
    if (!value) {
      // Return key as fallback (useful for development)
      console.warn(`Missing translation: ${key}`);
      return key.split('.').pop() || key;
    }
    return interpolate(value, params);
  }, [translations]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Language options for UI
export const LANGUAGES = [
  { code: 'en-GB' as Language, name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
  { code: 'nl' as Language, name: 'Nederlands', flag: '🇳🇱' },
];
