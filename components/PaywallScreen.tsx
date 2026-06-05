import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Platform,
} from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import {
  getOfferings, purchaseSubscription, restorePurchases,
} from '../services/subscriptionService';

interface Props {
  onSubscribed: () => void;
}

const C = {
  bg:       '#060C1A',
  card:     '#0F2040',
  accent:   '#4F8EF7',
  gold:     '#F59E0B',
  text:     '#F0F4FF',
  textSub:  '#7B9CC4',
  border:   '#1A3560',
};

export default function PaywallScreen({ onSubscribed }: Props) {
  const [pkg,     setPkg]     = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching,setFetching]= useState(true);

  useEffect(() => {
    getOfferings().then((p) => { setPkg(p); setFetching(false); });
  }, []);

  async function handlePurchase() {
    if (!pkg) return;
    setLoading(true);
    try {
      const ok = await purchaseSubscription(pkg);
      if (ok) onSubscribed();
    } catch {
      Alert.alert('Hata', 'Satın alma işlemi tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const ok = await restorePurchases();
      if (ok) { onSubscribed(); }
      else { Alert.alert('Bulunamadı', 'Bu hesaba bağlı aktif abonelik bulunamadı.'); }
    } catch {
      Alert.alert('Hata', 'Satın almalar geri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  const priceStr = pkg?.product.priceString ?? '$2.99';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        {/* Logo / Icon */}
        <View style={s.iconWrap}>
          <Text style={s.icon}>📺</Text>
        </View>

        {/* Başlık */}
        <Text style={s.title}>Match Reminder</Text>
        <Text style={s.subtitle}>Sports TV Guide</Text>

        {/* Özellikler */}
        <View style={s.features}>
          {[
            ['⚽', 'Bugünkü tüm maçlar, doğru saat ve kanalıyla'],
            ['🔔', '15 dakika önce maç hatırlatıcısı'],
            ['🌍', '15 ülkede yayın programı'],
            ['📡', 'Günlük otomatik güncelleme'],
          ].map(([emoji, text]) => (
            <View key={text} style={s.featureRow}>
              <Text style={s.featureEmoji}>{emoji}</Text>
              <Text style={s.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Fiyat kartı */}
        <View style={s.priceCard}>
          <View style={s.trialBadge}>
            <Text style={s.trialText}>1 AY ÜCRETSİZ DENEME</Text>
          </View>
          <Text style={s.price}>{priceStr}<Text style={s.pricePer}>/ay</Text></Text>
          <Text style={s.priceNote}>
            Deneme süresi bittikten sonra {priceStr}/ay olarak faturalandırılır.{'\n'}
            İstediğiniz zaman iptal edebilirsiniz.
          </Text>
        </View>

        {/* Butonlar */}
        {fetching ? (
          <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 24 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[s.btn, s.btnPrimary, loading && s.btnDisabled]}
              onPress={handlePurchase}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>1 Ay Ücretsiz Başla</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={s.restoreBtn}
              onPress={handleRestore}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={s.restoreText}>Satın Almaları Geri Yükle</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Alt bilgi */}
        <Text style={s.legal}>
          {Platform.OS === 'ios'
            ? 'iTunes hesabınızdan ücret alınır. Abonelik, mevcut dönem bitmeden en az 24 saat önce iptal edilmezse otomatik olarak yenilenir.'
            : 'Google Play hesabınızdan ücret alınır. İstediğiniz zaman Google Play üzerinden iptal edebilirsiniz.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  container:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  iconWrap:    { width: 80, height: 80, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  icon:        { fontSize: 40 },
  title:       { color: C.text,    fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle:    { color: C.textSub, fontSize: 14, fontWeight: '500', marginBottom: 28 },
  features:    { width: '100%', gap: 12, marginBottom: 24 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureEmoji:{ fontSize: 20, width: 28 },
  featureText: { color: C.text, fontSize: 14, fontWeight: '500', flex: 1 },
  priceCard:   { width: '100%', backgroundColor: C.card, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  trialBadge:  { backgroundColor: C.gold + '22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10, borderWidth: 1, borderColor: C.gold + '44' },
  trialText:   { color: C.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  price:       { color: C.text, fontSize: 36, fontWeight: '900' },
  pricePer:    { fontSize: 16, fontWeight: '500', color: C.textSub },
  priceNote:   { color: C.textSub, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  btn:         { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimary:  { backgroundColor: C.accent },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  restoreBtn:  { marginTop: 14, paddingVertical: 8 },
  restoreText: { color: C.textSub, fontSize: 13, textDecorationLine: 'underline' },
  legal:       { color: C.textSub, fontSize: 10, textAlign: 'center', marginTop: 16, lineHeight: 15, opacity: 0.7 },
});
