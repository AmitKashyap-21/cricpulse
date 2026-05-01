import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AggregatorModule } from '../aggregator/aggregator.module';
import { RedisModule } from '../../common/redis/redis.module';
import { WebsocketModule } from '../../websocket/websocket.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AggregatorModule, RedisModule, WebsocketModule, ConfigModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
