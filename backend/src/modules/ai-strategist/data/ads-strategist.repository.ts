import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  buildDailyChart,
  aggregatePerformance,
  resolveDateRange,
  type DailyInsightLike,
} from '../../shared/utils/performance-metrics';
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
import type {
  StrategistHistoryDetail,
  StrategistHistorySummary,
  StrategistEntityRecord,
  StrategistFilters,
  StrategistLevel,
  StrategistPreparedContext,
  StrategistResponse,
} from '../domain/ads-strategist.types';

type AccessibleClient = {
  id: string;
  nombre: string;
  empresa: string;
};

const insightSelect = {
  date: true,
  spend: true,
  impressions: true,
  reach: true,
  frequency: true,
  clicks: true,
  linkClicks: true,
  landingPageViews: true,
  cpm: true,
  cpc: true,
  ctr: true,
  results: true,
  resultType: true,
  costPerResult: true,
  leads: true,
  purchases: true,
  purchaseValue: true,
  roas: true,
} as const;

@Injectable()
export class AdsStrategistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccessibleClient(actor: AuthUser, clientId: string): Promise<AccessibleClient> {
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

  async listEntities(params: {
    actor: AuthUser;
    clientId: string;
    level: StrategistLevel;
    dateFrom: string;
    dateTo: string;
    filters?: StrategistFilters;
  }): Promise<StrategistEntityRecord[]> {
    const range = resolveDateRange(params.dateFrom, params.dateTo);

    switch (params.level) {
      case 'campaign':
        return this.listCampaigns(params.actor, params.clientId, params.filters ?? {}, range);
      case 'ad_set':
        return this.listAdSets(params.actor, params.clientId, params.filters ?? {}, range);
      case 'ad':
        return this.listAds(params.actor, params.clientId, params.filters ?? {}, range);
    }
  }

