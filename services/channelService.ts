/**
 * channelService.ts
 *
 * Kanal verisi öncelik sırası:
 *  1. GitHub'daki assets/channels.json  (uygulama güncellemesi gerekmeden değiştirilebilir)
 *  2. Yerel AsyncStorage cache (24 saat)
 *  3. countryChannels.ts (bundle içi fallback)
 *
 * Yayın hakları değiştiğinde sadece channels.json güncellenir.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { COUNTRY_CHANNEL_MAP } from '../constants/countryChannels';

const REMOTE_URL    = 'https://raw.githubusercontent.com/seslitespih/mac-hatirlatici/main/assets/channels.json';
const CACHE_KEY     = 'channel_remote_v1';
const CACHE_TIME_KEY = 'channel_remote_time_v1';
const TTL_MS        = 24 * 60 * 60 * 1000; // 24 saat

type ChannelMap = Record<string, Record<string, string[]>>;

// Bellek içi cache — uygulama açık kaldığı sürece yeniden fetch yok
let _mem: ChannelMap | null = null;
let _memTime = 0;

export async function getChannelMap(): Promise<ChannelMap> {
  // 1. Bellek cache
  if (_mem && Date.now() - _memTime < TTL_MS) return _mem;

  // 2. AsyncStorage cache
  try {
    const [timeRaw, dataRaw] = await Promise.all([
      AsyncStorage.getItem(CACHE_TIME_KEY),
      AsyncStorage.getItem(CACHE_KEY),
    ]);
    if (timeRaw && dataRaw && Date.now() - parseInt(timeRaw, 10) < TTL_MS) {
      const parsed = JSON.parse(dataRaw) as ChannelMap;
      _mem     = parsed;
      _memTime = parseInt(timeRaw, 10);
      return parsed;
    }
  } catch { /* ignore */ }

  // 3. Remote fetch
  try {
    const res = await fetch(REMOTE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout?.(8000),
    } as RequestInit);
    if (res.ok) {
      const data = await res.json() as ChannelMap;
      const now = Date.now();
      await AsyncStorage.multiSet([
        [CACHE_KEY,      JSON.stringify(data)],
        [CACHE_TIME_KEY, now.toString()],
      ]).catch(() => {});
      _mem     = data;
      _memTime = now;
      return data;
    }
  } catch { /* ağ hatası → local fallback */ }

  // 4. Bundle içi fallback
  return COUNTRY_CHANNEL_MAP as ChannelMap;
}

/**
 * Belirli bir ülke + lig kombinasyonu için kanal listesi döner.
 * Sync erişim için önce getChannelMap() çağrılmış olmalı.
 */
export function getChannelsSync(map: ChannelMap, cc: string, leagueId: string): string[] {
  return map[cc]?.[leagueId] ?? map['TR']?.[leagueId] ?? [];
}

export function getFirstChannel(map: ChannelMap, cc: string, leagueId: string): string {
  return getChannelsSync(map, cc, leagueId)[0] ?? '';
}

// Uygulama açılışında arka planda yükle (opsiyonel — ana akışı bloklamaz)
export function prefetchChannels(): void {
  getChannelMap().catch(() => {});
}
