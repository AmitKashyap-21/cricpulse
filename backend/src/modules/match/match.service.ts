import { Injectable, Logger } from '@nestjs/common';
import { AggregatorService } from '../aggregator/aggregator.service';
import {
  MatchListItem,
  MatchDetail,
  InningsScore,
  CommentaryEntry,
  OverEntry,
} from './match.types';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(private readonly aggregatorService: AggregatorService) {}

  async getMatches(): Promise<MatchListItem[]> {
    try {
      return await this.aggregatorService.fetchMatchList();
    } catch (e: any) {
      this.logger.error(`getMatches error: ${e.message}`);
      return [];
    }
  }

  async getMatchDetails(matchId: string): Promise<MatchDetail> {
    return this.aggregatorService.getMatchDetails(matchId);
  }

  async getScorecard(matchId: string): Promise<{ innings: InningsScore[] }> {
    return this.aggregatorService.getScorecard(matchId);
  }

  async getCommentary(matchId: string): Promise<CommentaryEntry[]> {
    return this.aggregatorService.getCommentary(matchId);
  }

  async getOvers(matchId: string): Promise<OverEntry[]> {
    return this.aggregatorService.getOvers(matchId);
  }
}
