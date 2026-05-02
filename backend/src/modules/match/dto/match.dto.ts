/** DTO for a single innings score entry (legacy flat format) */
export class ScoreEntryDto {
  r?: number;
  w?: number;
  o?: number | string;
  inning?: string;
}

/** DTO for team info */
export class TeamInfoDto {
  name?: string;
  shortname?: string;
  img?: string;
}

/** DTO for a normalized innings score in the scorecard */
export class InningsScoreDto {
  runs: number | null;
  wickets: number | null;
  overs: number | string | null;
  team?: string;
  inning?: string;
}

/** DTO wrapping the innings list */
export class ScorecardDto {
  innings: InningsScoreDto[];
}

/** DTO for a single commentary entry */
export class CommentaryEntryDto {
  timestamp?: number;
  overNumber?: string | number;
  commentary?: string;
  event?: string;
}

/** DTO for an over summary */
export class OverEntryDto {
  overNumber?: number | string;
  runs?: number;
  wickets?: number;
  balls?: string[];
}

/** Flat match summary item returned by GET /matches */
export class MatchListItemDto {
  id: string;
  name: string;
  teamA: string;
  teamB: string;
  status: string;
  venue: string;
  startTime: number;
  // Legacy backward-compat fields
  date: string;
  teams: string[];
  score: ScoreEntryDto[];
  teamInfo: TeamInfoDto[];
  matchStarted: boolean;
  matchEnded: boolean;
  matchType: string;
  stale: boolean;
  fetchedAt: string;
  error?: string;
}

/** Full match detail returned by GET /match/:id */
export class MatchDetailDto extends MatchListItemDto {
  tossWinner: string;
  tossChoice: string;
  scorecard: ScorecardDto;
  commentary: CommentaryEntryDto[];
  overs: OverEntryDto[];
  lastUpdated: string;
}

export class MatchListResponseDto {
  data: MatchListItemDto[];
}

export class MatchDetailResponseDto {
  data: MatchDetailDto;
}

export class ScorecardResponseDto {
  data: ScorecardDto;
}

export class CommentaryResponseDto {
  data: CommentaryEntryDto[];
}

export class OversResponseDto {
  data: OverEntryDto[];
}
