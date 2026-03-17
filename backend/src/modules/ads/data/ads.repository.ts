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
export class AdsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthUser,
    filters: {
      clienteId?: string;
      adAccountId?: string;
      campaignId?: string;
      adSetId?: string;
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
      ...(filters.adSetId ? { adsetId: filters.adSetId } : {}),
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
    const total = await this.prisma.ad.count({ where });
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
      adSet: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          creatives: true,
        },
      },
    } as const;

    let ads;
    if (sort.mode === 'entity') {
      ads = await this.prisma.ad.findMany({
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
      const matchingAds = await this.prisma.ad.findMany({
        where,
        select: { id: true },
      });
      const ids = matchingAds.map((ad) => ad.id);
      const aggregates =
        ids.length === 0
          ? []
          : await this.prisma.adInsightDaily.groupBy({
              by: ['adId'],
              where: {
                adId: {
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
          aggregate.adId,
          buildMetricSummaryFromAggregate(aggregate._sum),
        ]),
      );
      const pagedIds = sortIdsByMetric({
        ids,
        summaries: aggregateMap,
        field: sort.field,
        order: sort.order,
      }).slice(pagination.skip, pagination.skip + pagination.take);

      ads =
        pagedIds.length === 0
          ? []
          : await this.prisma.ad.findMany({
              where: {
                id: {
                  in: pagedIds,
                },
              },
              include,
            });

      const adMap = new Map(ads.map((ad) => [ad.id, ad]));
      ads = pagedIds
        .map((id) => adMap.get(id))
        .filter((ad): ad is NonNullable<typeof ad> => Boolean(ad));
    }

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
      const existing = groupedInsights.get(insight.adId) ?? [];
      existing.push(insight);
      groupedInsights.set(insight.adId, existing);
    }

    return {
      data: ads.map((ad) => ({
        ...ad,
        metrics:
          groupedInsights.has(ad.id)
            ? aggregatePerformance(groupedInsights.get(ad.id) ?? [])
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

    const ad = await this.prisma.ad.findFirst({
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
        adSet: {
          select: {
            id: true,
            name: true,
          },
        },
        creatives: true,
        _count: {
          select: {
            creatives: true,
          },
        },
      },
    });

    if (!ad) {
      throw new NotFoundException('Anuncio no encontrado');
    }

    const insights = await this.prisma.adInsightDaily.findMany({
      where: {
        adId: ad.id,
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
      ...ad,
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
    const ad = await this.detail(actor, id, filters);
    const range = resolveDateRange(filters.dateFrom, filters.dateTo);
    const rows = await this.prisma.adInsightDaily.findMany({
      where: {
        adId: ad.id,
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
      entityId: ad.id,
      level: 'ads',
      range,
      rows: buildDailyChart(rows),
    };
  }
}
