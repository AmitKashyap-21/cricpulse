import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../common/redis/redis.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import {
  MatchListItem,
  MatchDetail,
  ScoreEntry,
  InningsScore,
  CommentaryEntry,
  OverEntry,
} from '../match/match.types';

function safeTimestampToIso(value: unknown): string {
  if (value == null) return '';
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function safeTimestampToMs(value: unknown): number {
  if (value == null) return 0;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

@Injectable()
export class AggregatorService {
  private readonly logger = new Logger(AggregatorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  private get apiKey(): string {
    return this.configService.get<string>('rapidapi.key') || '';
  }

  private get host(): string {
    return this.configService.get<string>('rapidapi.host') || 'cricbuzz-cricket.p.rapidapi.com';
  }

  private get baseUrl(): string {
    return this.configService.get<string>('rapidapi.baseUrl') || 'https://cricbuzz-cricket.p.rapidapi.com';
  }

  private get detailsTtl(): number {
    return this.configService.get<number>('ttl.matchDetails') || 10;
  }

  private get listTtl(): number {
    return this.configService.get<number>('ttl.matchesList') || 30;
  }

  private get rapidApiHeaders() {
    return {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': this.host,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INTERNAL HTTP HELPER
  // ──────────────────────────────────────────────────────────────────────────

  private async get<T = any>(path: string): Promise<T> {
    const allowed = await this.rateLimitService.isAllowed();
    if (!allowed) {
      const err: any = new Error('Rate limit exceeded');
      err.code = 429;
      throw err;
    }
    const response = await firstValueFrom(
      this.httpService.get<T>(`${this.baseUrl}${path}`, {
        headers: this.rapidApiHeaders,
        timeout: 10000,
      }),
    );
    return response.data;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MATCH LIST (live + recent + upcoming merged, deduplicated)
  // ──────────────────────────────────────────────────────────────────────────

  async fetchMatchList(): Promise<MatchListItem[]> {
    const cacheKey = 'sport:cricket:matches:list';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as MatchListItem[];
      } catch {
        // ignore parse error, fetch fresh
      }
    }

    const results = await Promise.allSettled([
      this.get('/matches/v1/live'),
      this.get('/matches/v1/recent'),
      this.get('/matches/v1/upcoming'),
    ]);

    const allMatches: MatchListItem[] = [];
    const seenIds = new Set<string>();

    for (const result of results) {
      if (result.status === 'rejected') {
        const code = (result.reason as any)?.code ?? (result.reason as any)?.response?.status;
        if (code === 401) {
          this.logger.error('RapidAPI 401 — invalid key');
        } else if (code === 429) {
          this.logger.warn('RapidAPI 429 — rate limit on match list');
        } else {
          this.logger.warn(`fetchMatchList partial error: ${result.reason?.message}`);
        }
        continue;
      }
      const extracted = this.extractMatchesFromList(result.value);
      for (const m of extracted) {
        const normalized = this.normalizeMatchListItem(m);
        if (normalized.id && !seenIds.has(normalized.id)) {
          seenIds.add(normalized.id);
          allMatches.push(normalized);
        }
      }
    }

    await this.redisService.set(cacheKey, JSON.stringify(allMatches), this.listTtl);
    return allMatches;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MATCH DETAILS — composed from 4 endpoints, cached 10s
  // ──────────────────────────────────────────────────────────────────────────

  async getMatchDetails(matchId: string): Promise<MatchDetail> {
    const cacheKey = `match:${matchId}:details`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as MatchDetail;
      } catch {
        // ignore, fetch fresh
      }
    }

    const [infoResult, scorecardResult, commentaryResult, oversResult] =
      await Promise.allSettled([
        this.get(`/matches/get-info?matchId=${encodeURIComponent(matchId)}`),
        this.get(`/matches/get-scorecard?matchId=${encodeURIComponent(matchId)}`),
        this.get(`/matches/get-commentaries?matchId=${encodeURIComponent(matchId)}`),
        this.get(`/matches/get-overs?matchId=${encodeURIComponent(matchId)}`),
      ]);

    const infoRaw = infoResult.status === 'fulfilled' ? infoResult.value : null;
    const scorecardRaw = scorecardResult.status === 'fulfilled' ? scorecardResult.value : null;
    const commentaryRaw = commentaryResult.status === 'fulfilled' ? commentaryResult.value : null;
    const oversRaw = oversResult.status === 'fulfilled' ? oversResult.value : null;

    this.logApiErrors(matchId, { infoResult, scorecardResult, commentaryResult, oversResult });

    const detail = this.normalizeMatchDetail(matchId, infoRaw, scorecardRaw, commentaryRaw, oversRaw);
    await this.redisService.set(cacheKey, JSON.stringify(detail), this.detailsTtl);
    return detail;
  }

  /** @deprecated Use getMatchDetails. Kept for scheduler backward-compat. */
  async fetchMatchSnapshot(matchId: string): Promise<MatchDetail> {
    return this.getMatchDetails(matchId);
  }

  async getScorecard(matchId: string): Promise<{ innings: InningsScore[] }> {
    const detail = await this.getMatchDetails(matchId);
    return detail.scorecard;
  }

  async getCommentary(matchId: string): Promise<CommentaryEntry[]> {
    const detail = await this.getMatchDetails(matchId);
    return detail.commentary;
  }

  async getOvers(matchId: string): Promise<OverEntry[]> {
    const detail = await this.getMatchDetails(matchId);
    return detail.overs;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STUB ENDPOINTS — scaffolding for future modules
  // ──────────────────────────────────────────────────────────────────────────

  async fetchSchedules(): Promise<any[]> {
    try {
      const data = await this.get('/schedules/list');
      return data?.scheduleList ?? data?.list ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchSchedules error: ${e.message}`);
      return [];
    }
  }

  async fetchSeriesList(): Promise<any[]> {
    try {
      const data = await this.get('/series/list');
      return data?.seriesMapProto ?? data?.series ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchSeriesList error: ${e.message}`);
      return [];
    }
  }

  async fetchSeriesMatches(seriesId: string): Promise<any[]> {
    try {
      const data = await this.get(`/series/get-matches?seriesId=${encodeURIComponent(seriesId)}`);
      return data?.matchScheduleMap ?? data?.matches ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchSeriesMatches error: ${e.message}`);
      return [];
    }
  }

  async fetchSeriesSquads(seriesId: string): Promise<any[]> {
    try {
      const data = await this.get(`/series/get-squads?seriesId=${encodeURIComponent(seriesId)}`);
      return data?.squads ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchSeriesSquads error: ${e.message}`);
      return [];
    }
  }

  async fetchSeriesPointsTable(seriesId: string): Promise<any> {
    try {
      return await this.get(`/series/get-points-table?seriesId=${encodeURIComponent(seriesId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchSeriesPointsTable error: ${e.message}`);
      return null;
    }
  }

  async fetchTeamList(): Promise<any[]> {
    try {
      const data = await this.get('/teams/list');
      return data?.list ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchTeamList error: ${e.message}`);
      return [];
    }
  }

  async fetchTeamPlayers(teamId: string): Promise<any[]> {
    try {
      const data = await this.get(`/teams/get-players?teamId=${encodeURIComponent(teamId)}`);
      return data?.player ?? data?.players ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchTeamPlayers error: ${e.message}`);
      return [];
    }
  }

  async fetchMatchTeam(matchId: string): Promise<any> {
    try {
      return await this.get(`/matches/get-team?matchId=${encodeURIComponent(matchId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchMatchTeam error: ${e.message}`);
      return null;
    }
  }

  async fetchScorecardV2(matchId: string): Promise<any> {
    try {
      return await this.get(`/matches/get-scorecard-v2?matchId=${encodeURIComponent(matchId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchScorecardV2 error: ${e.message}`);
      return null;
    }
  }

  async fetchCommentariesV2(matchId: string): Promise<any> {
    try {
      return await this.get(`/matches/get-commentaries-v2?matchId=${encodeURIComponent(matchId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchCommentariesV2 error: ${e.message}`);
      return null;
    }
  }

  async fetchPlayerInfo(playerId: string): Promise<any> {
    try {
      return await this.get(`/players/get-info?playerId=${encodeURIComponent(playerId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchPlayerInfo error: ${e.message}`);
      return null;
    }
  }

  async fetchPlayerCareer(playerId: string): Promise<any> {
    try {
      return await this.get(`/players/get-career?playerId=${encodeURIComponent(playerId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchPlayerCareer error: ${e.message}`);
      return null;
    }
  }

  async fetchPlayerBatting(playerId: string): Promise<any> {
    try {
      return await this.get(`/players/get-batting?playerId=${encodeURIComponent(playerId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchPlayerBatting error: ${e.message}`);
      return null;
    }
  }

  async fetchPlayerBowling(playerId: string): Promise<any> {
    try {
      return await this.get(`/players/get-bowling?playerId=${encodeURIComponent(playerId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchPlayerBowling error: ${e.message}`);
      return null;
    }
  }

  async fetchVenueInfo(venueId: string): Promise<any> {
    try {
      return await this.get(`/venues/get-info?venueId=${encodeURIComponent(venueId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchVenueInfo error: ${e.message}`);
      return null;
    }
  }

  async fetchNewsList(): Promise<any[]> {
    try {
      const data = await this.get('/news/list');
      return data?.storyList ?? data?.list ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchNewsList error: ${e.message}`);
      return [];
    }
  }

  async fetchNewsDetail(newsId: string): Promise<any> {
    try {
      return await this.get(`/news/detail?id=${encodeURIComponent(newsId)}`);
    } catch (e: any) {
      this.logger.warn(`fetchNewsDetail error: ${e.message}`);
      return null;
    }
  }

  async fetchIccRankings(formatType?: string): Promise<any[]> {
    try {
      const query = formatType ? `?formatType=${encodeURIComponent(formatType)}` : '';
      const data = await this.get(`/stats/get-icc-rankings${query}`);
      return data?.list ?? data?.rank ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchIccRankings error: ${e.message}`);
      return [];
    }
  }

  async fetchStats(recordType?: string): Promise<any[]> {
    try {
      const query = recordType ? `?recordType=${encodeURIComponent(recordType)}` : '';
      const data = await this.get(`/stats/get-records${query}`);
      return data?.list ?? [];
    } catch (e: any) {
      this.logger.warn(`fetchStats error: ${e.message}`);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE NORMALIZERS
  // ──────────────────────────────────────────────────────────────────────────

  /** Flatten typeMatches → seriesMatches → seriesAdWrapper → matches */
  private extractMatchesFromList(data: any): any[] {
    const result: any[] = [];
    const typeMatches: any[] = data?.typeMatches ?? data?.data?.typeMatches ?? [];
    for (const tm of typeMatches) {
      const seriesMatches: any[] = tm?.seriesMatches ?? [];
      for (const sm of seriesMatches) {
        const matches: any[] = sm?.seriesAdWrapper?.matches ?? [];
        for (const m of matches) {
          if (m?.matchInfo) result.push(m);
        }
      }
    }
    if (result.length === 0 && Array.isArray(data?.matches)) {
      return data.matches;
    }
    return result;
  }

  private normalizeMatchListItem(raw: any): MatchDetail {
    const info = raw?.matchInfo ?? raw;
    const scores = raw?.matchScore ?? {};

    const matchId = String(info?.matchId ?? info?.id ?? '');
    const team1Name = info?.team1?.teamName ?? info?.team1?.name ?? '';
    const team2Name = info?.team2?.teamName ?? info?.team2?.name ?? '';
    const team1Short = info?.team1?.teamSName ?? '';
    const team2Short = info?.team2?.teamSName ?? '';

    const score: ScoreEntry[] = [];
    const t1Score = scores?.team1Score;
    const t2Score = scores?.team2Score;

    if (t1Score && typeof t1Score === 'object') {
      for (const inningKey of Object.keys(t1Score)) {
        const inning = t1Score[inningKey];
        score.push({
          r: inning?.r,
          w: inning?.w,
          o: inning?.overs,
          inning: `${team1Short || team1Name} ${inningKey}`,
        });
      }
    }
    if (t2Score && typeof t2Score === 'object') {
      for (const inningKey of Object.keys(t2Score)) {
        const inning = t2Score[inningKey];
        score.push({
          r: inning?.r,
          w: inning?.w,
          o: inning?.overs,
          inning: `${team2Short || team2Name} ${inningKey}`,
        });
      }
    }

    const state: string = (info?.state ?? info?.status ?? '').toLowerCase();
    const matchStarted = state !== '' && state !== 'upcoming' && state !== 'preview';
    const matchEnded =
      state === 'complete' || state === 'finished' || state.includes('result');

    return {
      id: matchId,
      name: info?.matchDesc ?? `${team1Name} vs ${team2Name}`,
      teamA: team1Name,
      teamB: team2Name,
      status: info?.status ?? info?.state ?? 'unknown',
      venue: info?.venueInfo?.ground ?? info?.venue ?? '',
      startTime: safeTimestampToMs(info?.startDate),
      date: safeTimestampToIso(info?.startDate) || (info?.date ?? ''),
      teams: [team1Name, team2Name].filter(Boolean),
      score,
      teamInfo: [
        { name: team1Name, shortname: team1Short },
        { name: team2Name, shortname: team2Short },
      ],
      matchStarted,
      matchEnded,
      matchType: info?.matchFormat ?? info?.matchType ?? '',
      stale: false,
      fetchedAt: new Date().toISOString(),
      // MatchDetail fields with empty defaults
      tossWinner: '',
      tossChoice: '',
      scorecard: { innings: [] },
      commentary: [],
      overs: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  private normalizeMatchDetail(
    matchId: string,
    infoRaw: any,
    scorecardRaw: any,
    commentaryRaw: any,
    oversRaw: any,
  ): MatchDetail {
    const header =
      infoRaw?.matchHeader ??
      infoRaw?.matchInfo ??
      infoRaw?.data?.matchHeader ??
      scorecardRaw?.matchHeader ??
      scorecardRaw?.matchInfo ??
      scorecardRaw?.data?.matchHeader ??
      {};

    const team1Name = header?.team1?.teamName ?? header?.team1?.name ?? '';
    const team2Name = header?.team2?.teamName ?? header?.team2?.name ?? '';
    const team1Short = header?.team1?.teamSName ?? header?.team1?.shortName ?? '';
    const team2Short = header?.team2?.teamSName ?? header?.team2?.shortName ?? '';

    const statusText: string =
      header?.status ?? header?.matchStatus ?? infoRaw?.status ?? scorecardRaw?.status ?? 'unknown';
    const state = statusText.toLowerCase();
    const matchStarted = !(
      state.includes('upcoming') ||
      state.includes('scheduled') ||
      state.includes('preview')
    );
    const matchEnded =
      state.includes('complete') ||
      state.includes('finished') ||
      state.includes('result') ||
      state.includes('won') ||
      state.includes('drawn');

    // ── Scorecard ──────────────────────────────────────────────────────────
    const scorecardList: any[] =
      scorecardRaw?.scoreCard ??
      scorecardRaw?.scorecard ??
      scorecardRaw?.data?.scoreCard ??
      [];

    const score: ScoreEntry[] = [];
    const innings: InningsScore[] = [];

    for (const inning of scorecardList) {
      const batTeamName =
        inning?.batTeamDetails?.batTeamName ?? inning?.batTeam?.teamName ?? '';
      const inngsId = inning?.inningsId ?? inning?.inngsId;
      const runs = inning?.scoreDetails?.runs ?? inning?.runs;
      const wickets = inning?.scoreDetails?.wickets ?? inning?.wickets;
      const overs = inning?.scoreDetails?.overs ?? inning?.overs;
      const label = `${batTeamName} Inning ${inngsId ?? ''}`.trim();

      score.push({
        r: typeof runs === 'number' ? runs : undefined,
        w: typeof wickets === 'number' ? wickets : undefined,
        o: overs,
        inning: label,
      });
      innings.push({
        runs: typeof runs === 'number' ? runs : null,
        wickets: typeof wickets === 'number' ? wickets : null,
        overs: overs ?? null,
        team: batTeamName,
        inning: label,
      });
    }

    return {
      id: matchId,
      name: header?.matchDescription ?? header?.seriesName ?? `${team1Name} vs ${team2Name}`,
      teamA: team1Name,
      teamB: team2Name,
      status: statusText,
      venue: header?.venue?.name ?? header?.venueName ?? '',
      startTime: safeTimestampToMs(header?.matchStartTimestamp),
      date: safeTimestampToIso(header?.matchStartTimestamp) || '',
      teams: [team1Name, team2Name].filter(Boolean),
      score,
      teamInfo: [
        { name: team1Name, shortname: team1Short },
        { name: team2Name, shortname: team2Short },
      ],
      tossWinner: header?.tossResults?.tossWinnerName ?? header?.tossWinner ?? '',
      tossChoice: header?.tossResults?.decision ?? header?.tossChoice ?? '',
      matchType: header?.matchFormat ?? header?.matchType ?? '',
      matchStarted,
      matchEnded,
      scorecard: { innings },
      commentary: this.extractCommentary(commentaryRaw),
      overs: this.extractOvers(oversRaw),
      lastUpdated: new Date().toISOString(),
      stale: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  private extractCommentary(raw: any): CommentaryEntry[] {
    if (!raw) return [];
    const list: any[] =
      raw?.commentaryList ??
      raw?.commentary ??
      raw?.data?.commentaryList ??
      raw?.data?.commentary ??
      [];
    if (!Array.isArray(list)) return [];
    return list.map((c: any): CommentaryEntry => ({
      timestamp: c?.timestamp ?? c?.ts ?? undefined,
      overNumber: c?.overNumber ?? c?.over ?? undefined,
      commentary: c?.commText ?? c?.commentary ?? c?.text ?? '',
      event: c?.event ?? undefined,
    }));
  }

  private extractOvers(raw: any): OverEntry[] {
    if (!raw) return [];
    const list: any[] =
      raw?.overSummaryList ??
      raw?.overs ??
      raw?.data?.overSummaryList ??
      raw?.data?.overs ??
      [];
    if (!Array.isArray(list)) return [];
    return list.map((o: any): OverEntry => ({
      overNumber: o?.overNumber ?? o?.over ?? undefined,
      runs: o?.totalRuns ?? o?.runs ?? undefined,
      wickets: o?.wickets ?? undefined,
      balls: Array.isArray(o?.ballList)
        ? o.ballList.map((b: any) => b?.commText ?? b?.text ?? String(b))
        : undefined,
    }));
  }

  private logApiErrors(
    matchId: string,
    results: Record<string, PromiseSettledResult<any>>,
  ): void {
    for (const [name, result] of Object.entries(results)) {
      if (result.status === 'rejected') {
        const code =
          (result.reason as any)?.code ?? (result.reason as any)?.response?.status;
        if (code === 401) {
          this.logger.error(`${name}(${matchId}) — 401 Invalid RapidAPI key`);
        } else if (code === 429) {
          this.logger.warn(`${name}(${matchId}) — 429 Rate limited`);
        } else {
          this.logger.warn(`${name}(${matchId}) error: ${(result.reason as any)?.message}`);
        }
      }
    }
  }
}
