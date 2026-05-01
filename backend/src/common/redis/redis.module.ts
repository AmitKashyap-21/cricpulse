import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 200;
const MAX_RETRY_DELAY_MS = 2000;

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const Redis = (await import('ioredis')).default;
        const client = new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > MAX_RETRY_ATTEMPTS) return null;
            return Math.min(times * RETRY_BASE_DELAY_MS, MAX_RETRY_DELAY_MS);
          },
        });
        try {
          await client.connect();
        } catch (e) {
          logger.warn(
            `Redis unavailable (${e.message}) — running in degraded mode. ` +
            `Caching, rate limiting, and real-time features will not function correctly.`,
          );
        }
        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
