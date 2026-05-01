import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { AggregatorModule } from '../aggregator/aggregator.module';
import { RedisModule } from '../../common/redis/redis.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AggregatorModule, RedisModule, ConfigModule],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
