import { Controller, Get, Param, Logger } from '@nestjs/common';
import { MatchService } from './match.service';

@Controller()
export class MatchController {
  private readonly logger = new Logger(MatchController.name);

  constructor(private readonly matchService: MatchService) {}

  @Get('matches')
  async getMatches() {
    const data = await this.matchService.getMatches();
    return { data };
  }

  @Get('match/:id')
  async getMatch(@Param('id') id: string) {
    const data = await this.matchService.getMatch(id);
    return { data };
  }
}
