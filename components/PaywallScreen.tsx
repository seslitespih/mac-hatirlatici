import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Platform, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PurchasesPackage } from 'react-native-purchases';
import {
  getOfferings, purchaseSubscription, restorePurchases,
} from '../services/subscriptionService';
import { useTheme } from '../contexts/ThemeContext';

const PRIVACY_URL = 'https://seslitespih.github.io/mac-hatirlatici/';
const EULA_URL    = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

interface Props {
  onSubscribed: () => void;
}

export default function PaywallScreen({ onSubscribed }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [pkg,          setPkg]          = useState<PurchasesPackage | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [fetching,     setFetching]     = useState(true);
  const [offeringErr,  setOfferingErr]  = useState(false);

  const loadOffering = useCallback(() => {
    setFetching(true);
    setOfferingErr(false);
    getOfferings().then((p) => {
      setPkg(p);
      setOfferingErr(p === null);
      setFetching(false);
    });
  }, []);

  useEffect(() => { loadOffering(); }, [loadOffering]);

  async function handlePurchase() {
    if (!pkg) return;
    setLoading(true);
    try {
      const ok = await purchaseSubscription(pkg);
      if (ok) onSubscribed();
    } catch {
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorPurchase'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const ok = await restorePurchases();
      if (ok) {
        onSubscribed();
      } else {
        Alert.alert(t('paywall.notFoundTitle'), t('paywall.errorNoSub'));
      }
    } catch {
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorRestore'));
    } finally {
      setLoading(false);
    }
  }

  const priceStr = pkg?.product.priceString ?? '$2.99';

  const features: [string, string][] = [
    ['⚽', t('paywall.feature0')],
    ['🔔', t('paywall.feature1')],
    ['🌍', t('paywall.feature2')],
    ['📡', t('paywall.feature3')],
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg0 }]}>
      <View style={s.container}>

        {/* Logo */}
        <View style={[s.iconWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <Text style={s.icon}>📺</Text>
        </View>

        <Text style={[s.title, { color: colors.text }]}>Match Reminder</Text>
        <Text style={[s.subtitle, { color: colors.textSub }]}>{t('paywall.subtitle')}</Text>

        {/* Özellikler */}
        <View style={s.features}>
          {features.map(([emoji, text]) => (
            <View key={text} style={s.featureRow}>
              <Text style={s.featureEmoji}>{emoji}</Text>
              <Text style={[s.featureText, { color: colors.text }]}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Fiyat kartı */}
        <View style={[s.priceCard, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <View style={[s.trialBadge, { backgroundColor: colors.accentGlow, borderColor: colors.accent + '44' }]}>
            <Text style={[s.trialText, { color: colors.accent }]}>{t('paywall.trial')}</Text>
          </View>
          <Text style={[s.price, { color: colors.text }]}>
            {priceStr}
            <Text style={[s.pricePer, { color: colors.textSub }]}>{t('paywall.pricePerMonth')}</Text>
          </Text>
          <Text style={[s.priceNote, { color: colors.textSub }]}>
            {t('paywall.priceNote', { price: priceStr })}
          </Text>
        </View>

        {/* Butonlar */}
        {fetching ? (
          <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 24 }} />
        ) : offeringErr ? (
          <View style={s.errorWrap}>
            <Text style={[s.errorText, { color: colors.textSub }]}>{t('paywall.offeringError')}</Text>
            <TouchableOpacity style={[s.retryBtn, { borderColor: colors.accent }]} onPress={loadOffering}>
              <Text style={[s.retryText, { color: colors.accent }]}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: colors.accent }, loading && s.btnDisabled]}
              onPress={handlePurchase}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{t('paywall.startFree')}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={s.restoreBtn}
              onPress={handleRestore}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[s.restoreText, { color: colors.textSub }]}>{t('paywall.restore')}</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[s.legal, { color: colors.textMuted }]}>
          {Platform.OS === 'ios' ? t('paywall.legalIos') : t('paywall.legalAndroid')}
        </Text>

        {/* Privacy Policy & EULA — Apple 3.1.2(c) requirement */}
        <View style={s.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={[s.legalLink, { color: colors.accent }]}>{t('paywall.privacyPolicy')}</Text>
          </TouchableOpacity>
          <Text style={[s.legalSep, { color: colors.textMuted }]}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL(EULA_URL)}>
            <Text style={[s.legalLink, { color: colors.accent }]}>{t('paywall.termsOfUse')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1 },
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  iconWrap:     { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1 },
  icon:         { fontSize: 40 },
  title:        { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle:     { fontSize: 14, fontWeight: '500', marginBottom: 28 },
  features:     { width: '100%', gap: 12, marginBottom: 24 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureEmoji: { fontSize: 20, width: 28 },
  featureText:  { fontSize: 14, fontWeight: '500', flex: 1 },
  priceCard:    { width: '100%', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1 },
  trialBadge:   { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10, borderWidth: 1 },
  trialText:    { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  price:        { fontSize: 36, fontWeight: '900' },
  pricePer:     { fontSize: 16, fontWeight: '500' },
  priceNote:    { fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  btn:          { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '800' },
  restoreBtn:   { marginTop: 14, paddingVertical: 8 },
  restoreText:  { fontSize: 13, textDecorationLine: 'underline' },
  legal:        { fontSize: 10, textAlign: 'center', marginTop: 16, lineHeight: 15, opacity: 0.7 },
  legalLinks:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  legalLink:    { fontSize: 11, textDecorationLine: 'underline' },
  legalSep:     { fontSize: 11 },
  errorWrap:    { alignItems: 'center', marginTop: 24, gap: 12 },
  errorText:    { fontSize: 13, textAlign: 'center' },
  retryBtn:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:    { fontSize: 14, fontWeight: '600' },
});
