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
export class CampaignsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthUser,
    filters: {
      clienteId?: string;
      adAccountId?: string;
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

    const range = resolveDateRange(filters.dateFrom, filters.dateTo);
    const pagination = resolvePagination(filters.page, filters.pageSize);
    const sort = resolveEntityListSort(filters.sortBy, filters.sortOrder);
    const where = {
      ...(filters.adAccountId ? { adAccountId: filters.adAccountId } : {}),
      ...(filters.status ? { effectiveStatus: filters.status } : {}),
      ...(filters.search
        ? {
            name: {
              contains: filters.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(Object.keys(adAccountWhere).length > 0 ? { adAccount: adAccountWhere } : {}),
    };

    const total = await this.prisma.campaign.count({ where });
    const include = {
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
      _count: {
        select: {
          adSets: true,
          ads: true,
        },
      },
    } as const;

    let campaigns;
    if (sort.mode === 'entity') {
      campaigns = await this.prisma.campaign.findMany({
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
      const matchingCampaigns = await this.prisma.campaign.findMany({
        where,
        select: { id: true },
      });
      const ids = matchingCampaigns.map((campaign) => campaign.id);
      const aggregates =
        ids.length === 0
          ? []
          : await this.prisma.campaignInsightDaily.groupBy({
              by: ['campaignId'],
              where: {
                campaignId: {
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
          aggregate.campaignId,
          buildMetricSummaryFromAggregate(aggregate._sum),
        ]),
      );
      const pagedIds = sortIdsByMetric({
        ids,
        summaries: aggregateMap,
        field: sort.field,
        order: sort.order,
      }).slice(pagination.skip, pagination.skip + pagination.take);

      campaigns =
        pagedIds.length === 0
          ? []
          : await this.prisma.campaign.findMany({
              where: {
                id: {
                  in: pagedIds,
                },
              },
              include,
            });

      const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
      campaigns = pagedIds
        .map((id) => campaignMap.get(id))
        .filter((campaign): campaign is NonNullable<typeof campaign> => Boolean(campaign));
    }

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
      const existing = groupedInsights.get(insight.campaignId) ?? [];
      existing.push(insight);
      groupedInsights.set(insight.campaignId, existing);
    }

    return {
      data: campaigns.map((campaign) => ({
        ...campaign,
        metrics:
          groupedInsights.has(campaign.id)
            ? aggregatePerformance(groupedInsights.get(campaign.id) ?? [])
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

    const range = resolveDateRange(filters.dateFrom, filters.dateTo);

    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
        ...(Object.keys(adAccountWhere).length > 0 ? { adAccount: adAccountWhere } : {}),
      },
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
        _count: {
          select: {
            adSets: true,
            ads: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campana no encontrada');
    }

    const insights = await this.prisma.campaignInsightDaily.findMany({
      where: {
        campaignId: campaign.id,
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
      ...campaign,
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
    const campaign = await this.detail(actor, id, filters);
    const range = resolveDateRange(filters.dateFrom, filters.dateTo);
    const rows = await this.prisma.campaignInsightDaily.findMany({
      where: {
        campaignId: campaign.id,
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
      entityId: campaign.id,
      level: 'campaigns',
      range,
      rows: buildDailyChart(rows),
    };
  }
}
