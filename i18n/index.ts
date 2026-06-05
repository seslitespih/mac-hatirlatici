import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import tr from './locales/tr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';
import it from './locales/it.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe',    flag: '🇹🇷' },
  { code: 'en', name: 'English',   flag: '🇬🇧' },
  { code: 'es', name: 'Español',   flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français',  flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch',   flag: '🇩🇪' },
  { code: 'ar', name: 'العربية',   flag: '🇸🇦' },
  { code: 'it', name: 'Italiano',  flag: '🇮🇹' },
];

export const LANGUAGE_STORAGE_KEY  = '@app_language';
export const COUNTRY_STORAGE_KEY   = '@app_country';
export const FIRST_LAUNCH_KEY      = '@app_first_launch';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar },
  it: { translation: it },
};

// Desteklenen dil kodları
const SUPPORTED_CODES = new Set(Object.keys(resources));

// Bölgesel dil etiketi → kısa dil kodu
const LOCALE_TO_LANG: Record<string, string> = {
  'tr': 'tr', 'tr-TR': 'tr', 'tr-CY': 'tr',
  'en': 'en', 'en-GB': 'en', 'en-US': 'en', 'en-NG': 'en', 'en-ZA': 'en', 'en-GH': 'en',
  'es': 'es', 'es-ES': 'es', 'es-AR': 'es', 'es-MX': 'es', 'es-CO': 'es', 'es-CL': 'es',
  'pt': 'pt', 'pt-PT': 'pt', 'pt-BR': 'pt',
  'fr': 'fr', 'fr-FR': 'fr', 'fr-SN': 'fr', 'fr-CI': 'fr', 'fr-MA': 'fr', 'fr-BE': 'fr',
  'de': 'de', 'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
  'ar': 'ar', 'ar-SA': 'ar', 'ar-EG': 'ar', 'ar-MA': 'ar', 'ar-DZ': 'ar', 'ar-TN': 'ar',
  'it': 'it', 'it-IT': 'it',
};

// Bölgesel locale → ülke kodu (ilk açılışta ülke tahmini için)
const LOCALE_TO_COUNTRY: Record<string, string> = {
  'tr': 'TR', 'tr-TR': 'TR',
  'en-GB': 'GB', 'en-NG': 'NG',
  'es-ES': 'ES', 'es-AR': 'AR', 'es-MX': 'MX',
  'pt-PT': 'PT', 'pt-BR': 'BR',
  'fr-FR': 'FR', 'fr-SN': 'SN',
  'de': 'DE', 'de-DE': 'DE',
  'ar-SA': 'SA', 'ar-EG': 'EG', 'ar-MA': 'MA',
  'it': 'IT', 'it-IT': 'IT',
};

function detectDeviceLanguage(): string {
  const locales = Localization.getLocales?.() ?? [];
  for (const loc of locales) {
    const tag = loc.languageTag ?? '';
    if (LOCALE_TO_LANG[tag]) return LOCALE_TO_LANG[tag];
    const base = tag.split('-')[0];
    if (LOCALE_TO_LANG[base]) return LOCALE_TO_LANG[base];
  }
  return 'en';
}

function detectDeviceCountry(): string | null {
  const locales = Localization.getLocales?.() ?? [];
  for (const loc of locales) {
    const tag = loc.languageTag ?? '';
    if (LOCALE_TO_COUNTRY[tag]) return LOCALE_TO_COUNTRY[tag];
    // Bölge kodu varsa
    const region = loc.regionCode ?? '';
    if (region) {
      const byRegion: Record<string, string> = {
        TR: 'TR', GB: 'GB', ES: 'ES', PT: 'PT', FR: 'FR', DE: 'DE', IT: 'IT',
        SA: 'SA', AE: 'SA', KW: 'SA', QA: 'SA', BH: 'SA', OM: 'SA',
        BR: 'BR', AR: 'AR', MX: 'MX', EG: 'EG', NG: 'NG', MA: 'MA', SN: 'SN',
      };
      if (byRegion[region]) return byRegion[region];
    }
  }
  return null;
}

export async function initI18n(): Promise<{ detectedCountry: string | null }> {
  let savedLanguage: string | null = null;
  let detectedCountry: string | null = null;

  try {
    const isFirstLaunch = !(await AsyncStorage.getItem(FIRST_LAUNCH_KEY));

    if (isFirstLaunch) {
      // İlk açılış: cihaz dilinden otomatik tespit
      savedLanguage = detectDeviceLanguage();
      detectedCountry = detectDeviceCountry();
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, savedLanguage);
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'done');
      if (detectedCountry) {
        await AsyncStorage.setItem(COUNTRY_STORAGE_KEY, detectedCountry);
      }
    } else {
      // Sonraki açılışlar: kayıtlı dili kullan
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      savedLanguage = stored && SUPPORTED_CODES.has(stored) ? stored : 'en';
    }
  } catch (_) {
    savedLanguage = 'en';
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: savedLanguage ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

  return { detectedCountry };
}

export async function changeLanguage(lang: string): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (_) {}
}

export default i18n;
