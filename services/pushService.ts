/**
 * pushService.ts
 * Sunucu tabanlı push bildirimi kaydı.
 *
 * Neden var: yerel bildirimler yalnız uygulama AÇILDIĞINDA kuruluyordu. Kullanıcı
 * o gün uygulamayı açmazsa o günün maçları için hiç bildirim gelmiyordu. Push ile
 * sunucu, fikstür dosyası yayınlanınca maçtan 15 dk önce bildirimi kendisi gönderir;
 * kullanıcının uygulamayı yalnız bir kez (kayıt için) açmış olması yeter.
 *
 * GÜVENLİK KURALI: bu modül ASLA hata fırlatmaz. Kayıt herhangi bir sebeple
 * başarısız olursa `false` döner ve uygulama eskisi gibi yerel bildirimlerle çalışır.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceTimezone } from '../utils/timezone';

// Cloudflare Worker adresi. Kodu: push-sunucu/ klasörü.
const PUSH_API_URL = 'https://mac-hatirlatici-push.ssaglamess.workers.dev';

const KAYIT_KEY       = 'push_kayit_v1';
const TAZELE_MS       = 24 * 60 * 60 * 1000;      // değişiklik yoksa da günde bir yenile
const ZAMAN_ASIMI_MS  = 8000;

interface KayitDurumu {
  imza:     string;   // sunucuya en son BAŞARIYLA gönderilen gövde
  token:    string;
  basariTs: number;
}

async function durumOku(): Promise<KayitDurumu | null> {
  try {
    const raw = await AsyncStorage.getItem(KAYIT_KEY);
    return raw ? (JSON.parse(raw) as KayitDurumu) : null;
  } catch {
    return null;
  }
}

async function tokenAl(): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    // Simülatörde ve FCM yapılandırması olmayan Android'de burası hata verir — beklenen durum.
    return null;
  }
}

/** Uygulamanın listeyi hangi ülke için kurduğu: küratörlü maç kimliği `daily_TR_...` */
function ulkeBul(macIdleri: string[]): string {
  for (const id of macIdleri) {
    if (id.startsWith('daily_')) {
      const parca = id.split('_')[1];
      if (parca && /^[A-Z]{2}$/.test(parca)) return parca;
    }
  }
  return '';
}

function govdeImzasi(token: string, takimlar: string[], dil: string, ulke: string): string {
  return JSON.stringify({
    token,
    takimlar: [...takimlar].sort(),
    dil:      (dil || 'en').split('-')[0],
    ulke,
    tz:       getDeviceTimezone(),
    platform: Platform.OS,
  });
}

/**
 * Seçili takımları push sunucusuna bildirir.
 *
 * @returns `true` → sunucu bu kullanıcının GÜNCEL takım listesini biliyor; küratörlü
 *          maçların bildirimini sunucu gönderecek, yerel olarak kurulmamalı.
 *          `false` → push yok ya da sunucu güncel değil; yerel bildirim kurulmalı.
 */
export async function pushKaydiniGuncelle(
  takimlar: string[],
  dil: string,
  macIdleri: string[],
): Promise<boolean> {
  try {
    const onceki = await durumOku();
    const ulke   = ulkeBul(macIdleri);
    // Ülke henüz belli değilse (küratörlü maç yok) sunucuyu yanlış ülkeyle güncelleme;
    // önceki kayıt geçerliyse onu kullanmaya devam et.
    if (!ulke) {
      return !!onceki && Date.now() - onceki.basariTs < TAZELE_MS * 7;
    }

    // Hızlı yol: önbellekteki token ile aynı gövde zaten yakın zamanda gönderildiyse ağa çıkma.
    if (onceki) {
      const ayni = govdeImzasi(onceki.token, takimlar, dil, ulke) === onceki.imza;
      if (ayni && Date.now() - onceki.basariTs < TAZELE_MS) return true;
    }

    const token = (await tokenAl()) ?? onceki?.token ?? null;
    if (!token) return false;

    const imza = govdeImzasi(token, takimlar, dil, ulke);
    const ctrl = new AbortController();
    const zamanlayici = setTimeout(() => ctrl.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(`${PUSH_API_URL}/kayit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    imza,
        signal:  ctrl.signal,
      });
      if (yanit.ok) {
        const yeniDurum: KayitDurumu = { imza, token, basariTs: Date.now() };
        await AsyncStorage.setItem(KAYIT_KEY, JSON.stringify(yeniDurum));
        return true;
      }
    } catch {
      // ağ hatası — aşağıda değerlendir
    } finally {
      clearTimeout(zamanlayici);
    }

    // Gönderim başarısız. Sunucu yalnız AYNI gövdeyi daha önce aldıysa güncel sayılır;
    // takım listesi değiştiyse sunucu eskisini biliyor → yerel bildirime düş
    // (çift bildirim, kaçan bildirimden iyidir).
    return !!onceki && onceki.imza === imza && Date.now() - onceki.basariTs < TAZELE_MS * 7;
  } catch {
    return false;
  }
}
