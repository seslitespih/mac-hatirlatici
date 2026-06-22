import { MATCHES, Match, getMatchesByDate, getMatchesByTeam, SportType } from '../constants/matches';
import { fetchAllSports } from './apiService';
import { getChannelForCountry } from '../constants/countryChannels';

let _cachedMatches: Match[] | null = null;
let _cacheTime = 0;
let _cachedCountry = '';
const CACHE_TTL_MS = 5 * 60 * 1000;

function isApiMatch(m: Match): boolean {
  return m.id.startsWith('tsdb_') || m.id.startsWith('af_') || m.id.startsWith('fd_')
    || m.id.startsWith('f1_') || m.id.startsWith('efeler_') || m.id.startsWith('sultan_');
}

export function applyCountryChannels(matches: Match[], countryCode: string): Match[] {
  return matches.map((m) => {
    const mapped = getChannelForCountry(countryCode, m.leagueId, m.homeTeam);
    // API matches (static): prefer existing channel, fall back to map
    // Groq/other matches: prefer map; if map has no entry, keep Groq's own channel
    const channel = isApiMatch(m)
      ? (m.channel || mapped)
      : (mapped || m.channel);
    return { ...m, channel };
  });
}

export async function getMatchesHybrid(countryCode: string = 'TR'): Promise<Match[]> {
  const now = Date.now();
  if (_cachedMatches && now - _cacheTime < CACHE_TTL_MS && _cachedCountry === countryCode) {
    return _cachedMatches;
  }

  let matches: Match[];
  try {
    matches = await fetchAllSports(countryCode);
    if (matches.length === 0) matches = MATCHES;
  } catch {
    matches = MATCHES;
  }

  _cachedMatches = applyCountryChannels(matches, countryCode);
  _cachedCountry = countryCode;
  _cacheTime = Date.now();
  return _cachedMatches;
}

export function invalidateCache() {
  _cachedMatches = null;
}

export interface MatchGroup {
  title: string;
  dateKey: string;
  date: Date;
  matches: Match[];
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getDayTitle(date: Date, language: string, t: (key: string) => string): string {
  const now = new Date();
  if (sameDay(date, now)) return t('matches.today');
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(date, tomorrow)) return t('matches.tomorrow');
  try {
    return date.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return date.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}

export function groupMatchesByDay(
  matches: Match[],
  language: string,
  t: (key: string) => string,
): MatchGroup[] {
  const groups: Map<string, MatchGroup> = new Map();
  const sorted = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const match of sorted) {
    const date = new Date(match.date);
    const key = toDateKey(date);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (!groups.has(key)) {
      groups.set(key, {
        title: getDayTitle(dayStart, language, t),
        dateKey: key,
        date: dayStart,
        matches: [],
      });
    }
    groups.get(key)!.matches.push(match);
  }

  return Array.from(groups.values());
}

export function getWeeklyMatches(): Match[] {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return MATCHES.filter((m) => {
    const d = new Date(m.date);
    return d >= now && d <= weekEnd;
  });
}

export function getMatchesForSelectedTeams(teamIds: string[]): Match[] {
  if (teamIds.length === 0) return [];
  return MATCHES.filter(
    (m) => teamIds.includes(m.homeTeam) || teamIds.includes(m.awayTeam),
  );
}

export function getLiveMatches(): Match[] {
  const now = new Date();
  return MATCHES.filter((m) => {
    const start = new Date(m.date);
    const end = new Date(start.getTime() + 110 * 60 * 1000);
    return now >= start && now <= end;
  });
}

export { getMatchesByDate, getMatchesByTeam };
