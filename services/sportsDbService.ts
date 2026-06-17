/**
 * sportsDbService.ts
 *
 * İki kaynak birleştirir:
 *   1. TheSportsDB WC 2026 sezon endpoint → tüm 104 WC maçı (12 saat cache)
 *   2. TheSportsDB günlük endpoint (dün+bugün+yarın UTC) → diğer ligler
 *
 * Tüm ülkeler için çalışır (TR dahil — hangikanalda ile merge edilir).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, MatchStatus, SportType } from '../constants/matches';

// ─── Ülke → Timezone ─────────────────────────────────────────────────────────

const COUNTRY_TZ: Record<string, string> = {
  // Avrupa
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
  BA: 'Europe/Sarajevo',
  // Amerika
  BR: 'America/Sao_Paulo',
  AR: 'America/Argentina/Buenos_Aires',
  MX: 'America/Mexico_City',
  US: 'America/New_York',
  CO: 'America/Bogota',
  EC: 'America/Guayaquil',
  UY: 'America/Montevideo',
  PY: 'America/Asuncion',
  CA: 'America/Toronto',
  // Asya / Orta Doğu
  SA: 'Asia/Riyadh',
  QA: 'Asia/Qatar',
  JO: 'Asia/Amman',
  IR: 'Asia/Tehran',
  UZ: 'Asia/Tashkent',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  // Afrika
  EG: 'Africa/Cairo',
  NG: 'Africa/Lagos',
  MA: 'Africa/Casablanca',
  SN: 'Africa/Dakar',
  ZA: 'Africa/Johannesburg',
  DZ: 'Africa/Algiers',
  TN: 'Africa/Tunis',
  GH: 'Africa/Accra',
  CI: 'Africa/Abidjan',
  CV: 'Atlantic/Cape_Verde',
};

// ─── WC yayın kanalları ülke başına ──────────────────────────────────────────

const WC_CHANNELS: Record<string, string> = {
  TR: 'TRT 1 / EXXEN',
  GB: 'BBC / ITV',
  FR: 'TF1 / M6',
  DE: 'ARD / ZDF',
  ES: 'La 1',
  IT: 'RAI 1',
  PT: 'RTP 1',
  BE: 'RTBF / VRT',
  NL: 'NOS',
  CH: 'SRF / RTS',
  HR: 'HRT',
  NO: 'NRK / TV2',
  AT: 'ORF',
  CZ: 'ČT Sport',
  BA: 'BHRT / Federalna TV',
  BR: 'TV Globo / SporTV',
  AR: 'TyC Sports / TV Pública',
  MX: 'TUDN / Azteca',
  US: 'FOX / Telemundo',
  CO: 'RCN / Caracol',
  EC: 'TC / Teleamazonas',
  UY: 'Canal 10 / VTV',
  PY: 'Tigo Sports / RPC',
  CA: 'CTV / TSN',
  SA: 'SSC Sport',
  QA: 'beIN Sports',
  JO: 'Jordan TV',
  IR: 'IRIB / Varzesh',
  UZ: 'Uzbekistan TV',
  JP: 'NHK / Fuji TV',
  KR: 'KBS / MBC',
  AU: 'SBS / Optus Sport',
  NZ: 'Sky Sport NZ',
  EG: 'beIN Sports Arabia',
  NG: 'SuperSport',
  MA: '2M / Arryadia',
  SN: 'Canal+ Afrique',
  ZA: 'SuperSport',
  DZ: 'ENTV / beIN Sports Arabia',
  TN: 'Watania 1',
  GH: 'GTV / SuperSport',
  CI: 'RTI / Canal+ Afrique',
  CV: 'RTC',
};

// Büyük ligler için ülke bazlı kanallar
const LEAGUE_CHANNELS: Record<string, Record<string, string>> = {
  '4480': { GB: 'TNT Sports', DE: 'DAZN', ES: 'Movistar+', FR: 'Canal+', IT: 'Sky Sport', BR: 'SporTV', AR: 'ESPN', TR: 'beIN Sports' },
  '4328': { GB: 'Sky Sports / TNT Sports', DE: 'Sky Sport', ES: 'DAZN', FR: 'Canal+', IT: 'Sky Sport', TR: 'beIN Sports' },
  '4335': { ES: 'DAZN / Movistar+', GB: 'LaLigaTV', DE: 'DAZN', TR: 'beIN Sports' },
  '4331': { DE: 'Sky Sport / DAZN', GB: 'Sky Sport', TR: 'beIN Sports' },
  '4332': { IT: 'DAZN / Sky Sport', GB: 'Sky Sport', TR: 'beIN Sports' },
  '4334': { FR: 'DAZN / Canal+', GB: 'Sky Sport', TR: 'beIN Sports' },
};

// Günlük endpoint için filtre — WC maçları sezon endpoint'ten zaten geliyor
const DAILY_ALLOWED_LEAGUES = new Set([
  '4429',  // FIFA World Cup (hem günlük hem sezon endpoint'ten gelir)
  '4480',  // UEFA Champions League
  '4328',  // English Premier League
  '4335',  // La Liga
  '4331',  // Bundesliga
  '4332',  // Serie A
  '4334',  // Ligue 1
  '4346',  // Copa Libertadores
  '4444',  // Copa America
  '4480',  // UEFA Nations League
  '4399',  // UEFA Euro
]);

// ─── TheSportsDB tipi ─────────────────────────────────────────────────────────

interface TSDBEvent {
  idEvent:      string;
  strTimestamp: string;   // "2026-06-15T19:00:00" (UTC, Z olmadan)
  strHomeTeam:  string;
  strAwayTeam:  string;
  strLeague:    string;
  idLeague:     string;
  strStatus:    string;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22);

function utcToLocal(utcStr: string, tz: string): { date: Date; timeStr: string } {
  // TheSportsDB timestamp bazen 'Z' içermez — her zaman UTC olarak işle
  const dateStr = utcStr.endsWith('Z') ? utcStr : utcStr + 'Z';
  const date = new Date(dateStr);
  const timeStr = date.toLocaleTimeString('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return { date, timeStr };
}

function localDateOf(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function getChannel(idLeague: string, cc: string): string {
  if (idLeague === '4429') return WC_CHANNELS[cc] ?? 'TV';
  return LEAGUE_CHANNELS[idLeague]?.[cc] ?? WC_CHANNELS[cc] ?? 'TV';
}

function eventToMatch(e: TSDBEvent, cc: string, tz: string, cacheDate: string): Match | null {
  if (!e.strTimestamp || !e.strHomeTeam || !e.strAwayTeam) return null;
  const { date, timeStr } = utcToLocal(e.strTimestamp, tz);
  const channel = getChannel(e.idLeague, cc);
  return {
    id:            `tsdb_${cc}_${cacheDate}_${e.idEvent}`,
    sport:         'football' as SportType,
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
    leagueId:      e.strLeague.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20),
    leagueEmoji:   '',
    channel,
    channels:      [channel],
    status:        'scheduled' as MatchStatus,
  };
}

// ─── Günlük cache ─────────────────────────────────────────────────────────────

const CK  = (cc: string) => `tsdb_daily_${cc}`;
const CDK = (cc: string) => `tsdb_daily_date_${cc}`;

async function readDailyCache(today: string, cc: string): Promise<Match[] | null> {
  try {
    if (await AsyncStorage.getItem(CDK(cc)) !== today) return null;
    const raw = await AsyncStorage.getItem(CK(cc));
    if (!raw) return null;
    return (JSON.parse(raw) as Match[]).map(m => ({ ...m, date: new Date(m.date) }));
  } catch { return null; }
}

async function writeDailyCache(matches: Match[], today: string, cc: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [CK(cc),  JSON.stringify(matches)],
      [CDK(cc), today],
    ]);
  } catch { /* depolama dolu */ }
}

