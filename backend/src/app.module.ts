import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { RedisModule } from './common/redis/redis.module';
import { AggregatorModule } from './modules/aggregator/aggregator.module';
import { MatchModule } from './modules/match/match.module';
import { TeamModule } from './modules/team/team.module';
import { PlayerModule } from './modules/player/player.module';
import { SeriesModule } from './modules/series/series.module';
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
    TeamModule,
    PlayerModule,
    SeriesModule,
    SchedulerModule,
    WebsocketModule,
  ],
})
export class AppModule {}
