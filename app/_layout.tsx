import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { initI18n, COUNTRY_STORAGE_KEY } from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermissions, configureNotifications } from '../services/notificationService';
import { fetchMatchesFromGroq, registerDailyFetch } from '../services/groqService';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { saveCountry } from '../services/storageService';

SplashScreen.preventAutoHideAsync();

// Kayıtlı ülke kodunu oku (varsayılan TR)
async function getSavedCountry(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(COUNTRY_STORAGE_KEY)) ?? 'TR';
  } catch {
    return 'TR';
  }
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const appState    = useRef<AppStateStatus>(AppState.currentState);
  const countryRef  = useRef<string>('TR');   // hazır olmadan önce de erişilebilir

  // ── Ön plana gelince Groq cache kontrol et ────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchMatchesFromGroq(countryRef.current).catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({});

        // 1. i18n başlat — cihaz dilini tespit eder, ilk açılışta ülkeyi de döner
        const { detectedCountry } = await initI18n();

        // 2. Ülke belirle: tespit edilen > kayıtlı > varsayılan TR
        let countryCode: string;
        if (detectedCountry) {
          // İlk açılış: cihazdan tespit edildi, kaydet
          countryCode = detectedCountry;
          await saveCountry(countryCode);
        } else {
          // Sonraki açılışlar: kayıtlıyı oku
          countryCode = await getSavedCountry();
        }
        countryRef.current = countryCode;

        // 3. Bildirim izni & yapılandırma
        configureNotifications();
        requestNotificationPermissions().catch(() => {});

        // 4. Bugünkü maçları çek (cache varsa anında döner, yoksa Groq'a sor)
        fetchMatchesFromGroq(countryCode).catch(() => {});

        // 5. Arka plan task'ı kaydet (Android uyku modunda da günceller)
        registerDailyFetch().catch(() => {});
      } catch (e) {
        console.warn('App init error:', e);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appReady) {
    return <View style={{ flex: 1, backgroundColor: '#0f0f1a' }} />;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="light" backgroundColor="#0f0f1a" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </I18nextProvider>
  );
}
