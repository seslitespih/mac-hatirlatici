/**
 * apiService.ts
 * Veri kaynakları (öncelik sırasıyla):
 *  1. Groq compound-beta  — bugünkü maçlar + doğru kanal (web araması)
 *  2. ESPN Public API     — futbol + NBA (kanal bilgisi statik)
 *  3. Statik haftalık     — 1. Lig, EuroLeague, EuroCup, BSL, Voleybol, F1
 *
 * SAAT: Tüm ESPN tarihleri Intl.DateTimeFormat ile Europe/Istanbul'a çevrilir.
 */

import axios from 'axios';
import { fetchMatchesFromGroq } from './groqService';
import { Match, MatchStatus, SportType } from '../constants/matches';
import { getChannelForCountry } from '../constants/countryChannels';

// ─── ESPN API istemcisi ──────────────────────────────────────────────────────

const ESPN_SOCCER = axios.create({
  baseURL: 'https://site.api.espn.com/apis/site/v2/sports/soccer',
  timeout: 10_000,
});

const ESPN_BASKET = axios.create({
  baseURL: 'https://site.api.espn.com/apis/site/v2/sports/basketball',
  timeout: 10_000,
});

// ─── ESPN lig tanımları ─────────────────────────────────────────────────────

interface ESPNLeague {
  slug: string;      // ESPN endpoint slug
  leagueId: string;  // iç kanal eşleme ID'si
  name: string;      // Türkçe görünen ad
  sport: SportType;
}

const FOOTBALL_LEAGUES: ESPNLeague[] = [
  { slug: 'tur.1',              leagueId: 'superlig',   name: 'Süper Lig',               sport: 'football' },
  { slug: 'eng.1',              leagueId: 'premier',    name: 'Premier League',           sport: 'football' },
  { slug: 'esp.1',              leagueId: 'laliga',     name: 'La Liga',                  sport: 'football' },
  { slug: 'ger.1',              leagueId: 'bundesliga', name: 'Bundesliga',               sport: 'football' },
  { slug: 'ita.1',              leagueId: 'seriea',     name: 'Serie A',                  sport: 'football' },
  { slug: 'fra.1',              leagueId: 'ligue1',     name: 'Ligue 1',                  sport: 'football' },
  { slug: 'ksa.1',              leagueId: 'saudi',      name: 'Suudi Arabistan Pro Lig',  sport: 'football' },
  { slug: 'por.1',              leagueId: 'liganos',    name: 'Portekiz Primeira Liga',   sport: 'football' },
  { slug: 'uefa.champions',     leagueId: 'champions',  name: 'Şampiyonlar Ligi',         sport: 'football' },
  { slug: 'uefa.europa',        leagueId: 'europa',     name: 'Avrupa Ligi',              sport: 'football' },
];

// ─── ESPN event tipi ─────────────────────────────────────────────────────────

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  team: { displayName: string; shortDisplayName?: string; id?: string };
}

interface ESPNEvent {
  id: string;
  date: string; // ISO 8601 UTC
  competitions: Array<{
    competitors: ESPNCompetitor[];
    status: { type: { name: string; completed: boolean } };
  }>;
}

function mapESPNStatus(typeName: string): MatchStatus {
  const s = typeName.toLowerCase();
  if (s.includes('in_progress') || s.includes('halftime')) return 'live';
  if (s.includes('post') || s.includes('final') || s.includes('complete')) return 'finished';
  return 'scheduled';
}

function normalizeId(name: string): string {
  return name.toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[ıİ]/g, 'i')
    .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20);
}

// ESPN'de home/away bazen ters gelir, competitors[homeAway] ile düzeltelim
function getHomeAway(comp: ESPNEvent['competitions'][0]) {
  const home = comp.competitors.find((c) => c.homeAway === 'home') ?? comp.competitors[0];
  const away = comp.competitors.find((c) => c.homeAway === 'away') ?? comp.competitors[1];
  return { home, away };
}

