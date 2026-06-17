import { useState, useEffect, useMemo, useCallback } from 'react';
import { TEAMS, LEAGUES, Team } from '../constants/teams';
import { getSelectedTeams, saveSelectedTeams } from '../services/storageService';
import { useCountry } from '../contexts/CountryContext';

export function useTeams() {
  const { countryCode } = useCountry();
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const reloadSelectedTeams = useCallback(async () => {
    const saved = await getSelectedTeams();
    setSelectedTeamIds(saved);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reloadSelectedTeams();
  }, [reloadSelectedTeams]);

  const toggleTeam = async (teamId: string) => {
    const updated = selectedTeamIds.includes(teamId)
      ? selectedTeamIds.filter((id) => id !== teamId)
      : [...selectedTeamIds, teamId];

    setSelectedTeamIds(updated);
    await saveSelectedTeams(updated);
  };

  const isSelected = (teamId: string) => selectedTeamIds.includes(teamId);

  const filteredTeams = useMemo<Team[]>(() => {
    if (!searchQuery.trim()) return TEAMS;
    const q = searchQuery.toLowerCase();
    return TEAMS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        Object.values(t.nameLocal).some((n) => n.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const teamsByLeague = useMemo(() => {
    const groups = LEAGUES.map((league) => ({
      league,
      teams: filteredTeams.filter((t) => t.leagueId === league.id),
    })).filter((g) => g.teams.length > 0);

    // Sort: user's country leagues first; TR olmayan kullanıcılar için TR ligleri sona
    const TR_LEAGUE_IDS = ['superlig', 'bsl', 'efeler', 'sultansliga'];
    return groups.sort((a, b) => {
      // 1. Kullanıcının ülkesiyle eşleşen ligler en üste
      const aUserMatch = a.league.countryCode === countryCode ? 0 : 1;
      const bUserMatch = b.league.countryCode === countryCode ? 0 : 1;
      if (aUserMatch !== bUserMatch) return aUserMatch - bUserMatch;

      // 2. TR olmayan kullanıcılar için Türkiye'ye özel ligler en alta
      if (countryCode !== 'TR') {
        const aIsTR = TR_LEAGUE_IDS.includes(a.league.id) ? 1 : 0;
        const bIsTR = TR_LEAGUE_IDS.includes(b.league.id) ? 1 : 0;
        if (aIsTR !== bIsTR) return aIsTR - bIsTR;
      }

      return 0;
    });
  }, [filteredTeams, countryCode]);

  const selectedTeams = useMemo<Team[]>(
    () => TEAMS.filter((t) => selectedTeamIds.includes(t.id)),
    [selectedTeamIds],
  );

  return {
    selectedTeamIds,
    selectedTeams,
    searchQuery,
    setSearchQuery,
    isLoading,
    toggleTeam,
    isSelected,
    filteredTeams,
    teamsByLeague,
    reloadSelectedTeams,
  };
}