  async createAnalysisHistory(params: {
    actor: AuthUser;
    clientId: string;
    level: StrategistLevel;
    dateFrom: string;
    dateTo: string;
    filters?: StrategistFilters;
    context: StrategistPreparedContext | null;
    output: StrategistResponse;
  }) {
    const normalizedContext = normalizeAnalysisContext({
      clientId: params.clientId,
      level: params.level,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      filters: params.filters,
    });

    return this.prisma.aiStrategistAnalysis.create({
      data: {
        clientId: params.clientId,
        generatedByUserId: params.actor.sub,
        level: params.level,
        dateFrom: new Date(params.dateFrom),
        dateTo: new Date(params.dateTo),
        filtersJson: ((params.filters ?? {}) as Prisma.InputJsonObject) ?? Prisma.JsonNull,
        contextHash: buildAnalysisContextHash(normalizedContext),
        contextNormalizedJson: normalizedContext as unknown as Prisma.InputJsonObject,
        contextJson:
          params.context === null
            ? Prisma.JsonNull
            : (params.context as unknown as Prisma.InputJsonObject),
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
  ): Promise<{ data: StrategistHistorySummary[]; meta: ReturnType<typeof buildListMeta> }> {
    const pagination = resolvePagination(filters.page, filters.pageSize);
    const where = this.buildHistoryWhere(actor, filters);
    const total = await this.prisma.aiStrategistAnalysis.count({ where });
    const rowSelect = {
      id: true,
      level: true,
      dateFrom: true,
      dateTo: true,
      generatedAt: true,
      filtersJson: true,
      contextHash: true,
      contextNormalizedJson: true,
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
    } satisfies Prisma.AiStrategistAnalysisSelect;

    const rows = filters.contextHash
      ? await this.findPrioritizedHistoryRows({
          where,
          contextHash: filters.contextHash,
          skip: pagination.skip,
          take: pagination.take,
          select: rowSelect,
        })
      : await this.prisma.aiStrategistAnalysis.findMany({
          where,
          orderBy: { generatedAt: 'desc' },
          skip: pagination.skip,
          take: pagination.take,
          select: rowSelect,
        });

    return {
      data: rows.map((row) => {
        const output = row.outputJson as unknown as StrategistResponse;

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
          context_normalized:
            this.normalizeContext(row.contextNormalizedJson),
          exact_context_match:
            filters.contextHash ? row.contextHash === filters.contextHash : undefined,
          executive_summary: output.executive_summary,
          entities_analyzed: output.entity_analysis.length,
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
  ): Promise<StrategistHistoryDetail> {
    const row = await this.prisma.aiStrategistAnalysis.findFirst({
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
        outputJson: true,
        contextJson: true,
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
      throw new NotFoundException('Analisis estrategico no encontrado');
    }

    const output = row.outputJson as unknown as StrategistResponse;

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
      entities_analyzed: output.entity_analysis.length,
      context_snapshot: row.contextJson as StrategistPreparedContext | null,
      output,
    };
  }

  async getLatestHistoryByContextHash(
    actor: AuthUser,
    params: {
      clientId: string;
      contextHash: string;
    },
  ): Promise<StrategistHistoryDetail> {
    const row = await this.prisma.aiStrategistAnalysis.findFirst({
      where: {
        ...this.buildHistoryWhere(actor, {
          clientId: params.clientId,
        }),
        contextHash: params.contextHash,
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        level: true,
        dateFrom: true,
        dateTo: true,
        generatedAt: true,
        filtersJson: true,
        contextHash: true,
        contextNormalizedJson: true,
        outputJson: true,
        contextJson: true,
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
      throw new NotFoundException('No se encontro un strategist exacto para este contexto');
    }

    const output = row.outputJson as unknown as StrategistResponse;

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
      exact_context_match: true,
      executive_summary: output.executive_summary,
      entities_analyzed: output.entity_analysis.length,
      context_snapshot: row.contextJson as StrategistPreparedContext | null,
      output,
    };
  }

  private async listCampaigns(
    actor: AuthUser,
    clientId: string,
    filters: StrategistFilters,
    range: ReturnType<typeof resolveDateRange>,
  ) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        ...(filters.status ? { effectiveStatus: filters.status } : {}),
        ...(filters.search
          ? {
              name: {
                contains: filters.search,
                mode: 'insensitive',
              },
            }
          : {}),
        adAccount: {
          clienteId: clientId,
          ...(filters.adAccountId ? { id: filters.adAccountId } : {}),
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
        },
      },
      include: {
        adAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const insights =
      campaigns.length === 0
        ? []
        : await this.prisma.campaignInsightDaily.findMany({
            where: {
              campaignId: {
                in: campaigns.map((campaign) => campaign.id),
              },
              date: {
                gte: range.from,
                lte: range.to,
              },
            },
            select: {
              campaignId: true,
              ...insightSelect,
            },
            orderBy: { date: 'asc' },
          });

    const insightsByEntity = new Map<string, DailyInsightLike[]>();
    for (const insight of insights) {
      const current = insightsByEntity.get(insight.campaignId) ?? [];
      current.push(insight);
      insightsByEntity.set(insight.campaignId, current);
    }

    return campaigns.map((campaign) => {
      const rows = insightsByEntity.get(campaign.id) ?? [];

      return {
        entity_id: campaign.id,
        entity_name: campaign.name,
        level: 'campaign' as const,
        status: campaign.effectiveStatus,
        ad_account_id: campaign.adAccountId,
        ad_account_name: campaign.adAccount.name,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        ad_set_id: null,
        ad_set_name: null,
        main_metrics: rows.length > 0 ? aggregatePerformance(rows) : aggregatePerformance([]),
        daily_series: buildDailyChart(rows),
      };
    });
  }

  private async listAdSets(
    actor: AuthUser,
    clientId: string,
    filters: StrategistFilters,
    range: ReturnType<typeof resolveDateRange>,
  ) {
    const adSets = await this.prisma.adSet.findMany({
      where: {
        ...(filters.status ? { effectiveStatus: filters.status } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.search
          ? {
              name: {
                contains: filters.search,
                mode: 'insensitive',
              },
            }
          : {}),
        campaign: {
          ...(filters.adAccountId ? { adAccountId: filters.adAccountId } : {}),
          adAccount: {
            clienteId: clientId,
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
          },
        },
      },
      include: {
        campaign: {
          include: {
            adAccount: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const insights =
      adSets.length === 0
        ? []
        : await this.prisma.adSetInsightDaily.findMany({
            where: {
              adSetId: {
                in: adSets.map((adSet) => adSet.id),
              },
              date: {
                gte: range.from,
                lte: range.to,
              },
            },
            select: {
              adSetId: true,
              ...insightSelect,
            },
            orderBy: { date: 'asc' },
          });

    const insightsByEntity = new Map<string, DailyInsightLike[]>();
    for (const insight of insights) {
      const current = insightsByEntity.get(insight.adSetId) ?? [];
      current.push(insight);
      insightsByEntity.set(insight.adSetId, current);
    }

    return adSets.map((adSet) => {
      const rows = insightsByEntity.get(adSet.id) ?? [];

      return {
        entity_id: adSet.id,
        entity_name: adSet.name,
        level: 'ad_set' as const,
        status: adSet.effectiveStatus,
        ad_account_id: adSet.campaign.adAccountId,
        ad_account_name: adSet.campaign.adAccount.name,
        campaign_id: adSet.campaignId,
        campaign_name: adSet.campaign.name,
        ad_set_id: adSet.id,
        ad_set_name: adSet.name,
        main_metrics: rows.length > 0 ? aggregatePerformance(rows) : aggregatePerformance([]),
        daily_series: buildDailyChart(rows),
      };
    });
  }

  private async listAds(
    actor: AuthUser,
    clientId: string,
    filters: StrategistFilters,
    range: ReturnType<typeof resolveDateRange>,
  ) {
    const ads = await this.prisma.ad.findMany({
      where: {
        ...(filters.status ? { effectiveStatus: filters.status } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.adSetId ? { adsetId: filters.adSetId } : {}),
        ...(filters.search
          ? {
              name: {
                contains: filters.search,
                mode: 'insensitive',
              },
            }
          : {}),
        campaign: {
          ...(filters.adAccountId ? { adAccountId: filters.adAccountId } : {}),
          adAccount: {
            clienteId: clientId,
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
          },
        },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            adAccountId: true,
            adAccount: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        adSet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const insights =
      ads.length === 0
        ? []
        : await this.prisma.adInsightDaily.findMany({
            where: {
              adId: {
                in: ads.map((ad) => ad.id),
              },
              date: {
                gte: range.from,
                lte: range.to,
              },
            },
            select: {
              adId: true,
              ...insightSelect,
            },
            orderBy: { date: 'asc' },
          });

    const insightsByEntity = new Map<string, DailyInsightLike[]>();
    for (const insight of insights) {
      const current = insightsByEntity.get(insight.adId) ?? [];
      current.push(insight);
      insightsByEntity.set(insight.adId, current);
    }

    return ads.map((ad) => {
      const rows = insightsByEntity.get(ad.id) ?? [];

      return {
        entity_id: ad.id,
        entity_name: ad.name,
        level: 'ad' as const,
        status: ad.effectiveStatus,
        ad_account_id: ad.campaign.adAccountId,
        ad_account_name: ad.campaign.adAccount.name,
        campaign_id: ad.campaignId,
        campaign_name: ad.campaign.name,
        ad_set_id: ad.adsetId,
        ad_set_name: ad.adSet.name,
        main_metrics: rows.length > 0 ? aggregatePerformance(rows) : aggregatePerformance([]),
        daily_series: buildDailyChart(rows),
      };
    });
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
  ): Prisma.AiStrategistAnalysisWhereInput {
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

  private normalizeFilters(payload: Prisma.JsonValue | null): StrategistFilters {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return payload as unknown as StrategistFilters;
  }

  private normalizeContext(payload: Prisma.JsonValue | null): NormalizedAnalysisContext | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    return payload as unknown as NormalizedAnalysisContext;
  }

  private async findPrioritizedHistoryRows(params: {
    where: Prisma.AiStrategistAnalysisWhereInput;
    contextHash: string;
    skip: number;
    take: number;
    select: Prisma.AiStrategistAnalysisSelect;
  }) {
    const exactWhere: Prisma.AiStrategistAnalysisWhereInput = {
      ...params.where,
      contextHash: params.contextHash,
    };

    const exactCount = await this.prisma.aiStrategistAnalysis.count({
      where: exactWhere,
    });

    if (params.skip < exactCount) {
      const exactRows = await this.prisma.aiStrategistAnalysis.findMany({
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

      const similarRows = await this.prisma.aiStrategistAnalysis.findMany({
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

    return this.prisma.aiStrategistAnalysis.findMany({
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
