import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nextProvider } from 'react-i18next';
import { initI18n, COUNTRY_STORAGE_KEY } from '../i18n';
import i18n from '../i18n';
import { requestNotificationPermissions, configureNotifications } from '../services/notificationService';
import { fetchMatchesFromGroq, registerDailyFetch } from '../services/groqService';
import { saveCountry } from '../services/storageService';
import { initPurchases, needsPaywall } from '../services/subscriptionService';
import PaywallScreen from '../components/PaywallScreen';

SplashScreen.preventAutoHideAsync();

async function getSavedCountry(): Promise<string> {
  try { return (await AsyncStorage.getItem(COUNTRY_STORAGE_KEY)) ?? 'TR'; }
  catch { return 'TR'; }
}

export default function RootLayout() {
  const [appReady,    setAppReady]    = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const appState   = useRef<AppStateStatus>(AppState.currentState);
  const countryRef = useRef<string>('TR');

  // Ön plana gelince Groq cache kontrol
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        fetchMatchesFromGroq(countryRef.current).catch(() => {});
        // Abonelik durumunu yeniden kontrol et
        needsPaywall().then(setShowPaywall).catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({});
        const { detectedCountry } = await initI18n();

        // Ülke belirle
        let countryCode: string;
        if (detectedCountry) {
          countryCode = detectedCountry;
          await saveCountry(countryCode);
        } else {
          countryCode = await getSavedCountry();
        }
        countryRef.current = countryCode;

        // Bildirim
        configureNotifications();
        requestNotificationPermissions().catch(() => {});

        // RevenueCat başlat
        initPurchases();

        // Abonelik kontrolü
        const paywallNeeded = await needsPaywall();
        setShowPaywall(paywallNeeded);

        // Maç verisi prefetch (arka planda)
        fetchMatchesFromGroq(countryCode).catch(() => {});
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
    return <View style={{ flex: 1, backgroundColor: '#060C1A' }} />;
  }

  // Abonelik yoksa paywall göster — arka planı tamamen engelle
  if (showPaywall) {
    return (
      <I18nextProvider i18n={i18n}>
        <StatusBar style="light" backgroundColor="#060C1A" />
        <PaywallScreen onSubscribed={() => setShowPaywall(false)} />
      </I18nextProvider>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="light" backgroundColor="#060C1A" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </I18nextProvider>
  );
}
