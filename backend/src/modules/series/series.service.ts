import { Injectable, Logger } from '@nestjs/common';
import { AggregatorService } from '../aggregator/aggregator.service';

@Injectable()
export class SeriesService {
  private readonly logger = new Logger(SeriesService.name);

  constructor(private readonly aggregatorService: AggregatorService) {}

  async getSeriesList(): Promise<any[]> {
    return this.aggregatorService.fetchSeriesList();
  }

  async getSeriesMatches(seriesId: string): Promise<any[]> {
    return this.aggregatorService.fetchSeriesMatches(seriesId);
  }

  async getSeriesSquads(seriesId: string): Promise<any[]> {
    return this.aggregatorService.fetchSeriesSquads(seriesId);
  }

  async getSeriesPointsTable(seriesId: string): Promise<any> {
    return this.aggregatorService.fetchSeriesPointsTable(seriesId);
  }
}
