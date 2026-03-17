import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { StrategistHistoryDetail } from '../../ai-strategist/domain/ads-strategist.types';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import type { StrategistComparisonAnalysis } from '../domain/ai-comparison.types';

@Injectable()
export class AiComparisonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessibleAnalysisById(
    actor: AuthUser,
    id: string,
  ): Promise<StrategistComparisonAnalysis> {
    const row = await this.prisma.aiStrategistAnalysis.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(actor),
      },
      select: this.analysisSelect(),
    });

    if (!row) {
      throw new NotFoundException('Analisis estrategico no encontrado');
    }

    return this.mapAnalysis(row);
  }

  async findPreviousAnalysis(
    actor: AuthUser,
    params: {
      current: StrategistComparisonAnalysis;
      previousAnalysisId?: string;
      contextHash?: string;
    },
  ): Promise<StrategistComparisonAnalysis | null> {
    if (params.previousAnalysisId) {
      const previous = await this.getAccessibleAnalysisById(
        actor,
        params.previousAnalysisId,
      );

      return previous.id === params.current.id ? null : previous;
    }

    const generatedBefore = new Date(params.current.generated_at);
    const preferredContextHash = params.contextHash ?? params.current.context_hash;

    // Exact match first: same normalized context_hash and prior generation.
    if (preferredContextHash) {
      const exact = await this.prisma.aiStrategistAnalysis.findFirst({
        where: {
          ...this.buildCompatiblePreviousWhere(actor, params.current, generatedBefore),
          contextHash: preferredContextHash,
        },
        orderBy: { generatedAt: 'desc' },
        select: this.analysisSelect(),
      });

      if (exact) {
        return this.mapAnalysis(exact);
      }
    }

    // Fallback behavior when there is no exact hash available:
    // same clientId, same level, most recent previous analysis by generatedAt desc.
    const fallback = await this.prisma.aiStrategistAnalysis.findFirst({
      where: this.buildCompatiblePreviousWhere(actor, params.current, generatedBefore),
      orderBy: { generatedAt: 'desc' },
      select: this.analysisSelect(),
    });

    return fallback ? this.mapAnalysis(fallback) : null;
  }

  private buildAccessWhere(actor: AuthUser): Prisma.AiStrategistAnalysisWhereInput {
    if (actor.role !== 'commercial_manager') {
      return {};
    }

    return {
      client: {
        assignments: {
          some: {
            userId: actor.sub,
          },
        },
      },
    };
  }

  private buildCompatiblePreviousWhere(
    actor: AuthUser,
    current: StrategistComparisonAnalysis,
    generatedBefore: Date,
  ): Prisma.AiStrategistAnalysisWhereInput {
    return {
      ...this.buildAccessWhere(actor),
      clientId: current.client.id,
      level: current.level,
      id: {
        not: current.id,
      },
      generatedAt: {
        lt: generatedBefore,
      },
    };
  }

  private analysisSelect() {
    return {
      id: true,
      level: true,
      dateFrom: true,
      dateTo: true,
      generatedAt: true,
      contextHash: true,
      outputJson: true,
      client: {
        select: {
          id: true,
          nombre: true,
          empresa: true,
        },
      },
    } satisfies Prisma.AiStrategistAnalysisSelect;
  }

  private mapAnalysis(
    row: {
      id: string;
      level: 'campaign' | 'ad_set' | 'ad';
      dateFrom: Date;
      dateTo: Date;
      generatedAt: Date;
      contextHash: string | null;
      outputJson: Prisma.JsonValue;
      client: {
        id: string;
        nombre: string;
        empresa: string;
      };
    },
  ): StrategistComparisonAnalysis {
    return {
      id: row.id,
      client: row.client,
      level: row.level,
      date_from: row.dateFrom.toISOString().slice(0, 10),
      date_to: row.dateTo.toISOString().slice(0, 10),
      generated_at: row.generatedAt.toISOString(),
      context_hash: row.contextHash,
      output: row.outputJson as unknown as StrategistHistoryDetail['output'],
    };
  }
}
