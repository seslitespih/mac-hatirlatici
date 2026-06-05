/**
 * hangikanalda.ts
 * Türkiye için https://hangikanalda.app/api/proxy/matches'ten
 * günlük maç + kanal verisini çeker.
 *
 * Veri akışı:
 *  1. /api/proxy/last-update → son güncelleme saatini kontrol et
 *  2. Cache'teki saat farklıysa → /api/proxy/matches'i çek
 *  3. Match[] formatına dönüştür ve cache'e kaydet
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, MatchStatus, SportType } from '../constants/matches';

const BASE_URL        = 'https://hangikanalda.app';
const CACHE_KEY       = 'hk_matches_cache';
const CACHE_TIME_KEY  = 'hk_last_update';

// ─── API tipleri ─────────────────────────────────────────────────────────────

interface HKMatch {
  home:     string;
  away?:    string;
  time:     string;          // "HH:MM" — Türkiye saati (UTC+3)
  channels: string[];
  status?:  string;
  homeScore?: number | null;
  awayScore?: number | null;
}

interface HKLeague {
  id?:     string;
  name:    string;
  matches: HKMatch[];
}

interface HKSport {
  title:   string;
  icon?:   string;
  leagues: HKLeague[];
}

interface HKData {
  [sport: string]: HKSport;   // futbol | basketbol | voleybol | motor | ...
}

// ─── Spor eşlemesi ───────────────────────────────────────────────────────────

const SPORT_MAP: Record<string, SportType> = {
  futbol:    'football',
  basketbol: 'basketball',
  voleybol:  'volleyball',
  motor:     'motorsport',
};

// ─── Türkiye saati → UTC Date ─────────────────────────────────────────────────

function trTimeToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  // Istanbul UTC+3: local midnight = 21:00 UTC önceki gün
  const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const todayUTC = Date.UTC(nowIst.getFullYear(), nowIst.getMonth(), nowIst.getDate()) - 3 * 60 * 60 * 1000;
  return new Date(todayUTC + (h * 60 + m) * 60 * 1000);
}

// ─── Status eşlemesi ─────────────────────────────────────────────────────────

function toStatus(s?: string): MatchStatus {
  if (!s) return 'scheduled';
  const lower = s.toLowerCase();
  if (lower === 'live' || lower === 'canli' || lower === 'canlı') return 'live';
  if (lower === 'finished' || lower === 'completed' || lower === 'bitti') return 'finished';
  return 'scheduled';
}

// ─── API çağrıları ────────────────────────────────────────────────────────────

async function fetchLastUpdate(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/proxy/last-update`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.time ?? null;
  } catch {
    return null;
  }
}

async function fetchRawMatches(): Promise<HKData | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/proxy/matches`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── HKData → Match[] dönüşümü ───────────────────────────────────────────────

function parseHKData(data: HKData): Match[] {
  const matches: Match[] = [];
  let idx = 0;

  for (const [sportKey, sportData] of Object.entries(data)) {
    const sport: SportType = SPORT_MAP[sportKey] ?? 'football';

    for (const league of sportData.leagues ?? []) {
      for (const m of league.matches ?? []) {
        if (!m.home || !m.time) continue;

        const date   = trTimeToDate(m.time);
        const homeId = m.home.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9ğüşıöçğüşıöç]/gi, '').slice(0, 24);
        const awayId = (m.away ?? '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 24);

        matches.push({
          id:             `hk_${sportKey}_${idx++}_${homeId}`,
          sport,
          homeTeam:       homeId,
          awayTeam:       awayId,
          homeTeamName:   m.home,
          awayTeamName:   m.away ?? '',
          homeTeamColor:  '#888',
          awayTeamColor:  '#888',
          homeTeamEmoji:  '',
          awayTeamEmoji:  '',
          date,
          time:           m.time,
          league:         league.name,
          leagueId:       (league.id ?? league.name).toLowerCase().replace(/\s+/g, '_').slice(0, 20),
          leagueEmoji:    '',
          channel:        m.channels?.[0] ?? '',
          channels:       m.channels ?? [],
          status:         toStatus(m.status),
        });
      }
    }
  }

  return matches;
}

// ─── Ana export ───────────────────────────────────────────────────────────────

/**
 * Türkiye için günlük maç verisini hangikanalda.app'ten çeker.
 * Cache mekanizması: last-update saati değişince yeniden çeker.
 */
export async function fetchTRMatches(): Promise<Match[]> {
  // 1. Son güncelleme saatini al
  const latestTime = await fetchLastUpdate();

  // 2. Cache kontrol
  const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
  if (cachedTime && cachedTime === latestTime) {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Match[];
      // Date objelerini restore et
      return parsed.map(m => ({ ...m, date: new Date(m.date) }));
    }
  }

  // 3. Taze veri çek
  const data = await fetchRawMatches();
  if (!data) return [];

  const matches = parseHKData(data);
  if (matches.length === 0) return [];

  // 4. Cache'e kaydet
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(matches));
  if (latestTime) await AsyncStorage.setItem(CACHE_TIME_KEY, latestTime);

  return matches;
}

export async function clearTRCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIME_KEY]);
}
