import { useState, useEffect, useCallback, useMemo } from 'react';
import { Match, SportType } from '../constants/matches';
import {
  groupMatchesByDay,
  applyCountryChannels,
  getWeeklyMatches,
  MatchGroup,
} from '../services/matchService';
import { fetchDailyMatches } from '../services/groqService';
import { fetchTRMatches }     from '../services/hangikanalda';
import { scheduleAllNotifications } from '../services/notificationService';
import { useTranslation } from 'react-i18next';

export type MatchFilter = 'all' | 'favorites';

export function useMatches(
  selectedTeamIds: string[],
  countryCode: string = 'TR',
  sport: SportType | 'all' = 'all',
) {
  const { t, i18n } = useTranslation();
  const [filter,      setFilter]      = useState<MatchFilter>('all');
  const [allMatches,  setAllMatches]  = useState<Match[]>(() =>
    applyCountryChannels(getWeeklyMatches(), countryCode),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);

  const loadMatches = useCallback(async (showRefresh = true) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      let matches: Match[];

      if (countryCode === 'TR') {
        // Türkiye → hangikanalda.app (en doğru kaynak)
        matches = await fetchTRMatches();
      } else {
        // Diğer ülkeler → Groq günde 1 kez web araması (ülke saatiyle)
        matches = await fetchDailyMatches(countryCode);
      }

      if (matches.length > 0) {
        setAllMatches(matches);
        setLastUpdated(new Date());
        scheduleAllNotifications(selectedTeamIds, matches, i18n.language).catch(() => {});
      }
    } catch {
      // Son çare: statik fallback
      setAllMatches(applyCountryChannels(getWeeklyMatches(), countryCode));
    } finally {
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, selectedTeamIds, i18n.language]);

  // Uygulama açılışında ve ülke değişiminde yükle
  useEffect(() => {
    loadMatches(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode]);

  // Seçili takımlar değişince bildirimleri yeniden zamanla
  useEffect(() => {
    if (selectedTeamIds.length > 0 && allMatches.length > 0) {
      scheduleAllNotifications(selectedTeamIds, allMatches, i18n.language).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamIds]);

  const refresh = useCallback(() => loadMatches(true), [loadMatches]);

  const sportFiltered = useMemo(
    () => sport === 'all' ? allMatches : allMatches.filter(m => m.sport === sport),
    [allMatches, sport],
  );

  const favoriteMatches = useMemo(
    () => sportFiltered.filter(
      m => selectedTeamIds.includes(m.homeTeam) || selectedTeamIds.includes(m.awayTeam),
    ),
    [sportFiltered, selectedTeamIds],
  );

  const displayedMatches = filter === 'all' ? sportFiltered : favoriteMatches;

  const matchGroups = useMemo<MatchGroup[]>(
    () => groupMatchesByDay(displayedMatches, i18n.language, t),
    [displayedMatches, i18n.language, t],
  );

  const liveMatches = useMemo<Match[]>(() => {
    const now = new Date();
    return sportFiltered.filter(m => {
      const start = new Date(m.date);
      const end   = new Date(start.getTime() + 110 * 60 * 1000);
      return now >= start && now <= end;
    });
  }, [sportFiltered]);

  return {
    filter, setFilter,
    matchGroups, liveMatches,
    allMatches: sportFiltered,
    favoriteMatches,
    hasMatches: displayedMatches.length > 0,
    isRefreshing, lastUpdated, refresh,
  };
}
