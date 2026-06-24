/**
 * groqService.ts
 *
 * Her ülke için günde 1 kez Groq'tan maç verisi çeker.
 * llama-3.3-70b-versatile (hızlı, eğitim bilgisiyle WC + büyük ligler)
 * compound-beta (web araması, yedek olarak)
 *
 * TR → kullanılmaz (hangikanalda.app kullanılır)
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
  tzLabel:  string;   // Prompt için (ör. "UTC-3 / Brasília")
  lang:     string;   // Dil
  channels: string;   // Temel TV kanalları (kısa liste)
}

const COUNTRY_CFG: Record<string, CountryCfg> = {
  TR: {
    tz: 'Europe/Istanbul',
    tzLabel: 'UTC+3 (İstanbul)',
    lang: 'Turkish',
    channels: 'beIN Sports, TRT Spor, S Sport, TV8, A Spor',
  },
  GB: {
    tz: 'Europe/London',
    tzLabel: 'UTC+1 (London)',
    lang: 'English',
    channels: 'BBC One, ITV, TNT Sports, Sky Sports, Amazon Prime Video',
  },
  ES: {
    tz: 'Europe/Madrid',
    tzLabel: 'UTC+2 (Madrid)',
    lang: 'Spanish',
    channels: 'DAZN, Movistar+, La 1, Telecinco',
  },
  PT: {
    tz: 'Europe/Lisbon',
    tzLabel: 'UTC+1 (Lisbon)',
    lang: 'Portuguese',
    channels: 'Sport TV, RTP 1, SIC, TVI',
  },
  FR: {
    tz: 'Europe/Paris',
    tzLabel: 'UTC+2 (Paris)',
    lang: 'French',
    channels: 'TF1, Canal+, beIN Sports, DAZN',
  },
  DE: {
    tz: 'Europe/Berlin',
    tzLabel: 'UTC+2 (Berlin)',
    lang: 'German',
    channels: 'ARD, ZDF, Sky Sport, DAZN, MagentaSport',
  },
  IT: {
    tz: 'Europe/Rome',
    tzLabel: 'UTC+2 (Rome)',
    lang: 'Italian',
    channels: 'DAZN, Sky Sport, Canale 5, RAI 1',
  },
  SA: {
    tz: 'Asia/Riyadh',
    tzLabel: 'UTC+3 (Riyadh)',
    lang: 'Arabic',
    channels: 'beIN Sports, MBC Sport, SSC Sport',
  },
  BR: {
    tz: 'America/Sao_Paulo',
    tzLabel: 'UTC-3 (Brasília)',
    lang: 'Portuguese (Brazilian)',
    channels: 'TV Globo, SporTV, ESPN, Band, TNT Sports, Cazé TV',
  },
  AR: {
    tz: 'America/Argentina/Buenos_Aires',
    tzLabel: 'UTC-3 (Buenos Aires)',
    lang: 'Spanish (Argentine)',
    channels: 'TyC Sports, ESPN, Fox Sports, TV Pública',
  },
  MX: {
    tz: 'America/Mexico_City',
    tzLabel: 'UTC-6 (México)',
    lang: 'Spanish (Mexican)',
    channels: 'TUDN, Canal 5, Azteca 7, ESPN, Fox Sports',
  },
  EG: {
    tz: 'Africa/Cairo',
    tzLabel: 'UTC+3 (Cairo)',
    lang: 'Arabic',
    channels: 'beIN Sports, ON Sport, CBC Sport',
  },
  NG: {
    tz: 'Africa/Lagos',
    tzLabel: 'UTC+1 (Lagos)',
    lang: 'English',
    channels: 'SuperSport, DSTV, NTA Sports',
  },
  MA: {
    tz: 'Africa/Casablanca',
    tzLabel: 'UTC+1 (Casablanca)',
    lang: 'Arabic',
    channels: 'beIN Sports, 2M, Arryadia, Canal+ Maroc',
  },
  SN: {
    tz: 'Africa/Dakar',
    tzLabel: 'UTC+0 (Dakar)',
    lang: 'French',
    channels: 'Canal+ Afrique, RTS 1, TFM',
  },
  US: {
    tz: 'America/New_York',
    tzLabel: 'UTC-4 (New York)',
    lang: 'English',
    channels: 'Fox Sports, FS1, Telemundo, Peacock, Paramount+, ESPN+',
  },
  CA: {
    tz: 'America/Toronto',
    tzLabel: 'UTC-4 (Toronto)',
    lang: 'English',
    channels: 'CTV, TSN, RDS, DAZN, Sportsnet',
  },
  AU: {
    tz: 'Australia/Sydney',
    tzLabel: 'UTC+10 (Sydney)',
    lang: 'English',
    channels: 'SBS, Optus Sport, Paramount+, Stan Sport, Fox Sports',
  },
  NZ: {
    tz: 'Pacific/Auckland',
    tzLabel: 'UTC+12 (Auckland)',
    lang: 'English',
    channels: 'Sky Sport, TVNZ, Spark Sport',
  },
  ZA: {
    tz: 'Africa/Johannesburg',
    tzLabel: 'UTC+2 (Johannesburg)',
    lang: 'English',
    channels: 'SuperSport, DSTV, SABC Sport',
  },
  GH: {
    tz: 'Africa/Accra',
    tzLabel: 'UTC+0 (Accra)',
    lang: 'English',
    channels: 'SuperSport, GTV Sports+, DSTV',
  },
  AT: {
    tz: 'Europe/Vienna',
    tzLabel: 'UTC+2 (Vienna)',
    lang: 'German',
    channels: 'ORF 1, ServusTV, Sky Austria, DAZN, MagentaSport',
  },
  CH: {
    tz: 'Europe/Zurich',
    tzLabel: 'UTC+2 (Zurich)',
    lang: 'German',
    channels: 'SRF 1, RTS 1, RSI La 1, Blue Sport, DAZN',
  },
  BE: {
    tz: 'Europe/Brussels',
    tzLabel: 'UTC+2 (Brussels)',
    lang: 'French',
    channels: 'RTBF La Une, VRT 1, RTL TVI, Play Sports',
  },
  QA: {
    tz: 'Asia/Qatar',
    tzLabel: 'UTC+3 (Doha)',
    lang: 'Arabic',
    channels: 'beIN Sports, Al Kass TV, Qatar TV',
  },
  AE: {
    tz: 'Asia/Dubai',
    tzLabel: 'UTC+4 (Dubai)',
    lang: 'Arabic',
    channels: 'beIN Sports, AD Sports, Dubai TV',
  },
  DZ: {
    tz: 'Africa/Algiers',
    tzLabel: 'UTC+1 (Algiers)',
    lang: 'Arabic',
    channels: 'ENTV, A3 Sport, beIN Sports Arabia, Canal Algérie',
  },
  TN: {
    tz: 'Africa/Tunis',
    tzLabel: 'UTC+1 (Tunis)',
    lang: 'Arabic',
    channels: 'Watania 1, Hannibal TV, beIN Sports Arabia',
  },
  CO: {
    tz: 'America/Bogota',
    tzLabel: 'UTC-5 (Bogotá)',
    lang: 'Spanish',
    channels: 'Caracol TV, RCN, Win Sports, DirecTV Sports, ESPN',
  },
  CL: {
    tz: 'America/Santiago',
    tzLabel: 'UTC-3 (Santiago)',
    lang: 'Spanish',
    channels: 'Canal 13, TVN, CHV, DirecTV Sports, ESPN',
  },
  UY: {
    tz: 'America/Montevideo',
    tzLabel: 'UTC-3 (Montevideo)',
    lang: 'Spanish',
    channels: 'Canal 10, TyC Sports, DirecTV Sports, ESPN',
  },
  PE: {
    tz: 'America/Lima',
    tzLabel: 'UTC-5 (Lima)',
    lang: 'Spanish',
    channels: 'América TV, ATV, Latina, DirecTV Sports, Movistar Deportes',
  },
};

// ─── Timezone yardımcıları ────────────────────────────────────────────────────

function getTzOffsetMin(tz: string): number {
  // toLocaleString('sv-SE') → "YYYY-MM-DD HH:MM:SS" (formatToParts Hermes'te yok)
  const now = new Date();
  const parse = (zone: string) => {
    const s = now.toLocaleString('sv-SE', { timeZone: zone });
    const [datePart, timePart] = s.split(' ');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [h, mi] = timePart.split(':').map(Number);
    return Date.UTC(y, mo - 1, d, h, mi);
  };
  return (parse(tz) - parse('UTC')) / 60000;
}

function localTimeToDate(timeStr: string, tz: string): Date {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  const off = getTzOffsetMin(tz);
  const localStr = new Date().toLocaleString('sv-SE', { timeZone: tz });
  const [datePart] = localStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, day) - off * 60000;
  return new Date(midnight + (h * 60 + m) * 60000);
}

function getLocalDate(tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ─── Background task ──────────────────────────────────────────────────────────

export const DAILY_FETCH_TASK = 'groq-daily-match-fetch';

// expo-task-manager bazı iOS sürümlerinde module level'da crash atabilir —
// try-catch ile sararak modülün yüklenmesini garanti altına alıyoruz.
try {
  TaskManager.defineTask(DAILY_FETCH_TASK, async () => {
    try {
      const cc = (await AsyncStorage.getItem(COUNTRY_STORAGE_KEY)) ?? 'TR';
      const matches = await fetchDailyMatches(cc);
      return matches.length > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.warn('TaskManager.defineTask failed:', e);
}

export async function registerDailyFetch(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(DAILY_FETCH_TASK)) return;
    await BackgroundFetch.registerTaskAsync(DAILY_FETCH_TASK, {
      minimumInterval: 60 * 60 * 6,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (e) {
    console.warn('registerDailyFetch failed:', e);
  }
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// llama-3.3-70b: hızlı, güvenilir, WC 2026 + büyük lig bilgisi var
const MODEL_FAST   = 'llama-3.3-70b-versatile';
// compound-beta: web araması yapar, sadece yedek olarak (daha yavaş, rate limit riski)
const MODEL_SEARCH = 'compound-beta';

function getGroqKey(): string {
  return (Constants.expoConfig?.extra?.groqApiKey as string) ?? '';
}

// ─── Prompt (KISA — test edildi, çalışıyor) ──────────────────────────────────

function buildPrompt(cc: string, dateStr: string): string {
  const cfg = COUNTRY_CFG[cc] ?? COUNTRY_CFG['GB'];
  return `Today is ${dateStr}. World Cup 2026 is ongoing (June 11–July 19 2026, hosted in USA/Canada/Mexico).

List ALL football/soccer matches scheduled today for viewers in ${cc} (${cfg.lang}).
Include World Cup 2026 matches + any other major football today.
Times in local time (${cfg.tzLabel}). Use these TV channels: ${cfg.channels}.

IMPORTANT: Write ALL team names and country names in ${cfg.lang}. For example in Turkish: "Fransa", "Almanya", "Brezilya", "Arjantin". In Spanish: "Francia", "Alemania", "Brasil". Use the native language name, not English.

Return ONLY valid JSON (no extra text):
{"matches":[{"home":"TeamA","away":"TeamB","time":"HH:MM","channel":"Channel","league":"League Name","sport":"football"}]}`;
}

// ─── Groq çağrısı ─────────────────────────────────────────────────────────────

interface RawMatch {
  home: string; away: string; time: string;
  channel: string; league: string; sport: string;
}

function parseGroqResponse(text: string): RawMatch[] {
  // Markdown kod bloğunu temizle (```json ... ```)
  const clean = text.replace(/```(?:json)?/g, '').trim();
  const jsonStart = clean.indexOf('{');
  const jsonEnd   = clean.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return [];
  const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
  return Array.isArray(parsed?.matches) ? parsed.matches : [];
}

async function callModel(cc: string, dateStr: string, model: string): Promise<RawMatch[]> {
  const key = getGroqKey();
  if (!key) return [];

  const fetchPromise = fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(cc, dateStr) }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  // Promise.race ile 28sn timeout (AbortController RN'de güvenilmez)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout-${model}`)), 28000),
  );

  const res = await Promise.race([fetchPromise, timeoutPromise]);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    await AsyncStorage.setItem('groq_last_error', JSON.stringify({
      status: res.status, err: errText.slice(0, 300), cc, model,
      date: new Date().toISOString(),
    })).catch(() => {});
    return [];
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  return parseGroqResponse(text);
}

async function callGroq(cc: string, dateStr: string): Promise<RawMatch[]> {
  // 1. Önce hızlı model (eğitim bilgisi — WC 2026 + büyük ligler)
  try {
    const result = await callModel(cc, dateStr, MODEL_FAST);
    if (result.length > 0) return result;
  } catch { /* devam et */ }

  // 2. Yedek: web araması yapan model
  try {
    return await callModel(cc, dateStr, MODEL_SEARCH);
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

const WC_LEAGUE_PATTERNS = [
  /world.?cup/i, /fifa.*2026/i, /dünya.?kupa/i, /mundial/i,
  /mondiale/i, /coupe.?du.?monde/i, /copa.?del.?mundo/i,
  /weltmeisterschaft/i, /wk.?2026/i, /wm.?2026/i,
];

function normalizeLeagueId(league: string): string {
  if (WC_LEAGUE_PATTERNS.some((p) => p.test(league))) return 'wc2026';
  return league.toLowerCase().replace(/\s+/g, '_').slice(0, 20);
}

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
    time:          r.time,
    league:        r.league,
    leagueId:      normalizeLeagueId(r.league),
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

export async function fetchDailyMatches(countryCode: string): Promise<Match[]> {
  const cfg = COUNTRY_CFG[countryCode];
  if (!cfg) return [];

  const today = getLocalDate(cfg.tz);

  // 1. Cache var mı?
  const cached = await readCache(today, countryCode);
  if (cached && cached.length > 0) return cached;

  // 2. Groq'tan çek
  const raw = await callGroq(countryCode, today);
  if (raw.length === 0) return [];

  // 3. Dönüştür ve sırala
  const matches: Match[] = raw
    .map((r, i) => toMatch(r, i, countryCode, cfg.tz, today))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 4. Cache'e kaydet
  await writeCache(matches, today, countryCode);
  return matches;
}

export async function clearDailyCache(countryCode?: string): Promise<void> {
  if (countryCode) {
    await AsyncStorage.multiRemove([CK(countryCode), CDK(countryCode)]);
  } else {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter(k => k.startsWith('groq_daily_')));
  }
}

export const enrichWithGroqChannels = async (matches: Match[], cc: string): Promise<Match[]> => {
  const groqMatches = await fetchDailyMatches(cc);
  return groqMatches.length > 0 ? groqMatches : matches;
};

export const fetchMatchesFromGroq = (cc = 'TR') => fetchDailyMatches(cc);
