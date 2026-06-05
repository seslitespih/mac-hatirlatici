/**
 * subscriptionService.ts
 * RevenueCat üzerinden abonelik yönetimi.
 *
 * Model:
 *  - 1 ay ücretsiz trial (RevenueCat'te tanımlanmış)
 *  - Sonrasında $2.99/ay zorunlu
 *  - Abonelik yoksa uygulama tamamen kilitlenir
 */

import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── RevenueCat API Key'leri ─────────────────────────────────────────────────
// app.config.js → extra.rcApiKeyIos / extra.rcApiKeyAndroid

function getApiKey(): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  if (Platform.OS === 'ios') {
    return extra?.rcApiKeyIos ?? process.env.REVENUECAT_IOS_KEY ?? '';
  }
  return extra?.rcApiKeyAndroid ?? process.env.REVENUECAT_ANDROID_KEY ?? '';
}

// ─── Ürün ID'leri (RevenueCat + Store'da tanımlı) ────────────────────────────

export const ENTITLEMENT_ID  = 'premium';
export const PRODUCT_ID      = 'monthly_premium_299';  // App Store & Play Store'daki ID

// ─── Başlatma ─────────────────────────────────────────────────────────────────

export function initPurchases(): void {
  const key = getApiKey();
  if (!key) return;

  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: key });
}

// ─── Abonelik durumu ──────────────────────────────────────────────────────────

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/**
 * Kullanıcının aktif aboneliği var mı?
 * Trial süresi içindeyse de true döner.
 */
export async function isSubscribed(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Trial süresi bitti mi, ücretli abonelik gerekli mi?
 * false → hâlâ ücretsiz (trial veya aktif abonelik)
 * true  → paywall göster
 */
export async function needsPaywall(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    return entitlement === undefined;
  } catch {
    return false; // hata durumunda erişime izin ver
  }
}

// ─── Satın alma ───────────────────────────────────────────────────────────────

export async function getOfferings(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.monthly ?? null;
  } catch {
    return null;
  }
}

export async function purchaseSubscription(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return result.customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (e: unknown) {
    // Kullanıcı iptal etti — hata değil
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}
