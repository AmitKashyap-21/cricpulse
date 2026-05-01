import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../common/redis/redis.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { MatchSnapshot } from '../match/match.types';

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
    return this.configService.get<string>('cricapi.apiKey') || '';
  }

  private get baseUrl(): string {
    return this.configService.get<string>('cricapi.baseUrl') || 'https://api.cricapi.com/v1';
  }

  private get snapshotTtl(): number {
    return this.configService.get<number>('ttl.matchSnapshot') || 30;
  }

  private get listTtl(): number {
    return this.configService.get<number>('ttl.matchesList') || 60;
  }

  /** Fetch list of current matches from CricAPI */
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
        this.httpService.get(`${this.baseUrl}/currentMatches`, {
          params: { apikey: this.apiKey, offset: 0 },
          timeout: 10000,
        }),
      );

      const data = response.data;
      const matches: any[] = (data?.data || []).slice(0, 20);

      // Normalise each match and cache the list
      const normalised = matches.map((m) => this.normaliseMatch(m));
      await this.redisService.set(cacheKey, JSON.stringify(normalised), this.listTtl);

      return normalised;
    } catch (e) {
      this.logger.error(`fetchMatchList error: ${e.message}`);
      return [];
    }
  }

  /** Fetch and normalise a single match snapshot */
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
        this.httpService.get(`${this.baseUrl}/match_info`, {
          params: { apikey: this.apiKey, id: matchId },
          timeout: 10000,
        }),
      );

      const raw = response.data?.data;
      if (!raw) {
        throw new Error('Empty match data from CricAPI');
      }

      const snapshot = this.normaliseMatch(raw) as MatchSnapshot;
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

  private normaliseMatch(raw: any): MatchSnapshot {
    return {
      id: raw?.id || raw?.matchId || '',
      name: raw?.name || raw?.title || '',
      status: raw?.status || 'unknown',
      venue: raw?.venue || '',
      date: raw?.date || raw?.dateTimeGMT || '',
      teams: raw?.teams || [raw?.t1, raw?.t2].filter(Boolean),
      score: raw?.score || [],
      teamInfo: raw?.teamInfo || [],
      tossWinner: raw?.tossWinner || '',
      tossChoice: raw?.tossChoice || '',
      matchType: raw?.matchType || '',
      matchStarted: raw?.matchStarted ?? false,
      matchEnded: raw?.matchEnded ?? false,
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
