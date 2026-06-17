import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from '../i18n';
import i18n from '../i18n';
import { requestNotificationPermissions, configureNotifications } from '../services/notificationService';
import { registerDailyFetch } from '../services/groqService';
import { saveCountry, migrateTeamIds } from '../services/storageService';
import { initPurchases, needsPaywall } from '../services/subscriptionService';
import PaywallScreen from '../components/PaywallScreen';
import { ThemeProvider } from '../contexts/ThemeContext';
import { CountryProvider } from '../contexts/CountryContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady,    setAppReady]    = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Splash'i appReady olduktan SONRA kaldır.
  // İki requestAnimationFrame: JS render + native commit'in tamamlanmasını bekle
  useEffect(() => {
    if (appReady) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          SplashScreen.hideAsync().catch(() => {});
        });
      });
    }
  }, [appReady]);

  // Ön plana gelince abonelik kontrolü
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
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
        await migrateTeamIds();
        const { detectedCountry } = await initI18n();

        if (detectedCountry) {
          await saveCountry(detectedCountry);
        }

        configureNotifications();
        requestNotificationPermissions().catch(() => {});

        initPurchases();

        // Paywall kontrolü — 3 sn timeout (RevenueCat takılırsa geçilsin)
        const paywallNeeded = await Promise.race([
          needsPaywall(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
        ]);
        setShowPaywall(paywallNeeded);

        registerDailyFetch().catch(() => {});

      } catch (e) {
        console.warn('App init error:', e);
      } finally {
        setAppReady(true);
        // SplashScreen.hideAsync() artık burada değil — useEffect[appReady] handle ediyor
      }
    }
    prepare();
  }, []);

  if (!appReady) {
    return <View style={{ flex: 1, backgroundColor: '#F0F5FF' }} />;
  }

  if (showPaywall) {
    return (
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="dark" backgroundColor="#F0F5FF" />
          <PaywallScreen onSubscribed={() => setShowPaywall(false)} />
        </I18nextProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <I18nextProvider i18n={i18n}>
        <CountryProvider>
          <StatusBar style="dark" backgroundColor="transparent" translucent />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0F5FF' } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </CountryProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}
