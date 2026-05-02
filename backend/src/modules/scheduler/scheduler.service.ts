import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AggregatorService } from '../aggregator/aggregator.service';
import { RedisService } from '../../common/redis/redis.service';
import { MatchGateway } from '../../websocket/websocket.gateway';
import { MatchDetail } from '../match/match.types';

const DEFAULT_POLL_INTERVAL_MS = 8000;
const DEFAULT_MAX_MATCHES = 20;

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly aggregatorService: AggregatorService,
    private readonly redisService: RedisService,
    private readonly matchGateway: MatchGateway,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs =
      parseInt(this.configService.get<string>('POLL_INTERVAL_MS') ?? '', 10) ||
      DEFAULT_POLL_INTERVAL_MS;
    this.logger.log(`Starting match poller with interval ${intervalMs}ms`);
    this.pollTimer = setInterval(() => this.pollLiveMatches(), intervalMs);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  async pollLiveMatches() {
    this.logger.debug('Polling live matches…');

    const maxMatches =
      parseInt(this.configService.get<string>('MAX_POLL_MATCHES') ?? '', 10) ||
      DEFAULT_MAX_MATCHES;

    try {
      const matches = await this.aggregatorService.fetchMatchList();
      const liveMatches = matches
        .filter((m) => m.matchStarted && !m.matchEnded)
        .slice(0, maxMatches);

      for (const match of liveMatches) {
        if (!match.id) continue;

        const cacheKey = `match:${match.id}:details`;
        const previousRaw = await this.redisService.get(cacheKey);
        let previous: MatchDetail | null = null;
        if (previousRaw) {
          try {
            previous = JSON.parse(previousRaw);
          } catch (parseErr: unknown) {
            const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
            this.logger.warn(`Corrupted cache for ${cacheKey} (${msg}) — treating as no prior snapshot`);
          }
        }

        const detail = await this.aggregatorService.getMatchDetails(match.id);

        const hasChanged =
          !previous ||
          JSON.stringify(previous.score) !== JSON.stringify(detail.score) ||
          previous.status !== detail.status;

        if (hasChanged) {
          this.logger.log(`Match ${match.id} updated — broadcasting`);
          this.matchGateway.broadcastMatchUpdate(detail);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Scheduler poll error: ${msg}`);
    }
  }
}