// ─── WC 2026 Sezon cache (12 saat) ───────────────────────────────────────────

const WC_SEASON_KEY      = 'tsdb_wc2026_events';
const WC_SEASON_TIME_KEY = 'tsdb_wc2026_time';
const WC_SEASON_TTL      = 12 * 60 * 60 * 1000;  // 12 saat

async function fetchWC2026Season(): Promise<TSDBEvent[]> {
  try {
    const cachedTime = await AsyncStorage.getItem(WC_SEASON_TIME_KEY);
    if (cachedTime && Date.now() - parseInt(cachedTime, 10) < WC_SEASON_TTL) {
      const raw = await AsyncStorage.getItem(WC_SEASON_KEY);
      if (raw) return JSON.parse(raw) as TSDBEvent[];
    }

    const res = await fetch(
      'https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026',
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = (data.events ?? []) as TSDBEvent[];

    if (events.length > 0) {
      await AsyncStorage.multiSet([
        [WC_SEASON_KEY,      JSON.stringify(events)],
        [WC_SEASON_TIME_KEY, Date.now().toString()],
      ]);
    }
    return events;
  } catch { return []; }
}

// ─── Günlük endpoint ──────────────────────────────────────────────────────────

async function fetchDayEvents(dateStr: string): Promise<TSDBEvent[]> {
  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateStr}&s=Soccer`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events ?? []) as TSDBEvent[];
  } catch { return []; }
}

// ─── Ana export ───────────────────────────────────────────────────────────────

export async function fetchSportsDbMatches(countryCode: string): Promise<Match[]> {
  const cc  = countryCode;
  const tz  = COUNTRY_TZ[cc] ?? 'UTC';
  const today = new Date().toISOString().split('T')[0];  // UTC tarihi

  // 1. Günlük cache geçerliyse kullan
  const cached = await readDailyCache(today, cc);
  if (cached && cached.length > 0) return cached;

  // 2. Paralel çek: WC sezon + dün/bugün/yarın günlük
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const tomorrow  = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const [wcEvents, yEvents, tEvents, tmEvents] = await Promise.all([
    fetchWC2026Season(),
    fetchDayEvents(yesterday),
    fetchDayEvents(today),
    fetchDayEvents(tomorrow),
  ]);

  // 3. Birleştir + idEvent bazlı deduplicate
  const seen = new Set<string>();
  const merged: TSDBEvent[] = [];
  for (const e of [...wcEvents, ...yEvents, ...tEvents, ...tmEvents]) {
    if (e.idEvent && !seen.has(e.idEvent)) {
      seen.add(e.idEvent);
      merged.push(e);
    }
  }

  // 4. Günlük endpoint sonuçları için lig filtresi uygula.
  //    WC sezon eventi (4429) her durumda geçer; günlük diğer eventi DAILY_ALLOWED_LEAGUES'e bakır.
  const wcSeasonIds = new Set(wcEvents.map(e => e.idEvent));
  const filtered = merged.filter(e =>
    wcSeasonIds.has(e.idEvent) || DAILY_ALLOWED_LEAGUES.has(e.idLeague),
  );

  // 5. Yerel tarihe göre filtrele (bugün yerel = localToday)
  const localToday = localDateOf(new Date(), tz);

  const dayMatches: Match[] = [];
  for (const e of filtered) {
    if (!e.strTimestamp) continue;
    const { date, timeStr } = utcToLocal(e.strTimestamp, tz);
    if (localDateOf(date, tz) !== localToday) continue;  // Yerelde bugün değil → atla

    const m = eventToMatch(e, cc, tz, today);
    if (m) {
      m.time = timeStr;   // eventToMatch içinde de ayarlanıyor ama güvence için
      dayMatches.push(m);
    }
  }

  const sorted = dayMatches.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // 6. Cache'e kaydet
  if (sorted.length > 0) await writeDailyCache(sorted, today, cc);
  return sorted;
}

export async function clearSportsDbCache(countryCode?: string): Promise<void> {
  try {
    if (countryCode) {
      await AsyncStorage.multiRemove([CK(countryCode), CDK(countryCode)]);
    } else {
      const allKeys = await AsyncStorage.getAllKeys();
      const daily   = allKeys.filter(k => k.startsWith('tsdb_daily_'));
      await AsyncStorage.multiRemove([
        ...daily,
        WC_SEASON_KEY,
        WC_SEASON_TIME_KEY,
      ]);
    }
  } catch { /* */ }
}
