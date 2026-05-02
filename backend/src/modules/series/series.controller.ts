import { Controller, Get, Param } from '@nestjs/common';
import { SeriesService } from './series.service';

@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  /** GET /series — list all series */
  @Get()
  async getSeriesList() {
    const data = await this.seriesService.getSeriesList();
    return { data };
  }

  /** GET /series/:id/matches — matches in a series */
  @Get(':id/matches')
  async getSeriesMatches(@Param('id') id: string) {
    const data = await this.seriesService.getSeriesMatches(id);
    return { data };
  }

  /** GET /series/:id/squads — squads for a series */
  @Get(':id/squads')
  async getSeriesSquads(@Param('id') id: string) {
    const data = await this.seriesService.getSeriesSquads(id);
    return { data };
  }

  /** GET /series/:id/points-table — points table for a series */
  @Get(':id/points-table')
  async getSeriesPointsTable(@Param('id') id: string) {
    const data = await this.seriesService.getSeriesPointsTable(id);
    return { data };
  }
}
