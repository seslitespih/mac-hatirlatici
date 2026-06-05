/**
 * groqService.ts
 *
 * Her ülke için günde 1 kez Groq compound-beta ile web araması yapar.
 * Ülkenin yerel saati ve yerel kanallarıyla doğru veri döndürür.
 *
 * TR → kullanılmaz (hangikanalda.app kullanılır)
 * Diğer ülkeler → bu servis
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Match, MatchStatus, SportType } from '../constants/matches';
import Constants from 'expo-constants';
import { COUNTRY_STORAGE_KEY } from '../i18n';

// ─── Ülke yapılandırması ──────────────────────────────────────────────────────

interface CountryCfg {
  tz:       string;   // IANA timezone
  tzLabel:  string;   // Prompt için (ör. "UTC-3 (Brasília)")
  lang:     string;   // Prompt dili
  channels: string;   // Bilinen yerel kanallar
  sites:    string;   // Web arama öncelikli siteler
}

const COUNTRY_CFG: Record<string, CountryCfg> = {
  GB: {
    tz: 'Europe/London',
    tzLabel: 'UTC+0/+1 (London)',
    lang: 'English',
    channels: 'Sky Sports Main Event, Sky Sports Football, Sky Sports Premier League, TNT Sports 1, TNT Sports 2, BBC One, ITV, Channel 4, Amazon Prime Video',
    sites: 'livesoccertv.com, skysports.com, bbc.co.uk/sport, tvsportsguide.co.uk',
  },
  ES: {
    tz: 'Europe/Madrid',
    tzLabel: 'UTC+1/+2 (Madrid)',
    lang: 'Spanish',
    channels: 'DAZN 1, DAZN 2, Movistar+ LaLiga, Movistar+ Liga de Campeones, La 1, Telecinco, Cuatro, TV3',
    sites: 'livesoccertv.com, relevo.com, marca.com, mundodeportivo.com',
  },
  PT: {
    tz: 'Europe/Lisbon',
    tzLabel: 'UTC+0/+1 (Lisbon)',
    lang: 'Portuguese',
    channels: 'Sport TV 1, Sport TV 2, Sport TV 3, Sport TV 4, RTP 1, RTP 2, SIC, TVI, Canal+',
    sites: 'livesoccertv.com, record.pt, maisfutebol.iol.pt, sport.pt',
  },
  FR: {
    tz: 'Europe/Paris',
    tzLabel: 'UTC+1/+2 (Paris)',
    lang: 'French',
    channels: 'Canal+, Canal+ Sport, DAZN 1, DAZN 2, TF1, France 2, France 3, M6, W9, beIN Sports 1, beIN Sports 2',
    sites: 'livesoccertv.com, lequipe.fr, footmercato.net, programme-tv.net',
  },
  DE: {
    tz: 'Europe/Berlin',
    tzLabel: 'UTC+1/+2 (Berlin)',
    lang: 'German',
    channels: 'Sky Sport Bundesliga 1, Sky Sport Bundesliga 2, Sky Sport Football, Sky Sport Top Event, DAZN 1, DAZN 2, ARD, ZDF, RTL, SAT.1, ProSieben, MagentaSport',
    sites: 'livesoccertv.com, kicker.de, sport1.de, sportschau.de, dazn.com/de-DE',
  },
  IT: {
    tz: 'Europe/Rome',
    tzLabel: 'UTC+1/+2 (Rome)',
    lang: 'Italian',
    channels: 'DAZN 1, DAZN 2, Sky Sport Calcio, Sky Sport Football, Sky Sport Uno, Canale 5, RAI 1, RAI 2, RAI Sport',
    sites: 'livesoccertv.com, gazzetta.it, corrieredellosport.it, calciomercato.com',
  },
  SA: {
    tz: 'Asia/Riyadh',
    tzLabel: 'UTC+3 (Riyadh)',
    lang: 'Arabic',
    channels: 'beIN Sports Arabia 1, beIN Sports Arabia 2, beIN Sports Arabia 3, beIN Sports Arabia 4, MBC Sport 1, MBC Sport 2, SSC Sport 1, SSC Sport 2',
    sites: 'livesoccertv.com, beinsports.com/ar, sscnews.sa, kooora.com',
  },
  BR: {
    tz: 'America/Sao_Paulo',
    tzLabel: 'UTC-3 (Brasília)',
    lang: 'Portuguese (Brazilian)',
    channels: 'TV Globo, SporTV, SporTV 2, SporTV 3, ESPN, ESPN 2, ESPN 3, Band, TNT Sports, Cazé TV, Star+, Amazon Prime, GOAT',
    sites: 'ge.globo.com, espn.com.br, casadosportes.com.br, livesoccertv.com/BR',
  },
  AR: {
    tz: 'America/Argentina/Buenos_Aires',
    tzLabel: 'UTC-3 (Buenos Aires)',
    lang: 'Spanish (Argentine)',
    channels: 'TyC Sports, TyC Sports 2, ESPN, ESPN 2, ESPN Premium, Fox Sports, DirecTV Sports, TNT Sports, TV Pública, Telefe',
    sites: 'tycsports.com, espn.com.ar, ole.com.ar, livesoccertv.com/AR',
  },
  MX: {
    tz: 'America/Mexico_City',
    tzLabel: 'UTC-6 (Ciudad de México)',
    lang: 'Spanish (Mexican)',
    channels: 'TUDN, Canal 5 (Televisa), Azteca 7, Azteca Deportes, Fox Sports, Fox Sports 2, Sky Sports, ESPN, ESPN 2',
    sites: 'mediotiempo.com, record.com.mx, tudn.com, livesoccertv.com/MX',
  },
  EG: {
    tz: 'Africa/Cairo',
    tzLabel: 'UTC+2/+3 (Cairo)',
    lang: 'Arabic',
    channels: 'beIN Sports Arabia 1, beIN Sports Arabia 2, ON Sport, ON Time Sport, CBC Sport, Al Kahera Wal Nas, MBC Sport 1',
    sites: 'livesoccertv.com, beinsports.com/ar, on-e.com.eg, filgoal.com',
  },
  NG: {
    tz: 'Africa/Lagos',
    tzLabel: 'UTC+1 (Lagos)',
    lang: 'English (Nigerian)',
    channels: 'SuperSport Premier League, SuperSport Football, SuperSport Blitz, DSTV, NTA Sports, Arise TV',
    sites: 'livesoccertv.com, supersport.com, guardian.ng/sport, completesports.com',
  },
  MA: {
    tz: 'Africa/Casablanca',
    tzLabel: 'UTC+0/+1 (Casablanca)',
    lang: 'Arabic (Moroccan)',
    channels: 'beIN Sports Arabia 1, beIN Sports Arabia 2, 2M, Arryadia (TNT Maroc), Al Aoula, Canal+ Maroc',
    sites: 'livesoccertv.com, beinsports.com/ar, 2m.ma, arryadia.ma, foot365.ma',
  },
  SN: {
    tz: 'Africa/Dakar',
    tzLabel: 'UTC+0 (Dakar)',
    lang: 'French (Senegalese)',
    channels: 'Canal+ Afrique, Canal+ Sport Afrique, RTS 1, TFM, 2STV, SEN TV, 7TV',
    sites: 'livesoccertv.com, seneplus.com, senego.com, wiwsport.com',
  },
};

// ─── Timezone yardımcıları ────────────────────────────────────────────────────

function getTzOffsetMin(tz: string): number {
  const now = new Date();
  const p = (zone: string) => {
    const pts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const g = (t: string) => parseInt(pts.find(x => x.type === t)?.value ?? '0');
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  };
  return (p(tz) - p('UTC')) / 60000;
}

/** "HH:MM" yerel saat stringini doğru UTC Date'e çevirir */
function localTimeToDate(timeStr: string, tz: string): Date {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  const off = getTzOffsetMin(tz);
  const pts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t: string) => parseInt(pts.find(p => p.type === t)?.value ?? '0');
  const midnight = Date.UTC(g('year'), g('month') - 1, g('day')) - off * 60000;
  return new Date(midnight + (h * 60 + m) * 60000);
}

