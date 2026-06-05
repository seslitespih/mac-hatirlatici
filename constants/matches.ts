export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type SportType = 'football' | 'basketball' | 'volleyball' | 'motorsport';

export interface Match {
  id: string;
  sport: SportType;
  homeTeam: string;
  awayTeam: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamColor: string;
  awayTeamColor: string;
  homeTeamEmoji: string;
  awayTeamEmoji: string;
  date: Date;
  time: string;
  league: string;
  leagueId: string;
  leagueEmoji: string;
  channel: string;        // primary channel
  channels?: string[];    // all channels (from hangikanalda.app)
  channelNumber?: number;
  status: MatchStatus;
}

// No mock matches — app fetches live data from APIs
export const MATCHES: Match[] = [];

export const getMatchesByTeam = (teamId: string): Match[] =>
  MATCHES.filter((m) => m.homeTeam === teamId || m.awayTeam === teamId);

export const getMatchesByDate = (date: Date): Match[] =>
  MATCHES.filter((m) => {
    const md = new Date(m.date);
    return (
      md.getFullYear() === date.getFullYear() &&
      md.getMonth() === date.getMonth() &&
      md.getDate() === date.getDate()
    );
  });

export const getUpcomingMatches = (teamIds: string[]): Match[] => {
  const now = new Date();
  return MATCHES.filter(
    (m) =>
      (teamIds.includes(m.homeTeam) || teamIds.includes(m.awayTeam)) &&
      new Date(m.date) > now,
  );
};
