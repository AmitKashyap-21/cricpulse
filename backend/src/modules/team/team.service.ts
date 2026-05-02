import { Injectable, Logger } from '@nestjs/common';
import { AggregatorService } from '../aggregator/aggregator.service';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly aggregatorService: AggregatorService) {}

  async getTeams(): Promise<any[]> {
    return this.aggregatorService.fetchTeamList();
  }

  async getTeamPlayers(teamId: string): Promise<any[]> {
    return this.aggregatorService.fetchTeamPlayers(teamId);
  }

  async getMatchTeam(matchId: string): Promise<any> {
    return this.aggregatorService.fetchMatchTeam(matchId);
  }
}
