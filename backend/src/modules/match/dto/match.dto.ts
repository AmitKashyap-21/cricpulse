export class MatchListResponseDto {
  data: MatchSummaryDto[];
}

export class MatchSummaryDto {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: ScoreSummaryDto[];
  matchStarted: boolean;
  matchEnded: boolean;
  stale: boolean;
}

export class ScoreSummaryDto {
  r?: number;
  w?: number;
  o?: number | string;
  inning?: string;
}

export class MatchDetailResponseDto {
  data: MatchDetailDto;
}

export class MatchDetailDto {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: ScoreSummaryDto[];
  teamInfo: TeamInfoDto[];
  tossWinner: string;
  tossChoice: string;
  matchType: string;
  matchStarted: boolean;
  matchEnded: boolean;
  stale: boolean;
  fetchedAt: string;
  error?: string;
}

export class TeamInfoDto {
  name?: string;
  shortname?: string;
  img?: string;
}
