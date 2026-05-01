import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../common/redis/redis.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { MatchSnapshot } from '../match/match.types';

/** Safely convert a raw timestamp value to ISO string, returns '' on invalid input. */
function safeTimestampToIso(value: unknown): string {
  if (value == null) return '';
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  return isNaN(d.getTime()) ? '' : d.toISOString();
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

  private get matchesPath(): string {
    return this.configService.get<string>('rapidapi.matchesPath') || '/matches/v1/live';
  }

  private get snapshotTtl(): number {
    return this.configService.get<number>('ttl.matchSnapshot') || 30;
  }

  private get listTtl(): number {
    return this.configService.get<number>('ttl.matchesList') || 60;
  }

  private get rapidApiHeaders() {
    return {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': this.host,
    };
  }

  /** Fetch list of current matches from Cricbuzz RapidAPI */
  async fetchMatchList(): Promise<any[]> {
    const cacheKey = 'sport:cricket:matches';

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Rate-limit check
    const allowed = await this.rateLimitService.isAllowed();
    if (!allowed) {
      this.logger.warn('Rate limit blocked fetchMatchList — returning empty');
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}${this.matchesPath}`, {
          headers: this.rapidApiHeaders,
          timeout: 10000,
        }),
      );

      const data = response.data;
      const matches: any[] = this.extractMatchesFromList(data).slice(0, 20);

      const normalised = matches.map((m) => this.normaliseMatch(m));
      await this.redisService.set(cacheKey, JSON.stringify(normalised), this.listTtl);

      return normalised;
    } catch (e) {
      this.logger.error(`fetchMatchList error: ${e.message}`);
      return [];
    }
  }

  /** Fetch and normalise a single match snapshot from Cricbuzz scorecard */
  async fetchMatchSnapshot(matchId: string): Promise<MatchSnapshot> {
    const cacheKey = `match:${matchId}:snapshot`;

    const allowed = await this.rateLimitService.isAllowed();
    if (!allowed) {
      // Return stale cache if available
      const stale = await this.redisService.get(cacheKey);
      if (stale) {
        try {
          const parsed = JSON.parse(stale) as MatchSnapshot;
          return { ...parsed, stale: true };
        } catch {
          this.logger.warn(`Corrupted cached snapshot for ${matchId} — returning stub`);
        }
      }
      return this.stubSnapshot(matchId, true, 'rate_limit');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/mcenter/v1/${encodeURIComponent(matchId)}/hscard`, {
          headers: this.rapidApiHeaders,
          timeout: 10000,
        }),
      );

      const raw = response.data;
      if (!raw) {
        throw new Error('Empty match data from Cricbuzz');
      }

      const snapshot = this.normaliseScorecard(matchId, raw) as MatchSnapshot;
      snapshot.stale = false;
      snapshot.fetchedAt = new Date().toISOString();

      await this.redisService.set(cacheKey, JSON.stringify(snapshot), this.snapshotTtl);
      return snapshot;
    } catch (e) {
      this.logger.error(`fetchMatchSnapshot(${matchId}) error: ${e.message}`);

      // Return stale cache
      const stale = await this.redisService.get(cacheKey);
      if (stale) {
        try {
          const parsed = JSON.parse(stale) as MatchSnapshot;
          return { ...parsed, stale: true };
        } catch {
          this.logger.warn(`Corrupted cached snapshot for ${matchId} — returning stub`);
        }
      }

      return this.stubSnapshot(matchId, true, e.message);
    }
  }

  /**
   * Extract flat match array from Cricbuzz /matches/v1/live response.
   * Cricbuzz nests matches under typeMatches → seriesMatches → seriesAdWrapper → matches.
   */
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

    // Fallback: if response is a flat array or different structure
    if (result.length === 0 && Array.isArray(data?.matches)) {
      return data.matches;
    }

    return result;
  }

  /** Normalise a Cricbuzz live-matches list entry into MatchSnapshot */
  private normaliseMatch(raw: any): MatchSnapshot {
    const info = raw?.matchInfo ?? raw;
    const scores = raw?.matchScore ?? {};

    const matchId = String(info?.matchId ?? info?.id ?? '');
    const team1Name = info?.team1?.teamName ?? info?.team1?.name ?? '';
    const team2Name = info?.team2?.teamName ?? info?.team2?.name ?? '';
    const team1Short = info?.team1?.teamSName ?? '';
    const team2Short = info?.team2?.teamSName ?? '';

    const score: Array<{ r?: number; w?: number; o?: number | string; inning?: string }> = [];

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
    const matchEnded = state === 'complete' || state === 'finished' || state.includes('result');

    return {
      id: matchId,
      name: info?.matchDesc ?? `${team1Name} vs ${team2Name}`,
      status: info?.status ?? info?.state ?? 'unknown',
      venue: info?.venueInfo?.ground ?? info?.venue ?? '',
      date: safeTimestampToIso(info?.startDate) || (info?.date ?? ''),
      teams: [team1Name, team2Name].filter(Boolean),
      score,
      teamInfo: [
        { name: team1Name, shortname: team1Short },
        { name: team2Name, shortname: team2Short },
      ],
      tossWinner: '',
      tossChoice: '',
      matchType: info?.matchFormat ?? info?.matchType ?? '',
      matchStarted,
      matchEnded,
      stale: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Normalise a Cricbuzz /mcenter/v1/{id}/hscard scorecard response into MatchSnapshot */
  private normaliseScorecard(matchId: string, raw: any): MatchSnapshot {
    const header = raw?.matchHeader ?? raw?.matchInfo ?? raw?.data?.matchHeader ?? {};

    const team1Name = header?.team1?.teamName ?? header?.team1?.name ?? '';
    const team2Name = header?.team2?.teamName ?? header?.team2?.name ?? '';
    const team1Short = header?.team1?.teamSName ?? header?.team1?.shortName ?? '';
    const team2Short = header?.team2?.teamSName ?? header?.team2?.shortName ?? '';

    // Extract innings scores from scorecard
    const scorecardList: any[] =
      raw?.scoreCard ?? raw?.scorecard ?? raw?.data?.scoreCard ?? [];

    const score: Array<{ r?: number; w?: number; o?: number | string; inning?: string }> = [];

    for (const inning of scorecardList) {
      const batTeamName =
        inning?.batTeamDetails?.batTeamName ??
        inning?.batTeam?.teamName ??
        '';
      const inngsId = inning?.inningsId ?? inning?.inngsId;
      const runs = inning?.scoreDetails?.runs ?? inning?.runs;
      const wickets = inning?.scoreDetails?.wickets ?? inning?.wickets;
      const overs = inning?.scoreDetails?.overs ?? inning?.overs;

      score.push({
        r: typeof runs === 'number' ? runs : undefined,
        w: typeof wickets === 'number' ? wickets : undefined,
        o: overs,
        inning: `${batTeamName} Inning ${inngsId ?? ''}`.trim(),
      });
    }

    const statusText: string = header?.status ?? header?.matchStatus ?? raw?.status ?? 'unknown';
    const state = statusText.toLowerCase();
    const matchStarted = !(state.includes('upcoming') || state.includes('scheduled') || state.includes('preview'));
    const matchEnded = state.includes('complete') || state.includes('finished') || state.includes('result') || state.includes('won') || state.includes('drawn');

    return {
      id: matchId,
      name: header?.matchDescription ?? header?.seriesName ?? `${team1Name} vs ${team2Name}`,
      status: statusText,
      venue: header?.venue?.name ?? header?.venueName ?? '',
      date: safeTimestampToIso(header?.matchStartTimestamp) || (header?.date ?? ''),
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
      stale: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  private stubSnapshot(matchId: string, stale: boolean, reason: string): MatchSnapshot {
    return {
      id: matchId,
      name: '',
      status: 'unavailable',
      venue: '',
      date: '',
      teams: [],
      score: [],
      teamInfo: [],
      tossWinner: '',
      tossChoice: '',
      matchType: '',
      matchStarted: false,
      matchEnded: false,
      stale,
      fetchedAt: new Date().toISOString(),
      error: reason,
    };
  }
}
