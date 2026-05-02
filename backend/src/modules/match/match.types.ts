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

export interface InningsScore {
  runs: number | null;
  wickets: number | null;
  overs: number | string | null;
  team?: string;
  inning?: string;
}

export interface Scorecard {
  innings: InningsScore[];
}

export interface CommentaryEntry {
  timestamp?: number;
  overNumber?: string | number;
  commentary?: string;
  event?: string;
}

export interface OverEntry {
  overNumber?: number | string;
  runs?: number;
  wickets?: number;
  balls?: string[];
}

/** Flat match summary item returned by GET /matches */
export interface MatchListItem {
  id: string;
  name: string;
  teamA: string;
  teamB: string;
  status: string;
  venue: string;
  startTime: number;
  // Legacy fields kept for frontend backward-compat
  date: string;
  teams: string[];
  score: ScoreEntry[];
  teamInfo: TeamInfo[];
  matchStarted: boolean;
  matchEnded: boolean;
  matchType: string;
  stale: boolean;
  fetchedAt: string;
  error?: string;
}

/** Full match details returned by GET /match/:id */
export interface MatchDetail extends MatchListItem {
  tossWinner: string;
  tossChoice: string;
  scorecard: Scorecard;
  commentary: CommentaryEntry[];
  overs: OverEntry[];
  lastUpdated: string;
}

/** @deprecated use MatchListItem or MatchDetail */
export type MatchSnapshot = MatchDetail;
