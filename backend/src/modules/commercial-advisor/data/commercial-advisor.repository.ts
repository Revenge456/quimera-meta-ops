import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import {
  buildListMeta,
  resolvePagination,
} from '../../shared/utils/entity-list-query';
import {
  buildAnalysisContextHash,
  normalizeAnalysisContext,
  type NormalizedAnalysisContext,
} from '../../shared/utils/analysis-context';
import type { StrategistLevel, StrategistResponse } from '../../ai-strategist/domain/ads-strategist.types';
import type {
  CommercialAdvisorFilters,
  CommercialAdvisorHistoryDetail,
  CommercialAdvisorHistorySummary,
  CommercialAdvisorResponse,
} from '../domain/commercial-advisor.types';

@Injectable()
export class CommercialAdvisorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccessibleClient(actor: AuthUser, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        ...(actor.role === 'commercial_manager'
          ? {
              assignments: {
                some: {
                  userId: actor.sub,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        nombre: true,
        empresa: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async createAdvisorHistory(params: {
    actor: AuthUser;
    clientId: string;
    strategistAnalysisId: string | null;
    level: StrategistLevel;
    dateFrom: string;
    dateTo: string;
    filters?: CommercialAdvisorFilters;
    strategistOutput: StrategistResponse;
    output: CommercialAdvisorResponse;
  }) {
    const normalizedContext = normalizeAnalysisContext({
      clientId: params.clientId,
      level: params.level,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      filters: params.filters,
    });

    return this.prisma.commercialAdvisorAnalysis.create({
      data: {
        clientId: params.clientId,
        strategistAnalysisId: params.strategistAnalysisId,
        generatedByUserId: params.actor.sub,
        level: params.level,
        dateFrom: new Date(params.dateFrom),
        dateTo: new Date(params.dateTo),
        contextHash: buildAnalysisContextHash(normalizedContext),
        filtersJson: ((params.filters ?? {}) as Prisma.InputJsonObject) ?? Prisma.JsonNull,
        contextNormalizedJson: normalizedContext as unknown as Prisma.InputJsonObject,
        strategistOutputJson: params.strategistOutput as unknown as Prisma.InputJsonObject,
        outputJson: params.output as unknown as Prisma.InputJsonObject,
      },
      select: {
        id: true,
      },
    });
  }

  async listHistory(
    actor: AuthUser,
    filters: {
      clientId?: string;
      level?: StrategistLevel;
      dateFrom?: string;
      dateTo?: string;
      generatedFrom?: string;
      generatedTo?: string;
      contextHash?: string;
      page?: number | string;
      pageSize?: number | string;
    },
  ): Promise<{
    data: CommercialAdvisorHistorySummary[];
    meta: ReturnType<typeof buildListMeta>;
  }> {
    const pagination = resolvePagination(filters.page, filters.pageSize);
    const where = this.buildHistoryWhere(actor, filters);
    const total = await this.prisma.commercialAdvisorAnalysis.count({ where });
    const rowSelect = {
      id: true,
      level: true,
      dateFrom: true,
      dateTo: true,
      generatedAt: true,
      filtersJson: true,
      contextHash: true,
      contextNormalizedJson: true,
      strategistAnalysisId: true,
      outputJson: true,
      client: {
        select: {
          id: true,
          nombre: true,
          empresa: true,
        },
      },
      generatedBy: {
        select: {
          id: true,
          nombre: true,
          email: true,
        },
      },
    } satisfies Prisma.CommercialAdvisorAnalysisSelect;

    const rows = filters.contextHash
      ? await this.findPrioritizedHistoryRows({
          where,
          contextHash: filters.contextHash,
          skip: pagination.skip,
          take: pagination.take,
          select: rowSelect,
        })
      : await this.prisma.commercialAdvisorAnalysis.findMany({
          where,
          orderBy: { generatedAt: 'desc' },
          skip: pagination.skip,
          take: pagination.take,
          select: rowSelect,
        });

    return {
      data: rows.map((row) => {
        const output = row.outputJson as unknown as CommercialAdvisorResponse;

        return {
          id: row.id,
          client: row.client,
          generated_by: row.generatedBy,
          level: row.level,
          date_from: row.dateFrom.toISOString().slice(0, 10),
          date_to: row.dateTo.toISOString().slice(0, 10),
          generated_at: row.generatedAt.toISOString(),
          filters: this.normalizeFilters(row.filtersJson),
          context_hash: row.contextHash,
          context_normalized: this.normalizeContext(row.contextNormalizedJson),
          exact_context_match:
            filters.contextHash ? row.contextHash === filters.contextHash : undefined,
          executive_summary: output.executive_summary,
          client_ready_summary: output.client_ready_summary,
          strategist_analysis_id: row.strategistAnalysisId,
        };
      }),
      meta: buildListMeta({
        total,
        pagination,
        sort: {
          field: 'createdAt',
          order: 'desc',
          mode: 'entity',
        },
      }),
    };
  }

  async getHistoryById(
    actor: AuthUser,
    id: string,
  ): Promise<CommercialAdvisorHistoryDetail> {
    const row = await this.prisma.commercialAdvisorAnalysis.findFirst({
      where: {
        id,
        ...this.buildHistoryWhere(actor, {}),
      },
      select: {
        id: true,
        level: true,
        dateFrom: true,
        dateTo: true,
        generatedAt: true,
        filtersJson: true,
        contextHash: true,
        contextNormalizedJson: true,
        strategistAnalysisId: true,
        strategistOutputJson: true,
        outputJson: true,
        client: {
          select: {
            id: true,
            nombre: true,
            empresa: true,
          },
        },
        generatedBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Advisory comercial no encontrado');
    }

    const output = row.outputJson as unknown as CommercialAdvisorResponse;

    return {
      id: row.id,
      client: row.client,
      generated_by: row.generatedBy,
      level: row.level,
      date_from: row.dateFrom.toISOString().slice(0, 10),
      date_to: row.dateTo.toISOString().slice(0, 10),
      generated_at: row.generatedAt.toISOString(),
      filters: this.normalizeFilters(row.filtersJson),
      context_hash: row.contextHash,
      context_normalized: this.normalizeContext(row.contextNormalizedJson),
      executive_summary: output.executive_summary,
      client_ready_summary: output.client_ready_summary,
      strategist_analysis_id: row.strategistAnalysisId,
      output,
      strategist_output_snapshot:
        row.strategistOutputJson as StrategistResponse | null,
    };
  }

  private buildHistoryWhere(
    actor: AuthUser,
    filters: {
      clientId?: string;
      level?: StrategistLevel;
      dateFrom?: string;
      dateTo?: string;
      generatedFrom?: string;
      generatedTo?: string;
      contextHash?: string;
    },
  ): Prisma.CommercialAdvisorAnalysisWhereInput {
    return {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.dateFrom ? { dateFrom: { gte: new Date(filters.dateFrom) } } : {}),
      ...(filters.dateTo ? { dateTo: { lte: new Date(filters.dateTo) } } : {}),
      ...(filters.generatedFrom
        ? { generatedAt: { gte: new Date(filters.generatedFrom) } }
        : {}),
      ...(filters.generatedTo
        ? {
            generatedAt: {
              ...(filters.generatedFrom ? { gte: new Date(filters.generatedFrom) } : {}),
              lte: new Date(filters.generatedTo),
            },
          }
        : {}),
      ...(actor.role === 'commercial_manager'
        ? {
            client: {
              assignments: {
                some: {
                  userId: actor.sub,
                },
              },
            },
          }
        : {}),
    };
  }

  private normalizeFilters(payload: Prisma.JsonValue | null): CommercialAdvisorFilters {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return payload as unknown as CommercialAdvisorFilters;
  }

  private normalizeContext(payload: Prisma.JsonValue | null): NormalizedAnalysisContext | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    return payload as unknown as NormalizedAnalysisContext;
  }

  private async findPrioritizedHistoryRows(params: {
    where: Prisma.CommercialAdvisorAnalysisWhereInput;
    contextHash: string;
    skip: number;
    take: number;
    select: Prisma.CommercialAdvisorAnalysisSelect;
  }) {
    const exactWhere: Prisma.CommercialAdvisorAnalysisWhereInput = {
      ...params.where,
      contextHash: params.contextHash,
    };

    const exactCount = await this.prisma.commercialAdvisorAnalysis.count({
      where: exactWhere,
    });

    if (params.skip < exactCount) {
      const exactRows = await this.prisma.commercialAdvisorAnalysis.findMany({
        where: exactWhere,
        orderBy: { generatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: params.select,
      });

      const remaining = params.take - exactRows.length;
      if (remaining <= 0) {
        return exactRows;
      }

      const similarRows = await this.prisma.commercialAdvisorAnalysis.findMany({
        where: {
          ...params.where,
          NOT: {
            contextHash: params.contextHash,
          },
        },
        orderBy: { generatedAt: 'desc' },
        skip: 0,
        take: remaining,
        select: params.select,
      });

      return [...exactRows, ...similarRows];
    }

    return this.prisma.commercialAdvisorAnalysis.findMany({
      where: {
        ...params.where,
        NOT: {
          contextHash: params.contextHash,
        },
      },
      orderBy: { generatedAt: 'desc' },
      skip: params.skip - exactCount,
      take: params.take,
      select: params.select,
    });
  }
}
