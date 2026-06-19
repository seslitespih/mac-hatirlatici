/**
 * motorsportService.ts
 *
 * Veri kaynakları:
 *   1. Formula 1  → Jolpica API (api.jolpi.ca) — ücretsiz, auth gerekmez
 *   2. MotoGP + diğer motorsport → TheSportsDB eventsday.php?s=Motorsport
 *
 * Türkiye için KULLANILMAZ — hangikanalda.ts zaten motor sporunu içeriyor.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match } from '../constants/matches';
import {
  getMatchWindow,
  getUTCDatesForWindow,
  localDateOf,
  formatLocalTime,
} from '../utils/timezone';
import { COUNTRY_TZ } from './sportsDbService';

// ─── Jolpica F1 tip tanımı ───────────────────────────────────────────────────

interface JolpiRace {
  season: string;
  round:  string;
  raceName: string;
  Circuit: {
    circuitName: string;
    Location: { country: string; locality: string };
  };
  date: string;  // "YYYY-MM-DD"
  time: string;  // "HH:MM:SSZ"
}

// ─── TheSportsDB Motorsport tip tanımı ───────────────────────────────────────

interface TSDBMotorEvent {
  idEvent:      string;
  strEvent:     string;     // yarış adı (ör. "Czechia Sprint Race")
  strTimestamp: string;
  strLeague:    string;     // "MotoGP", "DTM", vs.
  idLeague:     string;
  strVenue?:    string;     // pist adı
  strCity?:     string;
  strCountry?:  string;
  strStatus?:   string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const F1_DATA_KEY = 'motor_f1_v1';
const F1_TIME_KEY = 'motor_f1_time_v1';
const F1_YEAR_KEY = 'motor_f1_year_v1';
const F1_TTL      = 12 * 60 * 60 * 1000;  // 12 saat (sezon verisi sık değişmez)

const CACHE_TTL = 60 * 60 * 1000;  // 60 dakika
const MCK  = (cc: string) => `motor_v1_${cc}`;
const MCDK = (cc: string) => `motor_v1_date_${cc}`;
const MCTK = (cc: string) => `motor_v1_time_${cc}`;

// ─── F1 sezon verisi (Jolpica) ────────────────────────────────────────────────

async function fetchF1Season(year: number): Promise<JolpiRace[]> {
  try {
    const [timeRaw, yearRaw, rawData] = await Promise.all([
      AsyncStorage.getItem(F1_TIME_KEY),
      AsyncStorage.getItem(F1_YEAR_KEY),
      AsyncStorage.getItem(F1_DATA_KEY),
    ]);
    if (
      yearRaw === String(year) &&
      timeRaw && Date.now() - parseInt(timeRaw, 10) < F1_TTL &&
      rawData
    ) {
      return JSON.parse(rawData) as JolpiRace[];
    }
    const res = await fetch(
      `https://api.jolpi.ca/ergast/f1/${year}/races.json`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data  = await res.json();
    const races = (data?.MRData?.RaceTable?.Races ?? []) as JolpiRace[];
    if (races.length > 0) {
      await AsyncStorage.multiSet([
        [F1_DATA_KEY, JSON.stringify(races)],
        [F1_TIME_KEY, Date.now().toString()],
        [F1_YEAR_KEY, String(year)],
      ]);
    }
    return races;
  } catch { return []; }
}

// ─── TheSportsDB günlük motorsport (MotoGP dahil) ────────────────────────────

async function fetchTSDBMotorDay(dateStr: string): Promise<TSDBMotorEvent[]> {
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateStr}&s=Motorsport`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events ?? []) as TSDBMotorEvent[];
  } catch { return []; }
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function parseUTC(ts: string): Date {
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z');
}

function motorStatus(s?: string): 'scheduled' | 'live' | 'finished' {
  const l = (s ?? '').toLowerCase();
  if (l === 'inprogress') return 'live';
  if (l === 'ft' || l === 'finished') return 'finished';
  return 'scheduled';
}

// ─── Ana export ───────────────────────────────────────────────────────────────

export async function fetchMotorsportMatches(countryCode: string): Promise<Match[]> {
  const tz        = COUNTRY_TZ[countryCode] ?? 'UTC';
  const now       = new Date();
  const { start, end } = getMatchWindow(tz);
  const localDate = localDateOf(now, tz);

  // Cache geçerli mi?
  try {
    const [dateRaw, timeRaw, dataRaw] = await Promise.all([
      AsyncStorage.getItem(MCDK(countryCode)),
      AsyncStorage.getItem(MCTK(countryCode)),
      AsyncStorage.getItem(MCK(countryCode)),
    ]);
    if (
      dateRaw === localDate &&
      timeRaw && Date.now() - parseInt(timeRaw, 10) < CACHE_TTL &&
      dataRaw
    ) {
      return (JSON.parse(dataRaw) as Match[]).map(m => ({ ...m, date: new Date(m.date) }));
    }
  } catch { /* cache okunamazsa devam */ }

  const year     = now.getFullYear();
  const utcDates = getUTCDatesForWindow(start, end);

  // Paralel: F1 sezon + TheSportsDB motorsport günlük
  const [f1Races, ...motorDayArrays] = await Promise.all([
    fetchF1Season(year),
    ...utcDates.map(d => fetchTSDBMotorDay(d)),
  ]);

  const matches: Match[] = [];
  const seen = new Set<string>();

  // F1 yarışları
  for (const race of f1Races) {
    if (!race.date || !race.time) continue;
    const date = parseUTC(`${race.date}T${race.time}`);
    if (date < start || date > end) continue;
    const id = `f1_${race.season}_r${race.round}`;
    if (seen.has(id)) continue;
    seen.add(id);
    matches.push({
      id,
      sport:         'motorsport',
      homeTeam:      `f1_r${race.round}`,
      awayTeam:      `f1_circuit_r${race.round}`,
      homeTeamName:  race.raceName,
      awayTeamName:  race.Circuit.circuitName,
      homeTeamColor: '#E10600',
      awayTeamColor: '#888',
      homeTeamEmoji: '',
      awayTeamEmoji: '',
      date,
      time:          formatLocalTime(date, tz),
      league:        'Formula 1',
      leagueId:      'formula1',
      leagueEmoji:   '',
      channel:       '',
      channels:      [],
      status:        'scheduled',
    });
  }

  // TheSportsDB motorsport (MotoGP, NASCAR, DTM, vb.)
  for (const e of motorDayArrays.flat()) {
    if (!e.idEvent || !e.strTimestamp || !e.strEvent) continue;
    if (seen.has(e.idEvent)) continue;
    seen.add(e.idEvent);
    const date = parseUTC(e.strTimestamp);
    if (date < start || date > end) continue;
    matches.push({
      id:            `tsdb_motor_${e.idEvent}`,
      sport:         'motorsport',
      homeTeam:      `motor_${e.idEvent}`,
      awayTeam:      `motor_circ_${e.idEvent}`,
      homeTeamName:  e.strEvent,
      awayTeamName:  e.strVenue ?? e.strCity ?? '',
      homeTeamColor: '#888',
      awayTeamColor: '#888',
      homeTeamEmoji: '',
      awayTeamEmoji: '',
      date,
      time:          formatLocalTime(date, tz),
      league:        e.strLeague,
      leagueId:      e.strLeague.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20),
      leagueEmoji:   '',
      channel:       '',
      channels:      [],
      status:        motorStatus(e.strStatus),
    });
  }

  const sorted = matches.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Cache'e kaydet
  try {
    await AsyncStorage.multiSet([
      [MCK(countryCode),  JSON.stringify(sorted)],
      [MCDK(countryCode), localDate],
      [MCTK(countryCode), Date.now().toString()],
    ]);
  } catch { /* depolama dolu */ }

  return sorted;
}

export async function clearMotorsportCache(countryCode?: string): Promise<void> {
  try {
    if (countryCode) {
      await AsyncStorage.multiRemove([
        MCK(countryCode), MCDK(countryCode), MCTK(countryCode),
      ]);
    } else {
      const allKeys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(allKeys.filter(k => k.startsWith('motor_v1_')));
    }
  } catch { /* */ }
}