/** Ülkenin yerel bugün tarihini "YYYY-MM-DD" olarak döndürür */
function getLocalDate(tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ─── Background task ──────────────────────────────────────────────────────────

export const DAILY_FETCH_TASK = 'groq-daily-match-fetch';

TaskManager.defineTask(DAILY_FETCH_TASK, async () => {
  try {
    const cc = (await AsyncStorage.getItem(COUNTRY_STORAGE_KEY)) ?? 'TR';
    if (cc === 'TR') return BackgroundFetch.BackgroundFetchResult.NoData;
    const matches = await fetchDailyMatches(cc);
    return matches.length > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerDailyFetch(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(DAILY_FETCH_TASK)) return;
  await BackgroundFetch.registerTaskAsync(DAILY_FETCH_TASK, {
    minimumInterval: 60 * 60 * 6,   // en az 6 saatte bir
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'compound-beta';

function getGroqKey(): string {
  return (Constants.expoConfig?.extra?.groqApiKey as string) ?? '';
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildDailyPrompt(cc: string, dateStr: string): string {
  const cfg = COUNTRY_CFG[cc] ?? COUNTRY_CFG['GB'];

  return `Today is ${dateStr}. Search these websites for today's complete sports TV broadcast schedule in country code "${cc}":
${cfg.sites}

Find ALL sports matches (football/soccer, basketball, volleyball, Formula 1, motorsport) broadcast on TV today in ${cc}.
Local timezone: ${cfg.tzLabel}.
All times must be in LOCAL time (${cfg.tzLabel}).
Language for team/league names: ${cfg.lang}.

Known TV channels in ${cc}:
${cfg.channels}

Return EVERY match you find today. Do not skip any.
For each match return:
- home: home team name
- away: away team name (use "" if individual sport like F1)
- time: "HH:MM" in LOCAL time (${cfg.tzLabel})
- channel: exact TV channel name from the list above
- league: competition / league name
- sport: exactly one of: football, basketball, volleyball, motorsport

Return ONLY valid JSON, nothing else:
{"matches":[
  {"home":"...","away":"...","time":"HH:MM","channel":"...","league":"...","sport":"football"}
]}`;
}

// ─── Groq çağrısı ─────────────────────────────────────────────────────────────

interface RawMatch {
  home: string; away: string; time: string;
  channel: string; league: string; sport: string;
}

async function callGroq(cc: string, dateStr: string): Promise<RawMatch[]> {
  const key = getGroqKey();
  if (!key) return [];

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: buildDailyPrompt(cc, dateStr) }],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) return [];

    const data   = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const block  = text.match(/\{[\s\S]*\}/);
    if (!block) return [];

    const parsed = JSON.parse(block[0]);
    return Array.isArray(parsed?.matches) ? parsed.matches : [];
  } catch {
    return [];
  }
}

// ─── RawMatch → Match ─────────────────────────────────────────────────────────

const SPORT_MAP: Record<string, SportType> = {
  football: 'football', soccer: 'football', fútbol: 'football', futebol: 'football',
  basketball: 'basketball', basquete: 'basketball', baloncesto: 'basketball',
  volleyball: 'volleyball', vôlei: 'volleyball', voleibol: 'volleyball',
  motorsport: 'motorsport', 'formula 1': 'motorsport', f1: 'motorsport',
  motor: 'motorsport',
};

function toMatch(r: RawMatch, idx: number, cc: string, tz: string, today: string): Match | null {
  if (!r.home || !r.time) return null;

  const sport: SportType = SPORT_MAP[r.sport?.toLowerCase()?.trim()] ?? 'football';
  const date  = localTimeToDate(r.time, tz);
  const norm  = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22);

  return {
    id:            `groq_${cc}_${today}_${idx}_${norm(r.home)}`,
    sport,
    homeTeam:      norm(r.home),
    awayTeam:      norm(r.away ?? ''),
    homeTeamName:  r.home,
    awayTeamName:  r.away ?? '',
    homeTeamColor: '#888',
    awayTeamColor: '#888',
    homeTeamEmoji: '',
    awayTeamEmoji: '',
    date,
    time:          r.time,                // ülkenin yerel saati — UI'de olduğu gibi gösterilir
    league:        r.league,
    leagueId:      r.league.toLowerCase().replace(/\s+/g, '_').slice(0, 20),
    leagueEmoji:   '',
    channel:       r.channel,
    channels:      r.channel ? [r.channel] : [],
    status:        'scheduled' as MatchStatus,
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CK  = (cc: string) => `groq_daily_${cc}`;
const CDK = (cc: string) => `groq_daily_date_${cc}`;

async function readCache(today: string, cc: string): Promise<Match[] | null> {
  try {
    if (await AsyncStorage.getItem(CDK(cc)) !== today) return null;
    const raw = await AsyncStorage.getItem(CK(cc));
    if (!raw) return null;
    return (JSON.parse(raw) as Match[]).map(m => ({ ...m, date: new Date(m.date) }));
  } catch { return null; }
}

async function writeCache(matches: Match[], today: string, cc: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CK(cc), JSON.stringify(matches));
    await AsyncStorage.setItem(CDK(cc), today);
  } catch { /* depolama dolu */ }
}

// ─── Ana export ───────────────────────────────────────────────────────────────

/**
 * Verilen ülke için bugünkü maçları Groq'tan çeker (günde 1 kez).
 * Cache doluysa anında döner, Groq API çağrısı yapılmaz.
 */
export async function fetchDailyMatches(countryCode: string): Promise<Match[]> {
  const cfg   = COUNTRY_CFG[countryCode];
  if (!cfg) return [];  // desteklenmeyen ülke

  const today = getLocalDate(cfg.tz);

  // 1. Cache var mı?
  const cached = await readCache(today, countryCode);
  if (cached && cached.length > 0) return cached;

  // 2. Groq'tan çek
  const raw = await callGroq(countryCode, today);
  if (raw.length === 0) return [];

  // 3. Dönüştür
  const matches: Match[] = raw
    .map((r, i) => toMatch(r, i, countryCode, cfg.tz, today))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 4. Cache'e kaydet
  await writeCache(matches, today, countryCode);
  return matches;
}

/** Cache'i temizle (ülke değişince veya zorla yenilemede) */
export async function clearDailyCache(countryCode?: string): Promise<void> {
  if (countryCode) {
    await AsyncStorage.multiRemove([CK(countryCode), CDK(countryCode)]);
  } else {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(k => k.startsWith('groq_daily_')));
  }
}

// Geriye dönük uyumluluk
export const enrichWithGroqChannels = async (matches: Match[], cc: string) =>
  (await fetchDailyMatches(cc)).length > 0 ? fetchDailyMatches(cc) : matches;

export const fetchMatchesFromGroq = (cc = 'TR') => fetchDailyMatches(cc);
