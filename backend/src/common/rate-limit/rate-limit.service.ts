import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const RATE_LIMIT_KEY = 'rate_limit:cricapi';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Token-bucket style rate limiter.
   * Returns true if the request is allowed, false if rate limit exceeded.
   */
  async isAllowed(): Promise<boolean> {
    const max = this.configService.get<number>('rateLimit.max') ?? 30;
    const window = this.configService.get<number>('ttl.rateLimitWindow') ?? 60;

    try {
      const current = await this.redisService.incr(RATE_LIMIT_KEY);
      if (current === 1) {
        // First request in this window — set expiry
        await this.redisService.expire(RATE_LIMIT_KEY, window);
      }
      if (current > max) {
        this.logger.warn(`Rate limit exceeded: ${current}/${max}`);
        return false;
      }
      return true;
    } catch (e) {
      // If Redis is down, allow the request
      this.logger.warn(`Rate limiter error: ${e.message} — allowing request`);
      return true;
    }
  }
}
