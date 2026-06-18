import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { getCountry, saveCountry } from '../services/storageService';
import { guessCountryFromLanguage, SUPPORTED_COUNTRIES, CountryInfo } from '../constants/countryChannels';
import { COUNTRY_STORAGE_KEY, LANGUAGE_STORAGE_KEY } from '../i18n';

// Build 14: ülke + eski maç cache'i tek seferlik temizle
const MIGRATION_KEY = '@country_migrated_v14';

interface CountryCtx {
  countryCode: string;
  currentCountry: CountryInfo;
  changeCountry: (code: string) => Promise<void>;
  isLoading: boolean;
}

const CountryContext = createContext<CountryCtx>({
  countryCode: 'TR',
  currentCountry: SUPPORTED_COUNTRIES[0],
  changeCountry: async () => {},
  isLoading: true,
});

export function CountryProvider({ children }: { children: React.ReactNode }) {
  // useSuspense:false → CountryProvider'ın i18n henüz hazır değilse Suspend etmesini önler.
  // CountryProvider herhangi bir Suspense boundary'nin üstünde olduğundan Suspend atarsa
  // React "no Suspense ancestor" hatasına düşer.
  const { i18n } = useTranslation(undefined, { useSuspense: false });
  const [countryCode, setCountryCode] = useState<string>('TR');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Bir kerelik migrasyon: eski buildlerdeki stale TR kaydını sil
        // Böylece dil=İspanyolca olan kullanıcı artık TR değil ES görür
        const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
        if (!migrated) {
          // Ülke kaydını sıfırla (dil-ülke senkronu)
          await AsyncStorage.removeItem(COUNTRY_STORAGE_KEY);
          // Eski maç cache'lerini temizle (January/stale veriler görünmesin)
          await AsyncStorage.multiRemove([
            'hk_matches_cache', 'hk_last_update',  // Türkiye cache
            'groq_last_error',                       // Groq hata logu
          ]);
          await AsyncStorage.setItem(MIGRATION_KEY, '1');
        }

        const saved = await getCountry();
        if (saved) {
          // Kullanıcı Settings'ten manuel seçmiş → bunu kullan
          setCountryCode(saved);
        } else {
          // Kayıt yok → kaydedilmiş dile göre tahmin et
          const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY) ?? i18n.language ?? 'tr';
          const guessed   = guessCountryFromLanguage(savedLang);
          setCountryCode(guessed);
          await saveCountry(guessed);
        }
      } catch {
        // Hata olursa TR ile devam et
        const fallback = guessCountryFromLanguage(i18n.language ?? 'tr');
        setCountryCode(fallback);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeCountry(code: string) {
    setCountryCode(code);
    await saveCountry(code);
  }

  const currentCountry =
    SUPPORTED_COUNTRIES.find((c) => c.code === countryCode) ?? SUPPORTED_COUNTRIES[0];

  return (
    <CountryContext.Provider value={{ countryCode, currentCountry, changeCountry, isLoading }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  return useContext(CountryContext);
}
