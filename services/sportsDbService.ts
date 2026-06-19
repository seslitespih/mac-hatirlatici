/**
 * sportsDbService.ts
 *
 * Veri kaynakları:
 *   1. TheSportsDB WC 2026 sezon endpoint  → tüm 104 WC maçı (12h cache)
 *   2. TheSportsDB günlük endpoint          → diğer büyük ligler
 *   3. channelService                       → kanal bilgisi (remote JSON + local fallback)
 *
 * Gösterim penceresi: bugün 00:00 → ertesi gün 09:00 (user timezone)
 * Cache: 60dk TTL + gün değişimi kontrolü
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, MatchStatus, SportType } from '../constants/matches';
import { getMatchWindow, getUTCDatesForWindow, localDateOf, formatLocalTime } from '../utils/timezone';
import { getChannelMap, getFirstChannel } from './channelService';

// ─── Ülke → IANA Timezone ────────────────────────────────────────────────────

export const COUNTRY_TZ: Record<string, string> = {
  TR: 'Europe/Istanbul',
  GB: 'Europe/London',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  IT: 'Europe/Rome',
  BE: 'Europe/Brussels',
  NL: 'Europe/Amsterdam',
  CH: 'Europe/Zurich',
  HR: 'Europe/Zagreb',
  NO: 'Europe/Oslo',
  AT: 'Europe/Vienna',
  CZ: 'Europe/Prague',
  BR: 'America/Sao_Paulo',
  AR: 'America/Argentina/Buenos_Aires',
  MX: 'America/Mexico_City',
  US: 'America/New_York',
  CO: 'America/Bogota',
  CA: 'America/Toronto',
  SA: 'Asia/Riyadh',
  QA: 'Asia/Qatar',
  IR: 'Asia/Tehran',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  EG: 'Africa/Cairo',
  NG: 'Africa/Lagos',
  MA: 'Africa/Casablanca',
  SN: 'Africa/Dakar',
  ZA: 'Africa/Johannesburg',
  DZ: 'Africa/Algiers',
  TN: 'Africa/Tunis',
  GH: 'Africa/Accra',
  CL: 'America/Santiago',
  PE: 'America/Lima',
  AE: 'Asia/Dubai',
};

// ─── TheSportsDB lig filtreleri ──────────────────────────────────────────────

const ALLOWED_LEAGUES = new Set([
  '4429',  // FIFA World Cup
  '4480',  // UEFA Champions League
  '4328',  // English Premier League
  '4335',  // La Liga
  '4331',  // Bundesliga
  '4332',  // Serie A
  '4334',  // Ligue 1
  '4346',  // Copa Libertadores
  '4444',  // Copa America
  '4399',  // UEFA Euro
  '4481',  // UEFA Nations League
]);

// Küçük/bölgesel basketbol ligleri engelleniyor; büyükler (NBA, EuroLeague, FIBA WC) geçer
const BLOCKED_BASKETBALL_LEAGUES = new Set([
  '4516',  // WNBA
  '5066',  // New Zealand NBL
  '5266',  // Canadian Elite Basketball League
  '5671',  // NBL1 South (Avustralya bölgesel)
]);

// TheSportsDB lig ID → kanal servisindeki leagueId eşlemesi
const LEAGUE_ID_MAP: Record<string, string> = {
  '4429': 'wc2026',
  '4480': 'champions',
  '4328': 'premier',
  '4335': 'laliga',
  '4331': 'bundesliga',
  '4332': 'seriea',
  '4334': 'ligue1',
  '4346': 'copalibertadores',
  '4444': 'copaamaerica',
  '4399': 'euro',
  '4481': 'nations',
};

// ─── TheSportsDB tip tanımı ───────────────────────────────────────────────────

interface TSDBEvent {
  idEvent:      string;
  strTimestamp: string;   // "2026-06-15T19:00:00" (UTC, Z olmadan)
  strHomeTeam:  string;
  strAwayTeam:  string;
  strLeague:    string;
  idLeague:     string;
  strStatus:    string;
  _sport?:      SportType; // fetch sırasında tag'lenir
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22);

function mapStatus(s: string): MatchStatus {
  const l = s?.toLowerCase() ?? '';
  if (l === 'inprogress' || l === 'ht') return 'live';
  if (l === 'ft' || l === 'aet' || l === 'pen') return 'finished';
  return 'scheduled';
}

function parseUTC(ts: string): Date {
  return new Date(ts.endsWith('Z') ? ts : ts + 'Z');
}

function buildMatch(
  e: TSDBEvent,
  cc: string,
  tz: string,
  channelMap: Awaited<ReturnType<typeof getChannelMap>>,
): Match | null {
  if (!e.strTimestamp || !e.strHomeTeam || !e.strAwayTeam) return null;
  const date    = parseUTC(e.strTimestamp);
  const timeStr = formatLocalTime(date, tz);
  const leagueId = LEAGUE_ID_MAP[e.idLeague] ?? e.strLeague.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  const channel  = getFirstChannel(channelMap, cc, leagueId);

  return {
    id:            `tsdb_${cc}_${e.idEvent}`,
    sport:         e._sport ?? 'football',
    homeTeam:      norm(e.strHomeTeam),
    awayTeam:      norm(e.strAwayTeam),
    homeTeamName:  e.strHomeTeam,
    awayTeamName:  e.strAwayTeam,
    homeTeamColor: '#888',
    awayTeamColor: '#888',
    homeTeamEmoji: '',
    awayTeamEmoji: '',
    date,
    time:          timeStr,
    league:        e.strLeague,
    leagueId,
    leagueEmoji:   '',
    channel,
    channels:      channel ? [channel] : [],
    status:        mapStatus(e.strStatus),
  };
}

// ─── Cache (60dk TTL + gün kontrolü) ─────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000;   // 60 dakika

const CK   = (cc: string) => `tsdb_v5_${cc}`;
const CDK  = (cc: string) => `tsdb_v5_date_${cc}`;
const CTK  = (cc: string) => `tsdb_v5_time_${cc}`;

async function readCache(localDate: string, cc: string): Promise<Match[] | null> {
  try {
    const [dateRaw, timeRaw, dataRaw] = await Promise.all([
      AsyncStorage.getItem(CDK(cc)),
      AsyncStorage.getItem(CTK(cc)),
      AsyncStorage.getItem(CK(cc)),
    ]);
    if (dateRaw !== localDate) return null;                                    // gün değişmiş
    if (!timeRaw || Date.now() - parseInt(timeRaw, 10) > CACHE_TTL_MS) return null; // 60dk geçmiş
    if (!dataRaw) return null;
    return (JSON.parse(dataRaw) as Match[]).map(m => ({ ...m, date: new Date(m.date) }));
  } catch { return null; }
}

async function writeCache(matches: Match[], localDate: string, cc: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [CK(cc),  JSON.stringify(matches)],
      [CDK(cc), localDate],
      [CTK(cc), Date.now().toString()],
    ]);
  } catch { /* depolama dolu */ }
}

