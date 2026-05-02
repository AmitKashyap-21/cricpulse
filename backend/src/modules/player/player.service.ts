import { Injectable, Logger } from '@nestjs/common';
import { AggregatorService } from '../aggregator/aggregator.service';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(private readonly aggregatorService: AggregatorService) {}

  async getPlayerInfo(playerId: string): Promise<any> {
    return this.aggregatorService.fetchPlayerInfo(playerId);
  }

  async getPlayerCareer(playerId: string): Promise<any> {
    return this.aggregatorService.fetchPlayerCareer(playerId);
  }

  async getPlayerBatting(playerId: string): Promise<any> {
    return this.aggregatorService.fetchPlayerBatting(playerId);
  }

  async getPlayerBowling(playerId: string): Promise<any> {
    return this.aggregatorService.fetchPlayerBowling(playerId);
  }
}
