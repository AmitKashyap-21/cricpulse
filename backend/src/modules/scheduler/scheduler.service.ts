import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AggregatorService } from '../aggregator/aggregator.service';
import { RedisService } from '../../common/redis/redis.service';
import { MatchGateway } from '../../websocket/websocket.gateway';
import { MatchSnapshot } from '../match/match.types';

const POLL_INTERVAL_MS = 8000;
const MAX_MATCHES = 20;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly aggregatorService: AggregatorService,
    private readonly redisService: RedisService,
    private readonly matchGateway: MatchGateway,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async pollLiveMatches() {
    this.logger.debug('Polling live matches…');

    try {
      const matches = await this.aggregatorService.fetchMatchList();
      const liveMatches = matches
        .filter((m) => m.matchStarted && !m.matchEnded)
        .slice(0, MAX_MATCHES);

      for (const match of liveMatches) {
        if (!match.id) continue;

        const cacheKey = `match:${match.id}:snapshot`;
        const previousRaw = await this.redisService.get(cacheKey);
        const previous: MatchSnapshot | null = previousRaw ? JSON.parse(previousRaw) : null;

        const snapshot = await this.aggregatorService.fetchMatchSnapshot(match.id);

        // Detect change by comparing score array
        const hasChanged =
          !previous ||
          JSON.stringify(previous.score) !== JSON.stringify(snapshot.score) ||
          previous.status !== snapshot.status;

        if (hasChanged) {
          this.logger.log(`Match ${match.id} updated — broadcasting`);
          this.matchGateway.broadcastMatchUpdate(snapshot);
        }
      }
    } catch (e) {
      this.logger.error(`Scheduler poll error: ${e.message}`);
    }
  }
}
