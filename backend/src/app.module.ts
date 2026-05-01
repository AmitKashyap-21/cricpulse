import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { RedisModule } from './common/redis/redis.module';
import { AggregatorModule } from './modules/aggregator/aggregator.module';
import { MatchModule } from './modules/match/match.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    RedisModule,
    AggregatorModule,
    MatchModule,
    SchedulerModule,
    WebsocketModule,
  ],
})
export class AppModule {}
