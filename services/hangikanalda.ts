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

const BASE_URL         = 'https://hangikanalda.app';
const CACHE_KEY        = 'hk_matches_cache';
const CACHE_TIME_KEY   = 'hk_last_update';
const CACHE_FETCH_KEY  = 'hk_fetch_time';
const CACHE_DATE_KEY   = 'hk_cache_date';
const CACHE_TTL_MS     = 60 * 60 * 1000;  // 60 dakika

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
// API saatleri Istanbul yerel saatidir (UTC+3).
// Gece yarısını geçen maçlar (örn. 01:00) ertesi günün maçı sayılır.

const TR_TZ = 'Europe/Istanbul';

function getTodayIst(): { year: number; month: number; day: number } {
  // toLocaleString('sv-SE') → "YYYY-MM-DD HH:MM:SS" (formatToParts Hermes'te yok)
  const localStr = new Date().toLocaleString('sv-SE', { timeZone: TR_TZ });
  const [datePart] = localStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  return { year, month: month - 1, day };  // month 0-indexed (Date.UTC için)
}

function trTimeToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const { year, month, day } = getTodayIst();
  // Istanbul midnight UTC = bugün 00:00 IST = UTC-3h
  const midnightUTC = Date.UTC(year, month, day, 0, 0, 0) - 3 * 60 * 60 * 1000;
  // TV rehberi "günü" 09:00→ertesi 08:59 arası: gece yarısı sonrası saatler (00-08) ertesi sabaha ait
  const nextDayOffset = h < 9 ? 24 * 60 * 60 * 1000 : 0;
  return new Date(midnightUTC + nextDayOffset + (h * 60 + m) * 60 * 1000);
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
        const normalize = (s: string) => s
          .toLowerCase()
          .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
          .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
          .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 24);
        const homeId = normalize(m.home);
        const awayId = normalize(m.away ?? '');

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
  // Bugünün Istanbul tarihi (cache anahtarı)
  const { year, month, day } = getTodayIst();
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 1. Cache geçerlilik kontrolü: gün + 60dk TTL
  const [cachedDate, fetchedAt, cachedData] = await Promise.all([
    AsyncStorage.getItem(CACHE_DATE_KEY),
    AsyncStorage.getItem(CACHE_FETCH_KEY),
    AsyncStorage.getItem(CACHE_KEY),
  ]);

  const dayMatch  = cachedDate === todayStr;
  const ttlOK     = !!fetchedAt && Date.now() - parseInt(fetchedAt, 10) < CACHE_TTL_MS;

  if (dayMatch && ttlOK && cachedData) {
    return (JSON.parse(cachedData) as Match[]).map(m => ({ ...m, date: new Date(m.date) }));
  }

  // 2. Son güncelleme saati kontrolü (ek optimizasyon — aynı gün içinde veri değişmemişse API çağrısından kaçın)
  const latestTime = await fetchLastUpdate();
  const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
  if (dayMatch && cachedTime && cachedTime === latestTime && cachedData) {
    // Veri değişmemiş → cache'i güncelle ve döndür
    await AsyncStorage.setItem(CACHE_FETCH_KEY, Date.now().toString());
    return (JSON.parse(cachedData) as Match[]).map(m => ({ ...m, date: new Date(m.date) }));
  }

  // 3. Taze veri çek
  const data = await fetchRawMatches();
  if (!data) return [];

  const matches = parseHKData(data);
  if (matches.length === 0) return [];

  // 4. Cache'e kaydet
  await AsyncStorage.multiSet([
    [CACHE_KEY,       JSON.stringify(matches)],
    [CACHE_DATE_KEY,  todayStr],
    [CACHE_FETCH_KEY, Date.now().toString()],
    ...(latestTime ? [[CACHE_TIME_KEY, latestTime]] as [string, string][] : []),
  ]);

  return matches;
}

export async function clearTRCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIME_KEY, CACHE_FETCH_KEY, CACHE_DATE_KEY]);
}
