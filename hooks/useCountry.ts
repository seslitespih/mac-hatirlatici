import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCountry, saveCountry } from '../services/storageService';
import { guessCountryFromLanguage, SUPPORTED_COUNTRIES } from '../constants/countryChannels';
import { scheduleAllNotifications, cancelAllNotifications } from '../services/notificationService';
import { MATCHES } from '../constants/matches';

export function useCountry() {
  const { i18n } = useTranslation();
  const [countryCode, setCountryCode] = useState<string>('TR');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const saved = await getCountry();
      if (saved) {
        setCountryCode(saved);
      } else {
        // First launch: guess from app language
        const guessed = guessCountryFromLanguage(i18n.language);
        setCountryCode(guessed);
        await saveCountry(guessed);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  async function changeCountry(code: string) {
    setCountryCode(code);
    await saveCountry(code);
  }

  const currentCountry = SUPPORTED_COUNTRIES.find((c) => c.code === countryCode)
    ?? SUPPORTED_COUNTRIES[0];

  return {
    countryCode,
    currentCountry,
    changeCountry,
    isLoading,
  };
}
