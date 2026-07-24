/**
 * dailyMatchService.ts
 *
 * Uzaktan güncellenen günlük maç kaynağı.
 *
 * assets/matches-daily.json her gece Türkiye saatiyle 01:00'de
 * scripts/generate-fixtures.mjs tarafından üretilir (web aramasıyla doğrulanmış,
 * şema denetiminden geçmiş). Dosya GitHub raw üzerinden okunur — yani yeni lig,
 * yeni spor dalı veya kanal düzeltmesi **uygulama güncellemesi gerektirmez**.
 *
 * TheSportsDB kaynağı (sportsDbService) yerinde kalır; bu servis onun üzerine
 * eklenir ve çakışan kayıtlar birleştirilir. Böylece uzak kaynak bir gün
 * üretilemezse uygulama boş kalmaz.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, SportType } from '../constants/matches';
import { formatLocalTime, getMatchWindow } from '../utils/timezone';
import { COUNTRY_TZ, norm } from './sportsDbService';

const REMOTE_URL =
  'https://raw.githubusercontent.com/seslitespih/mac-hatirlatici/main/assets/matches-daily.json';

const CACHE_KEY  = 'daily_matches_v1';
const CACHE_TIME = 'daily_matches_time_v1';
const TTL_MS     = 2 * 60 * 60 * 1000; // 2 saat — kanal verisiyle aynı tazelik

// ─── Uzak dosya tipleri ───────────────────────────────────────────────────────

type LangMap = Partial<Record<string, string>>;

export interface RemoteMatch {
  id: string;
  sport: SportType;
  competitionId: string;
  tier: 'global' | 'regional';
  competition: LangMap;
  home: string;
  away: string;
  homeNames?: LangMap;
  awayNames?: LangMap;
  kickoffUtc: string;
  broadcasts: Record<string, string[]>;
  sources?: string[];
}

export interface RemoteFixtures {
  generated_at: string;
  date: string;
  matches: RemoteMatch[];
}

// ─── Getirme + önbellek ───────────────────────────────────────────────────────

let _mem: RemoteFixtures | null = null;
let _memTime = 0;

export async function getRemoteFixtures(): Promise<RemoteFixtures | null> {
  if (_mem && Date.now() - _memTime < TTL_MS) return _mem;

  try {
    const [timeRaw, dataRaw] = await Promise.all([
      AsyncStorage.getItem(CACHE_TIME),
      AsyncStorage.getItem(CACHE_KEY),
    ]);
    if (timeRaw && dataRaw && Date.now() - parseInt(timeRaw, 10) < TTL_MS) {
      _mem     = JSON.parse(dataRaw) as RemoteFixtures;
      _memTime = parseInt(timeRaw, 10);
      return _mem;
    }
  } catch { /* bozuk önbellek → ağdan çek */ }

  try {
    const res = await fetch(REMOTE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout?.(8000),
    } as RequestInit);
    if (res.ok) {
      const data = (await res.json()) as RemoteFixtures;
      if (!Array.isArray(data?.matches)) return null;
      const now = Date.now();
      await AsyncStorage.multiSet([
        [CACHE_KEY,  JSON.stringify(data)],
        [CACHE_TIME, now.toString()],
      ]).catch(() => {});
      _mem     = data;
      _memTime = now;
      return data;
    }
  } catch { /* ağ hatası → null, çağıran TheSportsDB'ye düşer */ }

  return null;
}

export function prefetchDailyMatches(): void {
  getRemoteFixtures().catch(() => {});
}

export async function clearDailyMatchCache(): Promise<void> {
  _mem = null;
  _memTime = 0;
  try {
    await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIME]);
  } catch { /* */ }
}

// ─── Dönüşüm ──────────────────────────────────────────────────────────────────

/** Kullanıcının dilindeki karşılığı; yoksa İngilizce, o da yoksa taban ad. */
function pick(names: LangMap | undefined, lang: string, fallback: string): string {
  if (!names) return fallback;
  const base = lang.split('-')[0];
  return names[base] || names.en || fallback;
}

/**
 * Uzak kayıtları, seçili ülke ve dil için Match[] hâline getirir.
 *
 * Gösterim kuralı: maç bu ülkede yayınlanıyorsa her hâlükârda gösterilir.
 * Yayıncısı bilinmiyorsa yalnızca dünya çapında ilgi gören turnuvalar
 * (tier === 'global') listelenir — aksi hâlde liste yabancı bölgesel
 * maçlarla dolar.
 */
export async function fetchDailyMatches(
  countryCode: string,
  language: string = 'tr',
): Promise<Match[]> {
  const data = await getRemoteFixtures();
  if (!data) return [];

  const tz = COUNTRY_TZ[countryCode] ?? 'UTC';
  const { start, end } = getMatchWindow(tz);
  const out: Match[] = [];

  for (const r of data.matches) {
    const channels = r.broadcasts?.[countryCode] ?? [];
    if (channels.length === 0 && r.tier !== 'global') continue;

    const date = new Date(r.kickoffUtc);
    if (Number.isNaN(date.getTime())) continue;
    if (date < start || date > end) continue;

    const homeName = pick(r.homeNames, language, r.home);
    const awayName = pick(r.awayNames, language, r.away);

    out.push({
      id:            `daily_${countryCode}_${r.id}`,
      sport:         r.sport,
      homeTeam:      norm(r.home),   // favori eşleşmesi taban ad üzerinden
      awayTeam:      norm(r.away),
      homeTeamName:  homeName,
      awayTeamName:  awayName,
      homeTeamColor: '#888',
      awayTeamColor: '#888',
      homeTeamEmoji: '',
      awayTeamEmoji: '',
      date,
      time:          formatLocalTime(date, tz),
      league:        pick(r.competition, language, r.competitionId),
      leagueId:      r.competitionId,
      leagueEmoji:   '',
      channel:       channels[0] ?? '',
      channels,
      status:        'scheduled',
    });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ─── Birleştirme ──────────────────────────────────────────────────────────────

const pairKey = (m: Match) =>
  [m.homeTeam, m.awayTeam].sort().join('|');

/**
 * Uzak kaynağı TheSportsDB sonuçlarıyla birleştirir.
 *
 * Aynı maç iki kaynakta da varsa uzak kayıt kazanır (kanal bilgisi ve yerelleşmiş
 * turnuva adı orada daha zengin), ancak TheSportsDB'nin canlı skor durumu
 * (`live` / `finished`) korunur — uzak dosya gece üretildiği için hep
 * `scheduled` der.
 */
export function mergeMatchSources(daily: Match[], sportsDb: Match[]): Match[] {
  const dailyByPair = new Map<string, Match>();
  for (const m of daily) dailyByPair.set(pairKey(m), m);

  const merged: Match[] = [...daily];
  const consumed = new Set<string>();

  for (const s of sportsDb) {
    const key = pairKey(s);
    const d = dailyByPair.get(key);

    // Aynı takım çifti + 90 dakika içinde başlıyorsa aynı maç sayılır
    const sameMatch =
      d && Math.abs(d.date.getTime() - s.date.getTime()) < 90 * 60 * 1000;

    if (sameMatch && !consumed.has(key)) {
      consumed.add(key);
      // Canlı durumu ve varsa TheSportsDB kanalını devral
      if (s.status !== 'scheduled') d!.status = s.status;
      if (!d!.channel && s.channel) {
        d!.channel  = s.channel;
        d!.channels = s.channels;
      }
      continue;
    }

    merged.push(s);
  }

  return merged.sort((a, b) => a.date.getTime() - b.date.getTime());
}
