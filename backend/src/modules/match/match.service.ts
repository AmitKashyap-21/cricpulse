import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { AggregatorService } from '../aggregator/aggregator.service';
import { MatchSnapshot } from './match.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly aggregatorService: AggregatorService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async getMatches(): Promise<MatchSnapshot[]> {
    const cacheKey = 'sport:cricket:matches';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    return this.aggregatorService.fetchMatchList();
  }

  async getMatch(matchId: string): Promise<MatchSnapshot> {
    const cacheKey = `match:${matchId}:snapshot`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    return this.aggregatorService.fetchMatchSnapshot(matchId);
  }
}