// ─── Günlük endpoint ──────────────────────────────────────────────────────────

async function fetchDayEvents(dateStr: string, sport?: string, leagueId?: string): Promise<TSDBEvent[]> {
  try {
    let url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateStr}`;
    if (sport)    url += `&s=${sport}`;
    if (leagueId) url += `&l=${leagueId}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events ?? []) as TSDBEvent[];
  } catch { return []; }
}

// ─── Ana export ───────────────────────────────────────────────────────────────

export async function fetchSportsDbMatches(countryCode: string): Promise<Match[]> {
  const cc  = countryCode;
  const tz  = COUNTRY_TZ[cc] ?? 'UTC';
  const now = new Date();

  // Gösterim penceresi: bugün 00:00 → ertesi gün 09:00 (user TZ)
  const { start, end }  = getMatchWindow(tz);
  const localDate       = localDateOf(now, tz);   // cache anahtarı için

  // 1. Cache geçerli mi?
  const cached = await readCache(localDate, cc);
  if (cached !== null) return cached;

  // 2. Pencere için gereken UTC günlerini belirle (1-3 gün)
  const utcDates = getUTCDatesForWindow(start, end);

  // 3. Paralel fetch — futbol + basketbol + voleybol
  const tag = (sport: SportType) => (evs: TSDBEvent[]) =>
    evs.map(e => ({ ...e, _sport: sport }));

  // WC günlük endpoint (l=4429) tüm maçları döndürür; s=Soccer bazen eksik bırakır
  const dayEventsArr = await Promise.all(
    utcDates.flatMap(d => [
      fetchDayEvents(d, 'Soccer').then(tag('football')),
      fetchDayEvents(d, undefined, '4429').then(tag('football')),  // WC 2026 tam liste
      fetchDayEvents(d, 'Basketball').then(tag('basketball')),
      fetchDayEvents(d, 'Volleyball').then(tag('volleyball')),
    ]),
  );

  // 4. Deduplicate
  const seen   = new Set<string>();
  const merged: TSDBEvent[] = [];

  for (const e of dayEventsArr.flat()) {
    if (!e.idEvent || seen.has(e.idEvent)) continue;
    seen.add(e.idEvent);

    if (e._sport === 'football') {
      // Futbol: sadece izin verilen ligler (WC 2026 = 4429 dahil)
      if (ALLOWED_LEAGUES.has(e.idLeague)) merged.push(e);
    } else if (e._sport === 'basketball') {
      // Basketbol: küçük/bölgesel ligleri engelle; NBA, EuroLeague, FIBA WC geçer
      if (!BLOCKED_BASKETBALL_LEAGUES.has(e.idLeague) && e.strHomeTeam && e.strAwayTeam && e.strHomeTeam !== 'None') {
        merged.push(e);
      }
    } else {
      // Voleybol: takım adı geçerliyse göster
      if (e.strHomeTeam && e.strAwayTeam && e.strHomeTeam !== 'None') {
        merged.push(e);
      }
    }
  }

  // 5. Kanal verisini yükle
  const channelMap = await getChannelMap();

  // 6. Pencere filtresi + Match dönüşümü
  const matches: Match[] = [];
  for (const e of merged) {
    const m = buildMatch(e, cc, tz, channelMap);
    if (!m) continue;
    if (m.date < start || m.date > end) continue;   // pencere dışı → atla
    matches.push(m);
  }

  const sorted = matches.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 7. Cache'e kaydet
  if (sorted.length > 0) await writeCache(sorted, localDate, cc);
  return sorted;
}

export async function clearSportsDbCache(countryCode?: string): Promise<void> {
  try {
    if (countryCode) {
      await AsyncStorage.multiRemove([CK(countryCode), CDK(countryCode), CTK(countryCode)]);
    } else {
      const allKeys = await AsyncStorage.getAllKeys();
      const toRemove = allKeys.filter(k => k.startsWith('tsdb_'));
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch { /* */ }
}
