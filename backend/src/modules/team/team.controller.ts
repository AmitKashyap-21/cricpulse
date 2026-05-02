import { Controller, Get, Param } from '@nestjs/common';
import { TeamService } from './team.service';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /** GET /teams — list all teams */
  @Get()
  async getTeams() {
    const data = await this.teamService.getTeams();
    return { data };
  }

  /** GET /teams/:id/players — players in a team */
  @Get(':id/players')
  async getTeamPlayers(@Param('id') id: string) {
    const data = await this.teamService.getTeamPlayers(id);
    return { data };
  }
}
