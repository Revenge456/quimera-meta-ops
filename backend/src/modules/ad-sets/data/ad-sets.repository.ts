import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import {
  buildListMeta,
  buildMetricSummaryFromAggregate,
  resolveEntityListSort,
  resolvePagination,
  sortIdsByMetric,
} from '../../shared/utils/entity-list-query';
import {
  aggregatePerformance,
  buildDailyChart,
  emptyPerformanceSummary,
  resolveDateRange,
} from '../../shared/utils/performance-metrics';

@Injectable()
export class AdSetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthUser,
    filters: {
      clienteId?: string;
      adAccountId?: string;
      campaignId?: string;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number | string;
      pageSize?: number | string;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const adAccountWhere = {
      ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
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

    const campaignWhere = {
      ...(filters.adAccountId ? { adAccountId: filters.adAccountId } : {}),
      ...(Object.keys(adAccountWhere).length > 0 ? { adAccount: adAccountWhere } : {}),
    };

    const range = resolveDateRange(filters.dateFrom, filters.dateTo);
    const pagination = resolvePagination(filters.page, filters.pageSize);
    const sort = resolveEntityListSort(filters.sortBy, filters.sortOrder);
    const where = {
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.status ? { effectiveStatus: filters.status } : {}),
      ...(filters.search
        ? {
            name: {
              contains: filters.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(Object.keys(campaignWhere).length > 0 ? { campaign: campaignWhere } : {}),
    };
    const total = await this.prisma.adSet.count({ where });
    const include = {
      campaign: {
        include: {
          adAccount: {
            include: {
              client: {
                select: {
                  id: true,
                  nombre: true,
                  empresa: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          ads: true,
        },
      },
    } as const;

    let adSets;
    if (sort.mode === 'entity') {
      adSets = await this.prisma.adSet.findMany({
        where,
        include,
        orderBy:
          sort.field === 'name'
            ? { name: sort.order }
            : sort.field === 'status'
              ? { effectiveStatus: sort.order }
              : { createdAt: sort.order },
        skip: pagination.skip,
        take: pagination.take,
      });
    } else {
      const matchingAdSets = await this.prisma.adSet.findMany({
        where,
        select: { id: true },
      });
      const ids = matchingAdSets.map((adSet) => adSet.id);
      const aggregates =
        ids.length === 0
          ? []
          : await this.prisma.adSetInsightDaily.groupBy({
              by: ['adSetId'],
              where: {
                adSetId: {
                  in: ids,
                },
                date: {
                  gte: range.from,
                  lte: range.to,
                },
              },
              _sum: {
                spend: true,
                impressions: true,
                clicks: true,
                results: true,
                purchases: true,
                purchaseValue: true,
              },
            });
      const aggregateMap = new Map(
        aggregates.map((aggregate) => [
          aggregate.adSetId,
          buildMetricSummaryFromAggregate(aggregate._sum),
        ]),
      );
      const pagedIds = sortIdsByMetric({
        ids,
        summaries: aggregateMap,
        field: sort.field,
        order: sort.order,
      }).slice(pagination.skip, pagination.skip + pagination.take);

      adSets =
        pagedIds.length === 0
          ? []
          : await this.prisma.adSet.findMany({
              where: {
                id: {
                  in: pagedIds,
                },
              },
              include,
            });

      const adSetMap = new Map(adSets.map((adSet) => [adSet.id, adSet]));
      adSets = pagedIds
        .map((id) => adSetMap.get(id))
        .filter((adSet): adSet is NonNullable<typeof adSet> => Boolean(adSet));
    }

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
              date: true,
              spend: true,
              impressions: true,
              reach: true,
              clicks: true,
              linkClicks: true,
              landingPageViews: true,
              results: true,
              resultType: true,
              leads: true,
              purchases: true,
              purchaseValue: true,
            },
          });

    const groupedInsights = new Map<string, typeof insights>();
    for (const insight of insights) {
      const existing = groupedInsights.get(insight.adSetId) ?? [];
      existing.push(insight);
      groupedInsights.set(insight.adSetId, existing);
    }

    return {
      data: adSets.map((adSet) => ({
        ...adSet,
        metrics:
          groupedInsights.has(adSet.id)
            ? aggregatePerformance(groupedInsights.get(adSet.id) ?? [])
            : emptyPerformanceSummary(),
        range,
      })),
      meta: buildListMeta({
        total,
        pagination,
        sort,
      }),
    };
  }

  async detail(
    actor: AuthUser,
    id: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const adAccountWhere =
      actor.role === 'commercial_manager'
        ? {
            client: {
              assignments: {
                some: {
                  userId: actor.sub,
                },
              },
            },
          }
        : {};

    const campaignWhere =
      Object.keys(adAccountWhere).length > 0 ? { adAccount: adAccountWhere } : {};

    const range = resolveDateRange(filters.dateFrom, filters.dateTo);

    const adSet = await this.prisma.adSet.findFirst({
      where: {
        id,
        ...(Object.keys(campaignWhere).length > 0 ? { campaign: campaignWhere } : {}),
      },
      include: {
        campaign: {
          include: {
            adAccount: {
              include: {
                client: {
                  select: {
                    id: true,
                    nombre: true,
                    empresa: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            ads: true,
          },
        },
      },
    });

    if (!adSet) {
      throw new NotFoundException('Ad set no encontrado');
    }

    const insights = await this.prisma.adSetInsightDaily.findMany({
      where: {
        adSetId: adSet.id,
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        date: true,
        spend: true,
        impressions: true,
        reach: true,
        clicks: true,
        linkClicks: true,
        landingPageViews: true,
        results: true,
        resultType: true,
        leads: true,
        purchases: true,
        purchaseValue: true,
      },
      orderBy: { date: 'asc' },
    });

    return {
      ...adSet,
      metrics: aggregatePerformance(insights),
      range,
    };
  }

  async dailyChart(
    actor: AuthUser,
    id: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const adSet = await this.detail(actor, id, filters);
    const range = resolveDateRange(filters.dateFrom, filters.dateTo);
    const rows = await this.prisma.adSetInsightDaily.findMany({
      where: {
        adSetId: adSet.id,
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        date: true,
        spend: true,
        impressions: true,
        reach: true,
        clicks: true,
        linkClicks: true,
        landingPageViews: true,
        results: true,
        resultType: true,
        leads: true,
        purchases: true,
        purchaseValue: true,
      },
      orderBy: { date: 'asc' },
    });

    return {
      entityId: adSet.id,
      level: 'ad_sets',
      range,
      rows: buildDailyChart(rows),
    };
  }
}
