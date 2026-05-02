import { Controller, Get, Param } from '@nestjs/common';
import { PlayerService } from './player.service';

@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  /** GET /players/:id — player info */
  @Get(':id')
  async getPlayerInfo(@Param('id') id: string) {
    const data = await this.playerService.getPlayerInfo(id);
    return { data };
  }

  /** GET /players/:id/career — player career stats */
  @Get(':id/career')
  async getPlayerCareer(@Param('id') id: string) {
    const data = await this.playerService.getPlayerCareer(id);
    return { data };
  }

  /** GET /players/:id/batting — player batting stats */
  @Get(':id/batting')
  async getPlayerBatting(@Param('id') id: string) {
    const data = await this.playerService.getPlayerBatting(id);
    return { data };
  }

  /** GET /players/:id/bowling — player bowling stats */
  @Get(':id/bowling')
  async getPlayerBowling(@Param('id') id: string) {
    const data = await this.playerService.getPlayerBowling(id);
    return { data };
  }
}