async function fetchESPNLeague(league: ESPNLeague, countryCode: string): Promise<Match[]> {
  try {
    // Bugün + yarın için tarih aralığı çek
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const week = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
    const weekStr = week.toISOString().slice(0, 10).replace(/-/g, '');

    const resp = await ESPN_SOCCER.get(`/${league.slug}/scoreboard`, {
      params: { dates: `${todayStr}-${weekStr}`, limit: 200 },
    });

    const events: ESPNEvent[] = resp.data?.events ?? [];
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const matches: Match[] = [];
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const eventDate = new Date(event.date);
      if (eventDate < now || eventDate > weekLater) continue;

      const { home, away } = getHomeAway(comp);
      if (!home || !away) continue;

      const homeId = normalizeId(home.team.displayName);
      const awayId = normalizeId(away.team.displayName);
      const channel = getChannelForCountry(countryCode, league.leagueId, homeId);

      // Türkiye saatine göre saat — cihaz timezone'undan bağımsız, her zaman UTC+3
      const trTime = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(eventDate);
      const [h = '00', m = '00'] = trTime.split(':');

      matches.push({
        id: `espn_${event.id}`,
        sport: league.sport,
        homeTeam: homeId,
        awayTeam: awayId,
        homeTeamName: home.team.displayName,
        awayTeamName: away.team.displayName,
        homeTeamColor: '#888888',
        awayTeamColor: '#888888',
        homeTeamEmoji: '',
        awayTeamEmoji: '',
        date: eventDate,
        time: `${h}:${m}`,
        league: league.name,
        leagueId: league.leagueId,
        leagueEmoji: '',
        channel,
        status: mapESPNStatus(comp.status?.type?.name ?? ''),
      });
    }
    return matches;
  } catch {
    return [];
  }
}

async function fetchESPNNBA(countryCode: string): Promise<Match[]> {
  try {
    const resp = await ESPN_BASKET.get('/nba/scoreboard');
    const events: ESPNEvent[] = resp.data?.events ?? [];
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const matches: Match[] = [];
    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const eventDate = new Date(event.date);
      if (eventDate < now || eventDate > weekLater) continue;

      const { home, away } = getHomeAway(comp);
      if (!home || !away) continue;

      const trTimeNba = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(eventDate);
      const [h = '00', m = '00'] = trTimeNba.split(':');

      matches.push({
        id: `espn_nba_${event.id}`,
        sport: 'basketball',
        homeTeam: normalizeId(home.team.displayName),
        awayTeam: normalizeId(away.team.displayName),
        homeTeamName: home.team.displayName,
        awayTeamName: away.team.displayName,
        homeTeamColor: '#888888',
        awayTeamColor: '#888888',
        homeTeamEmoji: '',
        awayTeamEmoji: '',
        date: eventDate,
        time: `${h}:${m}`,
        league: 'NBA',
        leagueId: 'nba',
        leagueEmoji: '',
        channel: getChannelForCountry(countryCode, 'nba'),
        status: mapESPNStatus(comp.status?.type?.name ?? ''),
      });
    }
    return matches;
  } catch {
    return [];
  }
}

// ─── Statik: Trendyol 1. Lig (ESPN desteklemiyor) ───────────────────────────
// Haziran 2026 fikstürü — haftaya bir güncelle

function getTr1LigStatic(countryCode: string): Match[] {
  const fixtures: Array<[string, string, string, string, string, string]> = [
    // [date, time+03:00 = Istanbul, homeId, homeName, awayId, awayName]
    ['2026-06-07', '14:30', 'adanademirspor', 'Adana Demirspor', 'manisafk',    'Manisa FK'],
    ['2026-06-07', '17:00', 'pendikspor',     'Pendikspor',      'hatayspor',   'Hatayspor'],
    ['2026-06-07', '20:00', 'bodrumspor',     'Bodrumspor',      'umraniyespor','Ümraniyespor'],
    ['2026-06-07', '20:00', 'corumfk',        'Çorum FK',        'bandirmaspor','Bandırmaspor'],
    ['2026-06-11', '19:00', 'eyupspor',       'Eyüpspor',        'adanademirspor','Adana Demirspor'],
    ['2026-06-11', '19:00', 'hatayspor',      'Hatayspor',       'boluspor',    'Boluspor'],
    ['2026-06-11', '19:00', 'manisafk',       'Manisa FK',       'bodrumspor',  'Bodrumspor'],
    ['2026-06-11', '21:00', 'pendikspor',     'Pendikspor',      'altay',       'Altay'],
    ['2026-06-12', '19:00', 'umraniyespor',   'Ümraniyespor',    'corumfk',     'Çorum FK'],
    ['2026-06-12', '21:00', 'bandirmaspor',   'Bandırmaspor',    'sakaryaspor', 'Sakaryaspor'],
  ];

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return fixtures
    .map(([date, time, homeId, homeName, awayId, awayName]) => {
      const d = istDate(date, time);
      return {
        id: `tr1_${date}_${homeId}`,
        sport: 'football' as SportType,
        homeTeam: homeId, awayTeam: awayId,
        homeTeamName: homeName, awayTeamName: awayName,
        homeTeamColor: '#888', awayTeamColor: '#888',
        homeTeamEmoji: '', awayTeamEmoji: '',
        date: d, time,
        league: 'Trendyol 1. Lig', leagueId: 'lig1', leagueEmoji: '',
        channel: getChannelForCountry(countryCode, 'lig1'),
        status: 'scheduled' as MatchStatus,
      };
    })
    .filter((m) => m.date >= now && m.date <= weekLater);
}

