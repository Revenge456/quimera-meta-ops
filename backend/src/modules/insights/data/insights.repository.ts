import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InsightsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestInsightDatesByAdAccount(adAccountId: string) {
    const [campaign, adSet, ad] = await this.prisma.$transaction([
      this.prisma.campaignInsightDaily.findFirst({
        where: {
          campaign: {
            adAccountId,
          },
        },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.adSetInsightDaily.findFirst({
        where: {
          adSet: {
            campaign: {
              adAccountId,
            },
          },
        },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.adInsightDaily.findFirst({
        where: {
          ad: {
            campaign: {
              adAccountId,
            },
          },
        },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);

    return {
      campaign: campaign?.date ?? null,
      adSet: adSet?.date ?? null,
      ad: ad?.date ?? null,
    };
  }

  upsertCampaignInsightDaily(params: {
    campaignId: string;
    date: Date;
    spend?: string;
    impressions?: number;
    reach?: number;
    frequency?: string;
    clicks?: number;
    linkClicks?: number;
    landingPageViews?: number;
    cpm?: string;
    cpc?: string;
    ctr?: string;
    results?: string;
    resultType?: string;
    costPerResult?: string;
    leads?: string;
    purchases?: string;
    purchaseValue?: string;
    roas?: string;
    actionsJson?: Prisma.InputJsonValue;
    actionValuesJson?: Prisma.InputJsonValue;
    videoMetricsJson?: Prisma.InputJsonValue;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.campaignInsightDaily.upsert({
      where: {
        campaignId_date: {
          campaignId: params.campaignId,
          date: params.date,
        },
      },
      update: {
        spend: params.spend,
        impressions: params.impressions,
        reach: params.reach,
        frequency: params.frequency,
        clicks: params.clicks,
        linkClicks: params.linkClicks,
        landingPageViews: params.landingPageViews,
        cpm: params.cpm,
        cpc: params.cpc,
        ctr: params.ctr,
        results: params.results,
        resultType: params.resultType,
        costPerResult: params.costPerResult,
        leads: params.leads,
        purchases: params.purchases,
        purchaseValue: params.purchaseValue,
        roas: params.roas,
        actionsJson: params.actionsJson,
        actionValuesJson: params.actionValuesJson,
        videoMetricsJson: params.videoMetricsJson,
        rawJson: params.rawJson,
      },
      create: {
        campaignId: params.campaignId,
        date: params.date,
        spend: params.spend,
        impressions: params.impressions,
        reach: params.reach,
        frequency: params.frequency,
        clicks: params.clicks,
        linkClicks: params.linkClicks,
        landingPageViews: params.landingPageViews,
        cpm: params.cpm,
        cpc: params.cpc,
        ctr: params.ctr,
        results: params.results,
        resultType: params.resultType,
        costPerResult: params.costPerResult,
        leads: params.leads,
        purchases: params.purchases,
        purchaseValue: params.purchaseValue,
        roas: params.roas,
        actionsJson: params.actionsJson,
        actionValuesJson: params.actionValuesJson,
        videoMetricsJson: params.videoMetricsJson,
        rawJson: params.rawJson,
      },
    });
  }

  upsertAdSetInsightDaily(params: {
    adSetId: string;
    date: Date;
    spend?: string;
    impressions?: number;
    reach?: number;
    frequency?: string;
    clicks?: number;
    linkClicks?: number;
    landingPageViews?: number;
    cpm?: string;
    cpc?: string;
    ctr?: string;
    results?: string;
    resultType?: string;
    costPerResult?: string;
    leads?: string;
    purchases?: string;
    purchaseValue?: string;
    roas?: string;
    actionsJson?: Prisma.InputJsonValue;
    actionValuesJson?: Prisma.InputJsonValue;
    videoMetricsJson?: Prisma.InputJsonValue;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.adSetInsightDaily.upsert({
      where: {
        adSetId_date: {
          adSetId: params.adSetId,
          date: params.date,
        },
      },
      update: {
        spend: params.spend,
        impressions: params.impressions,
        reach: params.reach,
        frequency: params.frequency,
        clicks: params.clicks,
        linkClicks: params.linkClicks,
        landingPageViews: params.landingPageViews,
        cpm: params.cpm,
        cpc: params.cpc,
        ctr: params.ctr,
        results: params.results,
        resultType: params.resultType,
        costPerResult: params.costPerResult,
        leads: params.leads,
        purchases: params.purchases,
        purchaseValue: params.purchaseValue,
        roas: params.roas,
        actionsJson: params.actionsJson,
        actionValuesJson: params.actionValuesJson,
        videoMetricsJson: params.videoMetricsJson,
        rawJson: params.rawJson,
      },
      create: {
        adSetId: params.adSetId,
        date: params.date,
        spend: params.spend,
        impressions: params.impressions,
        reach: params.reach,
        frequency: params.frequency,
        clicks: params.clicks,
        linkClicks: params.linkClicks,
        landingPageViews: params.landingPageViews,
        cpm: params.cpm,
        cpc: params.cpc,
        ctr: params.ctr,
        results: params.results,
        resultType: params.resultType,
        costPerResult: params.costPerResult,
        leads: params.leads,
        purchases: params.purchases,
        purchaseValue: params.purchaseValue,
        roas: params.roas,
        actionsJson: params.actionsJson,
        actionValuesJson: params.actionValuesJson,
        videoMetricsJson: params.videoMetricsJson,
        rawJson: params.rawJson,
      },
    });
  }

  upsertAdInsightDaily(params: {
    adId: string;
    date: Date;
    spend?: string;
    impressions?: number;
    reach?: number;
    frequency?: string;
    clicks?: number;
    linkClicks?: number;
    landingPageViews?: number;
    cpm?: string;
    cpc?: string;
    ctr?: string;
    results?: string;
    resultType?: string;
    costPerResult?: string;
    leads?: string;
    purchases?: string;
    purchaseValue?: string;
    roas?: string;
    actionsJson?: Prisma.InputJsonValue;
    actionValuesJson?: Prisma.InputJsonValue;
    videoMetricsJson?: Prisma.InputJsonValue;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.adInsightDaily.upsert({
      where: {
        adId_date: {
          adId: params.adId,
          date: params.date,
        },
      },
      update: {
        spend: params.spend,
        impressions: params.impressions,
        reach: params.reach,
        frequency: params.frequency,
        clicks: params.clicks,
        linkClicks: params.linkClicks,
        landingPageViews: params.landingPageViews,
        cpm: params.cpm,
        cpc: params.cpc,
        ctr: params.ctr,
        results: params.results,
        resultType: params.resultType,
        costPerResult: params.costPerResult,
        leads: params.leads,
        purchases: params.purchases,
        purchaseValue: params.purchaseValue,
        roas: params.roas,
        actionsJson: params.actionsJson,
        actionValuesJson: params.actionValuesJson,
        videoMetricsJson: params.videoMetricsJson,
        rawJson: params.rawJson,
      },
      create: {
        adId: params.adId,
        date: params.date,
        spend: params.spend,
        impressions: params.impressions,
        reach: params.reach,
        frequency: params.frequency,
        clicks: params.clicks,
        linkClicks: params.linkClicks,
        landingPageViews: params.landingPageViews,
        cpm: params.cpm,
        cpc: params.cpc,
        ctr: params.ctr,
        results: params.results,
        resultType: params.resultType,
        costPerResult: params.costPerResult,
        leads: params.leads,
        purchases: params.purchases,
        purchaseValue: params.purchaseValue,
        roas: params.roas,
        actionsJson: params.actionsJson,
        actionValuesJson: params.actionValuesJson,
        videoMetricsJson: params.videoMetricsJson,
        rawJson: params.rawJson,
      },
    });
  }
}
