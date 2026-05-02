import { Controller, Get, Param, Logger } from '@nestjs/common';
import { MatchService } from './match.service';

@Controller()
export class MatchController {
  private readonly logger = new Logger(MatchController.name);

  constructor(private readonly matchService: MatchService) {}

  /** GET /matches — normalized live+recent+upcoming match list */
  @Get('matches')
  async getMatches() {
    const data = await this.matchService.getMatches();
    return { data };
  }

  /** GET /match/:id — full match details */
  @Get('match/:id')
  async getMatchDetails(@Param('id') id: string) {
    const data = await this.matchService.getMatchDetails(id);
    return { data };
  }

  /** GET /match/:id/scorecard */
  @Get('match/:id/scorecard')
  async getScorecard(@Param('id') id: string) {
    const data = await this.matchService.getScorecard(id);
    return { data };
  }

  /** GET /match/:id/commentary */
  @Get('match/:id/commentary')
  async getCommentary(@Param('id') id: string) {
    const data = await this.matchService.getCommentary(id);
    return { data };
  }

  /** GET /match/:id/overs */
  @Get('match/:id/overs')
  async getOvers(@Param('id') id: string) {
    const data = await this.matchService.getOvers(id);
    return { data };
  }
}