// ─── Statik: EuroLeague + EuroCup basketbol ──────────────────────────────────

function getBasketballStatic(countryCode: string): Match[] {
  const fixtures: Array<[string, string, string, string, string, string, string, string]> = [
    // [date, time Istanbul, homeId, homeName, awayId, awayName, league, leagueId]
    ['2026-06-07', '21:00', 'asvelvilleurbanne', 'Asvel Villeurbanne', 'olympiakos',    'Olympiakos',      'EuroLeague Finals', 'euroleague'],
    ['2026-06-07', '21:30', 'baskonia',          'Baskonia',           'realmadrid_bb', 'Real Madrid',     'EuroLeague Finals', 'euroleague'],
    ['2026-06-09', '20:00', 'anadoluefes',       'Anadolu Efes',       'fenerbahcebeko','Fenerbahçe Beko', 'BSL Playoff',       'bsl'],
    ['2026-06-09', '20:00', 'galatasaray_bb',    'Galatasaray',        'besiktasgain',  'Beşiktaş GAIN',   'BSL Playoff',       'bsl'],
    ['2026-06-11', '20:00', 'anadoluefes',       'Anadolu Efes',       'fenerbahcebeko','Fenerbahçe Beko', 'BSL Playoff',       'bsl'],
    ['2026-06-14', '21:00', 'virtusbologna',     'Virtus Bologna',     'valenciabasket','Valencia Basket', 'EuroLeague Finals', 'euroleague'],
  ];

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return fixtures
    .map(([date, time, homeId, homeName, awayId, awayName, league, leagueId]) => {
      const d = istDate(date, time);
      return {
        id: `bb_${date}_${homeId}`,
        sport: 'basketball' as SportType,
        homeTeam: homeId, awayTeam: awayId,
        homeTeamName: homeName, awayTeamName: awayName,
        homeTeamColor: '#888', awayTeamColor: '#888',
        homeTeamEmoji: '', awayTeamEmoji: '',
        date: d, time,
        league, leagueId, leagueEmoji: '',
        channel: getChannelForCountry(countryCode, leagueId),
        status: 'scheduled' as MatchStatus,
      };
    })
    .filter((m) => m.date >= now && m.date <= weekLater);
}

// ─── Statik: Voleybol ────────────────────────────────────────────────────────

function getVolleyballStatic(countryCode: string): Match[] {
  const fixtures: Array<[string, string, string, string, string, string, string, string]> = [
    // Voleybol sezonu Mayıs sonu biter — Haziran'da maç yoktur, Groq AI ile doldurulur
    // Eylül'de güncelle: ['2026-09-XX', ...]
  ];

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return fixtures
    .map(([date, time, homeId, homeName, awayId, awayName, league, leagueId]) => {
      const d = istDate(date, time);
      return {
        id: `vb_${date}_${homeId}`,
        sport: 'volleyball' as SportType,
        homeTeam: homeId, awayTeam: awayId,
        homeTeamName: homeName, awayTeamName: awayName,
        homeTeamColor: '#888', awayTeamColor: '#888',
        homeTeamEmoji: '', awayTeamEmoji: '',
        date: d, time,
        league, leagueId, leagueEmoji: '',
        channel: getChannelForCountry(countryCode, leagueId),
        status: 'scheduled' as MatchStatus,
      };
    })
    .filter((m) => m.date >= now && m.date <= weekLater);
}

// ─── Statik: F1 2026 ─────────────────────────────────────────────────────────

