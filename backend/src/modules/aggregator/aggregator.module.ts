import { Module } from '@nestjs/common';
import { AggregatorService } from './aggregator.service';
import { RedisModule } from '../../common/redis/redis.module';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [RedisModule, ConfigModule, HttpModule],
  providers: [AggregatorService, RateLimitService],
  exports: [AggregatorService],
})
export class AggregatorModule {}
