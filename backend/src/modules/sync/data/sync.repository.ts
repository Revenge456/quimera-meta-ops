import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SyncStatus, SyncType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getClientForSync(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        nombre: true,
        metaAdAccountIds: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  getLatestSuccessfulSync(clientId: string, adAccountId?: string) {
    return this.prisma.syncLog.findFirst({
      where: {
        clienteId: clientId,
        adAccountId,
        status: SyncStatus.success,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  findAdAccountByMetaId(metaAccountId: string) {
    return this.prisma.adAccount.findUnique({
      where: { metaAccountId },
      select: {
        id: true,
        lastSyncedAt: true,
      },
    });
  }

  getInsightEntityMapByAdAccount(adAccountId: string) {
    return this.prisma.adAccount.findUnique({
      where: { id: adAccountId },
      select: {
        campaigns: {
          select: {
            id: true,
            metaCampaignId: true,
            adSets: {
              select: {
                id: true,
                metaAdsetId: true,
                ads: {
                  select: {
                    id: true,
                    metaAdId: true,
                  },
                },
              },
            },
            ads: {
              select: {
                id: true,
                metaAdId: true,
              },
            },
          },
        },
      },
    });
  }

  createSyncLog(params: {
    clienteId: string;
    adAccountId?: string;
    syncType: SyncType;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return this.prisma.syncLog.create({
      data: {
        clienteId: params.clienteId,
        adAccountId: params.adAccountId,
        syncType: params.syncType,
        status: SyncStatus.running,
        metadataJson: params.metadataJson,
      },
    });
  }

  updateSyncLog(
    syncLogId: string,
    params: {
      adAccountId?: string;
      status: SyncStatus;
      rowsUpserted: number;
      apiCallsUsed: number;
      errorMessage?: string;
      metadataJson?: Prisma.InputJsonValue;
      startedAt: Date;
    },
  ) {
    const completedAt = new Date();

    return this.prisma.syncLog.update({
      where: { id: syncLogId },
      data: {
        adAccountId: params.adAccountId,
        status: params.status,
        completedAt,
        durationMs: completedAt.getTime() - params.startedAt.getTime(),
        rowsUpserted: params.rowsUpserted,
        apiCallsUsed: params.apiCallsUsed,
        errorMessage: params.errorMessage,
        metadataJson: params.metadataJson,
      },
    });
  }

  async upsertAdAccount(params: {
    clienteId: string;
    metaAccountId: string;
    name: string;
    currency?: string;
    timezone?: string;
    status?: string;
    amountSpent?: string;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.adAccount.upsert({
      where: { metaAccountId: params.metaAccountId },
      update: {
        clienteId: params.clienteId,
        name: params.name,
        currency: params.currency,
        timezone: params.timezone,
        status: params.status,
        amountSpent: params.amountSpent,
        lastSyncedAt: new Date(),
        rawJson: params.rawJson,
      },
      create: {
        clienteId: params.clienteId,
        metaAccountId: params.metaAccountId,
        name: params.name,
        currency: params.currency,
        timezone: params.timezone,
        status: params.status,
        amountSpent: params.amountSpent,
        lastSyncedAt: new Date(),
        rawJson: params.rawJson,
      },
    });
  }

  async upsertCampaign(params: {
    adAccountId: string;
    metaCampaignId: string;
    name: string;
    objective?: string;
    buyingType?: string;
    budgetFields?: Prisma.InputJsonValue;
    effectiveStatus?: string;
    configuredStatus?: string;
    startTime?: Date;
    stopTime?: Date;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.campaign.upsert({
      where: { metaCampaignId: params.metaCampaignId },
      update: {
        adAccountId: params.adAccountId,
        name: params.name,
        objective: params.objective,
        buyingType: params.buyingType,
        budgetFields: params.budgetFields,
        effectiveStatus: params.effectiveStatus,
        configuredStatus: params.configuredStatus,
        startTime: params.startTime,
        stopTime: params.stopTime,
        rawJson: params.rawJson,
      },
      create: {
        adAccountId: params.adAccountId,
        metaCampaignId: params.metaCampaignId,
        name: params.name,
        objective: params.objective,
        buyingType: params.buyingType,
        budgetFields: params.budgetFields,
        effectiveStatus: params.effectiveStatus,
        configuredStatus: params.configuredStatus,
        startTime: params.startTime,
        stopTime: params.stopTime,
        rawJson: params.rawJson,
      },
    });
  }

  async upsertAdSet(params: {
    campaignId: string;
    metaAdsetId: string;
    name: string;
    optimizationGoal?: string;
    billingEvent?: string;
    bidStrategy?: string;
    targetingJson?: Prisma.InputJsonValue;
    effectiveStatus?: string;
    startTime?: Date;
    stopTime?: Date;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.adSet.upsert({
      where: { metaAdsetId: params.metaAdsetId },
      update: {
        campaignId: params.campaignId,
        name: params.name,
        optimizationGoal: params.optimizationGoal,
        billingEvent: params.billingEvent,
        bidStrategy: params.bidStrategy,
        targetingJson: params.targetingJson,
        effectiveStatus: params.effectiveStatus,
        startTime: params.startTime,
        stopTime: params.stopTime,
        rawJson: params.rawJson,
      },
      create: {
        campaignId: params.campaignId,
        metaAdsetId: params.metaAdsetId,
        name: params.name,
        optimizationGoal: params.optimizationGoal,
        billingEvent: params.billingEvent,
        bidStrategy: params.bidStrategy,
        targetingJson: params.targetingJson,
        effectiveStatus: params.effectiveStatus,
        startTime: params.startTime,
        stopTime: params.stopTime,
        rawJson: params.rawJson,
      },
    });
  }

  async upsertAd(params: {
    adsetId: string;
    campaignId: string;
    metaAdId: string;
    name: string;
    effectiveStatus?: string;
    configuredStatus?: string;
    creativeId?: string;
    previewData?: Prisma.InputJsonValue;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.ad.upsert({
      where: { metaAdId: params.metaAdId },
      update: {
        adsetId: params.adsetId,
        campaignId: params.campaignId,
        name: params.name,
        effectiveStatus: params.effectiveStatus,
        configuredStatus: params.configuredStatus,
        creativeId: params.creativeId,
        previewData: params.previewData,
        rawJson: params.rawJson,
      },
      create: {
        adsetId: params.adsetId,
        campaignId: params.campaignId,
        metaAdId: params.metaAdId,
        name: params.name,
        effectiveStatus: params.effectiveStatus,
        configuredStatus: params.configuredStatus,
        creativeId: params.creativeId,
        previewData: params.previewData,
        rawJson: params.rawJson,
      },
    });
  }

  async upsertAdCreative(params: {
    adId: string;
    metaCreativeId: string;
    name?: string;
    body?: string;
    headline?: string;
    callToAction?: string;
    assetType?: string;
    assetUrl?: string;
    thumbnailUrl?: string;
    landingUrl?: string;
    rawJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.adCreative.upsert({
      where: { metaCreativeId: params.metaCreativeId },
      update: {
        adId: params.adId,
        name: params.name,
        body: params.body,
        headline: params.headline,
        callToAction: params.callToAction,
        assetType: params.assetType,
        assetUrl: params.assetUrl,
        thumbnailUrl: params.thumbnailUrl,
        landingUrl: params.landingUrl,
        rawJson: params.rawJson,
      },
      create: {
        adId: params.adId,
        metaCreativeId: params.metaCreativeId,
        name: params.name,
        body: params.body,
        headline: params.headline,
        callToAction: params.callToAction,
        assetType: params.assetType,
        assetUrl: params.assetUrl,
        thumbnailUrl: params.thumbnailUrl,
        landingUrl: params.landingUrl,
        rawJson: params.rawJson,
      },
    });
  }

  listSyncLogs() {
    return this.prisma.syncLog.findMany({
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
          },
        },
        adAccount: {
          select: {
            id: true,
            name: true,
            metaAccountId: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }
}