const F1_2026: Array<{ name: string; circuit: string; date: string; time: string }> = [
  { name: 'Japonya GP',         circuit: 'Suzuka',            date: '2026-04-06', time: '07:00' },
  { name: 'Çin GP',             circuit: 'Şangay',            date: '2026-04-19', time: '09:00' },
  { name: 'Miami GP',           circuit: 'Miami',             date: '2026-05-04', time: '22:00' },
  { name: 'Emilia-Romagna GP',  circuit: 'Imola',             date: '2026-05-18', time: '15:00' },
  { name: 'Monako GP',          circuit: 'Monako',            date: '2026-05-25', time: '15:00' },
  { name: 'İspanya GP',         circuit: 'Barselona',         date: '2026-06-01', time: '15:00' },
  { name: 'Kanada GP',          circuit: 'Montreal',          date: '2026-06-15', time: '20:00' },
  { name: 'Avusturya GP',       circuit: 'Spielberg',         date: '2026-06-29', time: '15:00' },
  { name: 'İngiltere GP',       circuit: 'Silverstone',       date: '2026-07-06', time: '16:00' },
  { name: 'Belçika GP',         circuit: 'Spa-Francorchamps', date: '2026-07-27', time: '15:00' },
  { name: 'Macaristan GP',      circuit: 'Budapeşte',         date: '2026-08-03', time: '15:00' },
  { name: 'Hollanda GP',        circuit: 'Zandvoort',         date: '2026-08-31', time: '15:00' },
  { name: 'İtalya GP',          circuit: 'Monza',             date: '2026-09-07', time: '15:00' },
  { name: 'Azerbaycan GP',      circuit: 'Bakü',              date: '2026-09-21', time: '14:00' },
  { name: 'Singapur GP',        circuit: 'Singapur',          date: '2026-10-05', time: '14:00' },
  { name: 'ABD GP',             circuit: 'Austin',            date: '2026-10-19', time: '21:00' },
  { name: 'Meksika GP',         circuit: 'Meksika City',      date: '2026-10-26', time: '22:00' },
  { name: 'Brezilya GP',        circuit: 'São Paulo',         date: '2026-11-09', time: '19:00' },
  { name: 'Las Vegas GP',       circuit: 'Las Vegas',         date: '2026-11-23', time: '07:00' },
  { name: 'Katar GP',           circuit: 'Lusail',            date: '2026-11-30', time: '18:00' },
  { name: 'Abu Dabi GP',        circuit: 'Yas Marina',        date: '2026-12-07', time: '14:00' },
];

function buildF1Matches(countryCode: string): Match[] {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return F1_2026
    .map((race) => {
      const date = istDate(race.date, race.time);
      return {
        id: `f1_${race.date.replace(/-/g, '')}`,
        sport: 'motorsport' as SportType,
        homeTeam: 'f1race', awayTeam: 'f1race',
        homeTeamName: race.name, awayTeamName: race.circuit,
        homeTeamColor: '#e10600', awayTeamColor: '#e10600',
        homeTeamEmoji: '', awayTeamEmoji: '',
        date, time: race.time,
        league: 'Formula 1', leagueId: 'f1', leagueEmoji: '',
        channel: getChannelForCountry(countryCode, 'f1'),
        status: 'scheduled' as MatchStatus,
      };
    })
    .filter((m) => m.date >= now && m.date <= weekLater);
}

// ─── Yardımcı: Istanbul timezone'unda tarih oluştur ─────────────────────────
// new Date('2026-06-07T20:00:00') cihaz timezone'unu alır — bu UTC+3 zorlar
function istDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+03:00`);
}

// ─── Ana export ─────────────────────────────────────────────────────────────

export async function fetchAllSports(countryCode: string = 'TR'): Promise<Match[]> {
  const seen = new Set<string>();
  const results: Match[] = [];

  function addUnique(matches: Match[]) {
    for (const m of matches) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        results.push(m);
      }
    }
  }

  // 1. Groq AI: ülkeye özel bugünkü maçlar + doğru kanal bilgisi
  try {
    const groqMatches = await fetchMatchesFromGroq(countryCode);
    if (groqMatches.length > 0) addUnique(groqMatches);
  } catch { /* Groq başarısız → ESPN'e düş */ }

  // 2. ESPN API çağrıları paralel (Groq'tan gelmeyen maçları tamamlar)
  const footballResults = await Promise.all(
    FOOTBALL_LEAGUES.map((l) => fetchESPNLeague(l, countryCode))
  );
  footballResults.forEach(addUnique);

  const nbaMatches = await fetchESPNNBA(countryCode);
  addUnique(nbaMatches);

  // 3. Statik veriler
  addUnique(getTr1LigStatic(countryCode));
  addUnique(getBasketballStatic(countryCode));
  addUnique(getVolleyballStatic(countryCode));
  addUnique(buildF1Matches(countryCode));

  return results;
}

export async function fetchWeeklyMatchesFromAPI(countryCode: string = 'TR'): Promise<Match[]> {
  const all = await fetchAllSports(countryCode);
  return all.filter((m) => m.sport === 'football');
}

export function isApiConfigured() {
  return { footballData: true, rapidApi: true };
}
