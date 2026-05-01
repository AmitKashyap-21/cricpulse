import { Module } from '@nestjs/common';
import { MatchGateway } from './websocket.gateway';

@Module({
  providers: [MatchGateway],
  exports: [MatchGateway],
})
export class WebsocketModule {}
