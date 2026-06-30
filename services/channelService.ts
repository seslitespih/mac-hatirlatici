/**
 * channelService.ts
 *
 * Kanal verisi öncelik sırası (her maç için):
 *  1. channels-daily.json — scraper'dan gelen maç-bazlı veri (2h cache)
 *  2. channels.json       — lig-bazlı statik veri (24h cache)
 *  3. countryChannels.ts  — bundle içi fallback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { COUNTRY_CHANNEL_MAP } from '../constants/countryChannels';

// ─── Static channel map ───────────────────────────────────────────────────────

const REMOTE_URL     = 'https://raw.githubusercontent.com/seslitespih/mac-hatirlatici/main/assets/channels.json';
const CACHE_KEY      = 'channel_remote_v2';
const CACHE_TIME_KEY = 'channel_remote_time_v2';
const TTL_MS         = 24 * 60 * 60 * 1000;

type ChannelMap = Record<string, Record<string, string[]>>;

let _mem: ChannelMap | null = null;
let _memTime = 0;

export async function getChannelMap(): Promise<ChannelMap> {
  if (_mem && Date.now() - _memTime < TTL_MS) return _mem;

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

  return COUNTRY_CHANNEL_MAP as ChannelMap;
}

export function getChannelsSync(map: ChannelMap, cc: string, leagueId: string): string[] {
  return map[cc]?.[leagueId] ?? map['TR']?.[leagueId] ?? [];
}

export function getFirstChannel(
  map: ChannelMap,
  cc: string,
  leagueId: string,
  homeTeamId?: string,
  awayTeamId?: string,
): string {
  if (homeTeamId) {
    const specific = map[cc]?.[`${leagueId}_${homeTeamId}`]?.[0];
    if (specific) return specific;
  }
  if (awayTeamId) {
    const specific = map[cc]?.[`${leagueId}_${awayTeamId}`]?.[0];
    if (specific) return specific;
  }
  return getChannelsSync(map, cc, leagueId)[0] ?? '';
}

export function prefetchChannels(): void {
  getChannelMap().catch(() => {});
}

// ─── Daily per-match channel data ────────────────────────────────────────────

const DAILY_URL      = 'https://raw.githubusercontent.com/seslitespih/mac-hatirlatici/main/assets/channels-daily.json';
const DAILY_CACHE    = 'channel_daily_v1';
const DAILY_TIME     = 'channel_daily_time_v1';
const DAILY_TTL_MS   = 2 * 60 * 60 * 1000; // 2 saat

export type DailyMatch = {
  home: string;
  away: string;
  channels: string[];
  time: string;
};

export type DailyData = {
  generated_at: string;
  data: Record<string, Record<string, DailyMatch[]>>;
};

let _daily: DailyData | null = null;
let _dailyTime = 0;

export async function getDailyChannelData(): Promise<DailyData | null> {
  if (_daily && Date.now() - _dailyTime < DAILY_TTL_MS) return _daily;

  try {
    const [timeRaw, dataRaw] = await Promise.all([
      AsyncStorage.getItem(DAILY_TIME),
      AsyncStorage.getItem(DAILY_CACHE),
    ]);
    if (timeRaw && dataRaw && Date.now() - parseInt(timeRaw, 10) < DAILY_TTL_MS) {
      _daily     = JSON.parse(dataRaw) as DailyData;
      _dailyTime = parseInt(timeRaw, 10);
      return _daily;
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(DAILY_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout?.(8000),
    } as RequestInit);
    if (res.ok) {
      const data = await res.json() as DailyData;
      const now = Date.now();
      await AsyncStorage.multiSet([
        [DAILY_CACHE, JSON.stringify(data)],
        [DAILY_TIME,  now.toString()],
      ]).catch(() => {});
      _daily     = data;
      _dailyTime = now;
      return data;
    }
  } catch { /* ağ hatası */ }

  return null;
}

export function prefetchDailyChannels(): void {
  getDailyChannelData().catch(() => {});
}

// ─── Team name fuzzy matching ─────────────────────────────────────────────────

function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|sc|ac|cd|af|cf|bk|sk|afc|fk)\b/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (na === nb) return true;
  // Containment: "brazil" ⊂ "brasil" → false, but "man united" ⊂ "manchester united" via prefix
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  // First word match: "Manchester" = "Manchester"
  const wa = na.split(' ')[0];
  const wb = nb.split(' ')[0];
  if (wa.length >= 4 && wa === wb) return true;
  return false;
}

/**
 * Look up channels for a specific match from the daily scraped data.
 * Returns empty array if not found (caller falls back to static map).
 */
export function getChannelsFromDaily(
  daily: DailyData,
  cc: string,
  dateStr: string,    // 'YYYY-MM-DD'
  homeTeam: string,
  awayTeam: string,
): string[] {
  const dayData = daily.data?.[cc]?.[dateStr];
  if (!dayData?.length) return [];

  const match = dayData.find(m =>
    (teamsMatch(m.home, homeTeam) && teamsMatch(m.away, awayTeam)) ||
    (teamsMatch(m.home, awayTeam) && teamsMatch(m.away, homeTeam))
  );
  return match?.channels ?? [];
}
