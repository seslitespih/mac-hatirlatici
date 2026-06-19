import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Match, SportType } from '../constants/matches';
import {
  groupMatchesByDay,
  MatchGroup,
} from '../services/matchService';
import { fetchSportsDbMatches, clearSportsDbCache } from '../services/sportsDbService';
import { fetchTRMatches, clearTRCache }             from '../services/hangikanalda';
import { fetchMotorsportMatches, clearMotorsportCache } from '../services/motorsportService';
import { getMatchWindow, getDeviceTimezone } from '../utils/timezone';
import { scheduleAllNotifications }            from '../services/notificationService';
import { useTranslation } from 'react-i18next';

export type MatchFilter = 'all' | 'favorites';

export function useMatches(
  selectedTeamIds: string[],
  countryCode: string = 'TR',
  sport: SportType | 'all' = 'all',
  countryReady: boolean = true,   // CountryContext yüklenene kadar TR default'uyla yükleme yapma
) {
  const { t, i18n } = useTranslation();
  const appState    = useRef<AppStateStatus>(AppState.currentState);
  const prevCountry = useRef<string | null>(null);

  const [filter,       setFilter]      = useState<MatchFilter>('all');
  const [allMatches,   setAllMatches]  = useState<Match[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);

  const loadMatches = useCallback(async (showRefresh = true, force = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      let matches: Match[];

      if (countryCode === 'TR') {
        // TR: hangikanalda (Türk ligleri) + TheSportsDB (WC + uluslararası)
        if (force) {
          await Promise.all([clearTRCache(), clearSportsDbCache('TR')]);
        }
        const [trMatches, intlMatches] = await Promise.all([
          fetchTRMatches(),
          fetchSportsDbMatches('TR'),
        ]);
        // Merge: hangikanalda önce (Türk kanalları doğru), sonra sadece TheSportsDB'ye özgün maçlar
        const trKeys = new Set(trMatches.map(m => `${m.homeTeam}|${m.awayTeam}`));
        const extras = intlMatches.filter(m => !trKeys.has(`${m.homeTeam}|${m.awayTeam}`));
        matches = [...trMatches, ...extras];
      } else {
        if (force) {
          await Promise.all([
            clearSportsDbCache(countryCode),
            clearMotorsportCache(countryCode),
          ]);
        }
        const [sportsMatches, motorMatches] = await Promise.all([
          fetchSportsDbMatches(countryCode),
          fetchMotorsportMatches(countryCode),
        ]);
        matches = [...sportsMatches, ...motorMatches];
      }

      if (matches.length > 0) {
        setAllMatches(matches);
        setLastUpdated(new Date());
        scheduleAllNotifications(selectedTeamIds, matches, i18n.language).catch(() => {});
      } else if (force) {
        setAllMatches([]);
      }
    } catch {
      if (force) setAllMatches([]);
    } finally {
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, selectedTeamIds, i18n.language]);

  // CountryContext hazır olduğunda yükle; ülke değişince stale veriyi temizle
  useEffect(() => {
    // Ülke context henüz yüklenmedi — TR default'uyla yanlış veri çekme
    if (!countryReady) return;

    // Ülke değişince eski ülkenin verisini HEMEN temizle (yanlış veri görünmesin)
    if (prevCountry.current !== null && prevCountry.current !== countryCode) {
      setAllMatches([]);
    }
    prevCountry.current = countryCode;

    loadMatches(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, countryReady]);

  // Uygulama ön plana gelince sessizce kontrol et
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && countryReady) {
        loadMatches(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [loadMatches, countryReady]);

  // Seçili takımlar değişince bildirimleri güncelle
  useEffect(() => {
    if (selectedTeamIds.length > 0 && allMatches.length > 0) {
      scheduleAllNotifications(selectedTeamIds, allMatches, i18n.language).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamIds]);

  const refresh = useCallback(() => loadMatches(true, true), [loadMatches]);

  const sportFiltered = useMemo(() => {
    const tz  = getDeviceTimezone();
    const { end } = getMatchWindow(tz);
    const now = new Date();

    const active = allMatches.filter(m => {
      if (m.status === 'finished') return false;
      if (m.status === 'live') return true;
      const d = new Date(m.date);
      if (d > end) return false;                                      // pencere sonu dışı
      const matchEnd = new Date(d.getTime() + 130 * 60 * 1000);
      return matchEnd > now;                                          // geçmiş maçları gizle
    });
    return sport === 'all' ? active : active.filter(m => m.sport === sport);
  }, [allMatches, sport, countryCode]);

  const favoriteMatches = useMemo(
    () => sportFiltered.filter(
      m => selectedTeamIds.includes(m.homeTeam) || selectedTeamIds.includes(m.awayTeam),
    ),
    [sportFiltered, selectedTeamIds],
  );

  const displayedMatches = filter === 'all' ? sportFiltered : favoriteMatches;

  const matchGroups = useMemo<MatchGroup[]>(() => {
    try {
      return typeof groupMatchesByDay === 'function'
        ? groupMatchesByDay(displayedMatches, i18n.language, t)
        : [];
    } catch {
      return [];
    }
  }, [displayedMatches, i18n.language, t]);

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
