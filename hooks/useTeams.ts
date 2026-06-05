import { useState, useEffect, useMemo } from 'react';
import { TEAMS, LEAGUES, Team } from '../constants/teams';
import { getSelectedTeams, saveSelectedTeams } from '../services/storageService';

export function useTeams() {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const saved = await getSelectedTeams();
      setSelectedTeamIds(saved);
      setIsLoading(false);
    }
    load();
  }, []);

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
    return LEAGUES.map((league) => ({
      league,
      teams: filteredTeams.filter((t) => t.leagueId === league.id),
    })).filter((g) => g.teams.length > 0);
  }, [filteredTeams]);

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
  };
}
