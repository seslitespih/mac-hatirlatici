/**
 * Mağaza puanı + geliştiriciye doğrudan geri bildirim.
 *
 * Mağaza kuralları (Google Play in-app review yönergeleri, App Store 5.6.1):
 * mağazanın KENDİ yıldız penceresi doğrudan açılır; öncesinde "beğendin mi?"
 * sorusu YOK ve geri bildirim kimin pencereyi göreceğini belirlemez.
 * Geri bildirim Ayarlar'da her zaman duran ayrı bir satırdır.
 *
 * "Mutlu an": kullanıcı bir maç hatırlatmasına dokunup uygulamaya girdi
 * (uygulama işini yaptı) ya da uygulamayı birçok farklı günde kullandı.
 * İşletim sistemi yine de göstermeyebilir (Apple: yılda en çok 3; Google: kota).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import * as Localization from 'expo-localization';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { getSelectedTeams } from './storageService';

export const IOS_APP_ID = '6779112504';
const ANDROID_PACKAGE = 'com.machatirlatici.app';
const FEEDBACK_URL = 'https://uygulama-geri-bildirim.ssaglamess.workers.dev/gonder';

const K = {
  days: 'rv_days',
  lastDay: 'rv_last_day',
  asks: 'rv_asks',
  lastAsk: 'rv_last_ask_ms',
  lastNotif: 'rv_last_notif_id',
};

export const REVIEW_RULES = {
  /** Hatırlatmadan girişte en az kaç farklı gün kullanmış olmalı */
  minDaysAfterReminder: 2,
  /** Hatırlatma olmadan (normal açılış) en az kaç farklı gün */
  minDaysRegular: 5,
  maxAsks: 3,
  gapMs: 120 * 24 * 60 * 60 * 1000,
};

export function shouldAsk(p: {
  days: number;
  asks: number;
  lastAskMs: number;
  nowMs: number;
  favorites: number;
  fromReminder: boolean;
}): boolean {
  if (p.favorites < 1) return false;
  if (p.asks >= REVIEW_RULES.maxAsks) return false;
  if (p.lastAskMs > 0 && p.nowMs - p.lastAskMs < REVIEW_RULES.gapMs) return false;
  return p.days >= (p.fromReminder ? REVIEW_RULES.minDaysAfterReminder : REVIEW_RULES.minDaysRegular);
}

const num = async (key: string) => parseInt((await AsyncStorage.getItem(key)) ?? '0', 10) || 0;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Farklı kullanım günlerini sayar; güncel gün sayısını döner. */
export async function recordAppOpen(): Promise<number> {
  try {
    const t = today();
    let days = await num(K.days);
    if ((await AsyncStorage.getItem(K.lastDay)) !== t) {
      days += 1;
      await AsyncStorage.multiSet([[K.lastDay, t], [K.days, String(days)]]);
    }
    return days;
  } catch {
    return 0;
  }
}

/** Aynı bildirime ikinci kez "hatırlatmadan geldi" denmesin. */
export async function isNewNotificationTap(id: string): Promise<boolean> {
  try {
    if (!id || (await AsyncStorage.getItem(K.lastNotif)) === id) return false;
    await AsyncStorage.setItem(K.lastNotif, id);
    return true;
  } catch {
    return false;
  }
}

let askedThisSession = false;

/** Koşullar uygunsa mağazanın kendi yıldız penceresini açar. */
export async function maybeAskForReview(fromReminder: boolean): Promise<void> {
  if (askedThisSession) return;
  try {
    const nowMs = Date.now();
    const asks = await num(K.asks);
    const ok = shouldAsk({
      days: await recordAppOpen(),
      asks,
      lastAskMs: await num(K.lastAsk),
      nowMs,
      favorites: (await getSelectedTeams()).length,
      fromReminder,
    });
    if (!ok) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    askedThisSession = true;
    await AsyncStorage.multiSet([[K.asks, String(asks + 1)], [K.lastAsk, String(nowMs)]]);
    await StoreReview.requestReview();
  } catch {}
}

/** Ayarlar → "Uygulamayı puanla": mağaza sayfasını açar (kullanıcı isteğiyle). */
export async function openStorePage(): Promise<void> {
  const urls =
    Platform.OS === 'ios'
      ? [
          `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`,
          `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`,
        ]
      : [
          `market://details?id=${ANDROID_PACKAGE}`,
          `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
        ];
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {}
  }
}

/** Mesajı geliştiricinin e-postasına gönderir. Ulaştıysa true. */
export async function sendFeedback(message: string, email: string, lang: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(FEEDBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'mac',
        message: message.trim(),
        email: email.trim(),
        platform: Platform.OS,
        version: Constants.expoConfig?.version ?? '',
        lang,
        country: Localization.getLocales()[0]?.regionCode ?? '',
      }),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
