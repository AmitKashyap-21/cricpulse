export interface ScoreEntry {
  r?: number;
  w?: number;
  o?: number | string;
  inning?: string;
}

export interface TeamInfo {
  name?: string;
  shortname?: string;
  img?: string;
}

export interface MatchSnapshot {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: ScoreEntry[];
  teamInfo: TeamInfo[];
  tossWinner: string;
  tossChoice: string;
  matchType: string;
  matchStarted: boolean;
  matchEnded: boolean;
  stale: boolean;
  fetchedAt: string;
  error?: string;
}
