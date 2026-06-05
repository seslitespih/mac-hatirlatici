import { MATCHES, Match, getMatchesByDate, getMatchesByTeam, SportType } from '../constants/matches';
import { fetchAllSports } from './apiService';
import { getChannelForCountry } from '../constants/countryChannels';
import { format, isToday, isTomorrow, addDays, startOfDay } from 'date-fns';
import { type Locale } from 'date-fns';
import { tr, enUS, es, pt, fr, de, ar, it } from 'date-fns/locale';

let _cachedMatches: Match[] | null = null;
let _cacheTime = 0;
let _cachedCountry = '';
const CACHE_TTL_MS = 5 * 60 * 1000;

function isApiMatch(m: Match): boolean {
  return m.id.startsWith('tsdb_') || m.id.startsWith('af_') || m.id.startsWith('fd_')
    || m.id.startsWith('f1_') || m.id.startsWith('efeler_') || m.id.startsWith('sultan_');
}

export function applyCountryChannels(matches: Match[], countryCode: string): Match[] {
  return matches.map((m) => ({
    ...m,
    channel: isApiMatch(m)
      ? (m.channel || getChannelForCountry(countryCode, m.leagueId, m.homeTeam))
      : getChannelForCountry(countryCode, m.leagueId, m.homeTeam),
  }));
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

const LOCALE_MAP: Record<string, Locale> = {
  tr, en: enUS, es, pt, fr, de, ar, it,
};

function getDayTitle(date: Date, language: string, t: (key: string) => string): string {
  if (isToday(date)) return t('matches.today');
  if (isTomorrow(date)) return t('matches.tomorrow');
  const locale = LOCALE_MAP[language] || enUS;
  return format(date, 'EEEE, d MMMM', { locale });
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
    const key = format(date, 'yyyy-MM-dd');
    if (!groups.has(key)) {
      groups.set(key, {
        title: getDayTitle(startOfDay(date), language, t),
        dateKey: key,
        date: startOfDay(date),
        matches: [],
      });
    }
    groups.get(key)!.matches.push(match);
  }

  return Array.from(groups.values());
}

export function getWeeklyMatches(): Match[] {
  const now = new Date();
  const weekEnd = addDays(now, 7);
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
