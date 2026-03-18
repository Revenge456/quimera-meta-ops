import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SyncStatus, SyncType } from '@prisma/client';

import { InsightsRepository } from '../../insights/data/insights.repository';
import { SystemLogService } from '../../logging/application/system-log.service';
import { MetaConnectionsService } from '../../meta-connections/application/meta-connections.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { SyncLockService } from '../domain/sync-lock.service';
import { MetaAdsClient, type MetaInsightRow } from '../integration/meta-ads.client';
import { SyncRepository } from '../data/sync.repository';

type InsightPersistStats = {
  upserted: number;
  skipped: number;
};

@Injectable()
export class SyncEngineService {
  constructor(
    private readonly repository: SyncRepository,
    private readonly insightsRepository: InsightsRepository,
    private readonly metaAdsClient: MetaAdsClient,
    private readonly metaConnectionsService: MetaConnectionsService,
    private readonly systemLogService: SystemLogService,
    private readonly syncLockService: SyncLockService,
  ) {}

  async triggerClientSync(
    actor: AuthUser,
    clientId: string,
    syncType: SyncType,
  ) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }

    const resolution =
      await this.metaConnectionsService.resolveSyncTargetsForClient(clientId);

    const results = [];
    for (const target of resolution.targets) {
      results.push(
        await this.syncSingleAccount({
          clientId: resolution.clientId,
          clientName: resolution.clientName,
          metaAdAccountId: target.metaAdAccountId,
          credential: target.credential,
          syncType,
        }),
      );
    }

    return {
      clientId: resolution.clientId,
      syncType,
      accounts: results,
    };
  }

  private async syncSingleAccount(params: {
    clientId: string;
    clientName: string;
    metaAdAccountId: string;
    credential: {
      accessToken: string;
      source: 'client_connection' | 'global_fallback';
      connectionId?: string;
    };
    syncType: SyncType;
  }) {
    const lockKey = `${params.clientId}:${params.metaAdAccountId}`;
    if (!this.syncLockService.acquire(lockKey)) {
      throw new ConflictException(
        `Ya existe un sync en curso para ${params.metaAdAccountId}`,
      );
    }

    const startedAt = new Date();
    const syncLog = await this.repository.createSyncLog({
      clienteId: params.clientId,
      metaConnectionId: params.credential.connectionId,
      syncType: params.syncType,
      metadataJson: {
        clientName: params.clientName,
        metaAdAccountId: params.metaAdAccountId,
        credentialSource: params.credential.source,
      },
    });

    let rowsUpserted = 0;
    let apiCallsUsed = 0;

    try {
      const previousSync =
        params.syncType === SyncType.incremental
          ? await this.getPreviousSync(params.clientId, params.metaAdAccountId)
          : null;
      const updatedSince = previousSync?.completedAt?.toISOString();

      const adAccountResponse = await this.metaAdsClient.getAdAccount(
        params.metaAdAccountId,
        params.credential,
      );
      apiCallsUsed += adAccountResponse.apiCallsUsed;

      const adAccount = await this.repository.upsertAdAccount({
        clienteId: params.clientId,
        metaConnectionId: params.credential.connectionId,
        metaAccountId: adAccountResponse.row.id,
        name: adAccountResponse.row.name,
        currency: adAccountResponse.row.currency,
        timezone: adAccountResponse.row.timezone_name,
        status: String(adAccountResponse.row.account_status ?? ''),
        amountSpent: adAccountResponse.row.amount_spent,
        rawJson: adAccountResponse.row,
      });
      rowsUpserted += 1;

      const campaignsResponse = await this.metaAdsClient.listCampaigns(
        params.metaAdAccountId,
        params.credential,
        updatedSince,
      );
      apiCallsUsed += campaignsResponse.apiCallsUsed;

      const campaignIds = new Map<string, string>();
      for (const campaign of campaignsResponse.rows) {
        const upserted = await this.repository.upsertCampaign({
          adAccountId: adAccount.id,
          metaCampaignId: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          buyingType: campaign.buying_type,
          budgetFields: {
            daily_budget: campaign.daily_budget,
            lifetime_budget: campaign.lifetime_budget,
          } as Prisma.InputJsonValue,
          effectiveStatus: campaign.effective_status,
          configuredStatus: campaign.configured_status,
          startTime: campaign.start_time
            ? new Date(campaign.start_time)
            : undefined,
          stopTime: campaign.stop_time ? new Date(campaign.stop_time) : undefined,
          rawJson: campaign,
        });
        campaignIds.set(campaign.id, upserted.id);
        rowsUpserted += 1;
      }

      const adSetIds = new Map<string, string>();
      for (const campaign of campaignsResponse.rows) {
        const internalCampaignId = campaignIds.get(campaign.id);
        if (!internalCampaignId) {
          continue;
        }

        const adSetsResponse = await this.metaAdsClient.listAdSets(
          campaign.id,
          params.credential,
          updatedSince,
        );
        apiCallsUsed += adSetsResponse.apiCallsUsed;

        for (const adSet of adSetsResponse.rows) {
          const upserted = await this.repository.upsertAdSet({
            campaignId: internalCampaignId,
            metaAdsetId: adSet.id,
            name: adSet.name,
            optimizationGoal: adSet.optimization_goal,
            billingEvent: adSet.billing_event,
            bidStrategy: adSet.bid_strategy,
            targetingJson: adSet.targeting as Prisma.InputJsonValue | undefined,
            effectiveStatus: adSet.effective_status,
            startTime: adSet.start_time ? new Date(adSet.start_time) : undefined,
            stopTime: adSet.stop_time ? new Date(adSet.stop_time) : undefined,
            rawJson: adSet as Prisma.InputJsonValue,
          });
          adSetIds.set(adSet.id, upserted.id);
          rowsUpserted += 1;
        }
      }

      const adsResponse = await this.metaAdsClient.listAds(
        params.metaAdAccountId,
        params.credential,
        updatedSince,
      );
      apiCallsUsed += adsResponse.apiCallsUsed;

      const creativeToAd = new Map<string, string>();
      for (const ad of adsResponse.rows) {
        const internalCampaignId = ad.campaign?.id
          ? campaignIds.get(ad.campaign.id)
          : undefined;
        const internalAdSetId = ad.adset?.id ? adSetIds.get(ad.adset.id) : undefined;

        if (!internalCampaignId || !internalAdSetId) {
          throw new NotFoundException(
            `No se pudo resolver campaign/adset para el ad ${ad.id}`,
          );
        }

        const upserted = await this.repository.upsertAd({
          adsetId: internalAdSetId,
          campaignId: internalCampaignId,
          metaAdId: ad.id,
          name: ad.name,
          effectiveStatus: ad.effective_status,
          configuredStatus: ad.configured_status,
          creativeId: ad.creative?.id,
          previewData: ad.preview_shareable_link
            ? ({
                preview_shareable_link: ad.preview_shareable_link,
              } as Prisma.InputJsonValue)
            : undefined,
          rawJson: ad as Prisma.InputJsonValue,
        });
        rowsUpserted += 1;

        if (ad.creative?.id) {
          creativeToAd.set(ad.creative.id, upserted.id);
        }
      }

      for (const [metaCreativeId, adId] of creativeToAd.entries()) {
        const creativeResponse = await this.metaAdsClient.getCreative(
          metaCreativeId,
          params.credential,
        );
        apiCallsUsed += creativeResponse.apiCallsUsed;

        const creative = creativeResponse.row;
        await this.repository.upsertAdCreative({
          adId,
          metaCreativeId: creative.id,
          name: creative.name,
          body: creative.body,
          headline: creative.title,
          callToAction: creative.call_to_action_type,
          assetType: creative.asset_feed_spec ? 'dynamic' : 'static',
          assetUrl: creative.image_url,
          thumbnailUrl: creative.thumbnail_url,
          landingUrl: creative.object_url,
          rawJson: creative as Prisma.InputJsonValue,
        });
        rowsUpserted += 1;
      }

      await this.repository.updateSyncLog(syncLog.id, {
        adAccountId: adAccount.id,
        metaConnectionId: params.credential.connectionId,
        status: SyncStatus.success,
        rowsUpserted,
        apiCallsUsed,
        startedAt,
        metadataJson: {
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
        },
      });

      if (params.credential.connectionId) {
        await this.metaConnectionsService.touchConnectionLastSync(
          params.credential.connectionId,
        );
      }

      await this.systemLogService.log({
        level: 'info',
        module: 'sync',
        eventName: 'catalog_sync_success',
        message: 'Sync de catalogo completado',
        metadata: {
          clientId: params.clientId,
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          rowsUpserted,
          apiCallsUsed,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
        },
      });

      return {
        syncLogId: syncLog.id,
        metaAdAccountId: params.metaAdAccountId,
        status: SyncStatus.success,
        rowsUpserted,
        apiCallsUsed,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido de sync';

      await this.repository.updateSyncLog(syncLog.id, {
        adAccountId: undefined,
        metaConnectionId: params.credential.connectionId,
        status: SyncStatus.failed,
        rowsUpserted,
        apiCallsUsed,
        errorMessage,
        startedAt,
        metadataJson: {
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
        },
      });

      await this.systemLogService.log({
        level: 'error',
        module: 'sync',
        eventName: 'catalog_sync_failed',
        message: 'Sync de catalogo fallido',
        metadata: {
          clientId: params.clientId,
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          errorMessage,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
        },
      });

      throw error;
    } finally {
      this.syncLockService.release(lockKey);
    }
  }

  listSyncLogs(actor: AuthUser) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }

    return this.repository.listSyncLogs();
  }

  async triggerClientInsightsSync(
    actor: AuthUser,
    clientId: string,
    syncType: SyncType,
    dateFrom?: string,
    dateTo?: string,
  ) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }

    const resolution =
      await this.metaConnectionsService.resolveSyncTargetsForClient(clientId);

    const results = [];
    for (const target of resolution.targets) {
      results.push(
        await this.syncInsightsForSingleAccount({
          clientId: resolution.clientId,
          clientName: resolution.clientName,
          metaAdAccountId: target.metaAdAccountId,
          credential: target.credential,
          syncType,
          dateFrom,
          dateTo,
        }),
      );
    }

    return {
      clientId: resolution.clientId,
      syncType,
      accounts: results,
    };
  }

  private async getPreviousSync(clientId: string, metaAdAccountId: string) {
    const existingAdAccount =
      await this.repository.findAdAccountByMetaId(metaAdAccountId);

    return this.repository.getLatestSuccessfulSync(
      clientId,
      existingAdAccount?.id,
    );
  }

  private async syncInsightsForSingleAccount(params: {
    clientId: string;
    clientName: string;
    metaAdAccountId: string;
    credential: {
      accessToken: string;
      source: 'client_connection' | 'global_fallback';
      connectionId?: string;
    };
    syncType: SyncType;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const lockKey = `insights:${params.clientId}:${params.metaAdAccountId}`;
    if (!this.syncLockService.acquire(lockKey)) {
      throw new ConflictException(
        `Ya existe un sync de insights en curso para ${params.metaAdAccountId}`,
      );
    }

    const startedAt = new Date();
    const syncLog = await this.repository.createSyncLog({
      clienteId: params.clientId,
      metaConnectionId: params.credential.connectionId,
      syncType: params.syncType,
      metadataJson: {
        scope: 'insights_daily',
        clientName: params.clientName,
        metaAdAccountId: params.metaAdAccountId,
        credentialSource: params.credential.source,
      } as Prisma.InputJsonValue,
    });

    let rowsUpserted = 0;
    let apiCallsUsed = 0;

    try {
      const adAccount = await this.repository.findAdAccountByMetaId(
        params.metaAdAccountId,
      );
      if (!adAccount) {
        throw new NotFoundException(
          `No existe ad_account local para ${params.metaAdAccountId}`,
        );
      }

      const { since, until } = await this.resolveInsightsRange({
        adAccountId: adAccount.id,
        syncType: params.syncType,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      });

      const entityMap = await this.repository.getInsightEntityMapByAdAccount(
        adAccount.id,
      );
      if (!entityMap) {
        throw new NotFoundException('No existe mapa local de entidades para insights');
      }

      const campaignMap = new Map(
        entityMap.campaigns.map((campaign) => [campaign.metaCampaignId, campaign.id]),
      );
      const adSetMap = new Map(
        entityMap.campaigns.flatMap((campaign) =>
          campaign.adSets.map((adSet) => [adSet.metaAdsetId, adSet.id] as const),
        ),
      );
      const adMap = new Map(
        entityMap.campaigns.flatMap((campaign) => [
          ...campaign.ads.map((ad) => [ad.metaAdId, ad.id] as const),
          ...campaign.adSets.flatMap((adSet) =>
            adSet.ads.map((ad) => [ad.metaAdId, ad.id] as const),
          ),
        ]),
      );

      const campaignInsights = await this.metaAdsClient.listInsights({
        metaAccountId: params.metaAdAccountId,
        credential: params.credential,
        level: 'campaign',
        since,
        until,
      });
      apiCallsUsed += campaignInsights.apiCallsUsed;
      const campaignPersist = await this.persistCampaignInsights(
        campaignInsights.rows,
        campaignMap,
      );
      rowsUpserted += campaignPersist.upserted;

      const adSetInsights = await this.metaAdsClient.listInsights({
        metaAccountId: params.metaAdAccountId,
        credential: params.credential,
        level: 'adset',
        since,
        until,
      });
      apiCallsUsed += adSetInsights.apiCallsUsed;
      const adSetPersist = await this.persistAdSetInsights(
        adSetInsights.rows,
        adSetMap,
      );
      rowsUpserted += adSetPersist.upserted;

      const adInsights = await this.metaAdsClient.listInsights({
        metaAccountId: params.metaAdAccountId,
        credential: params.credential,
        level: 'ad',
        since,
        until,
      });
      apiCallsUsed += adInsights.apiCallsUsed;
      const adPersist = await this.persistAdInsights(adInsights.rows, adMap);
      rowsUpserted += adPersist.upserted;

      const skippedRows =
        campaignPersist.skipped + adSetPersist.skipped + adPersist.skipped;
      const skippedByLevel = {
        campaign: campaignPersist.skipped,
        adSet: adSetPersist.skipped,
        ad: adPersist.skipped,
      };

      await this.repository.updateSyncLog(syncLog.id, {
        adAccountId: adAccount.id,
        metaConnectionId: params.credential.connectionId,
        status: SyncStatus.success,
        rowsUpserted,
        apiCallsUsed,
        startedAt,
        metadataJson: {
          scope: 'insights_daily',
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          since,
          until,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
          skippedRows,
          skippedByLevel,
        } as Prisma.InputJsonValue,
      });

      if (params.credential.connectionId) {
        await this.metaConnectionsService.touchConnectionLastSync(
          params.credential.connectionId,
        );
      }

      await this.systemLogService.log({
        level: 'info',
        module: 'sync',
        eventName: 'insights_sync_success',
        message: 'Sync diario de insights completado',
        metadata: {
          clientId: params.clientId,
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          since,
          until,
          rowsUpserted,
          apiCallsUsed,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
          skippedRows,
          skippedByLevel,
        },
      });

      if (skippedRows > 0) {
        await this.systemLogService.log({
          level: 'warn',
          module: 'sync',
          eventName: 'insights_sync_rows_skipped',
          message: 'Se omitieron filas de insights sin entidad local resoluble',
          metadata: {
            clientId: params.clientId,
            metaAdAccountId: params.metaAdAccountId,
            syncType: params.syncType,
            since,
            until,
            skippedRows,
            skippedByLevel,
            credentialSource: params.credential.source,
            connectionId: params.credential.connectionId,
          },
        });
      }

      return {
        syncLogId: syncLog.id,
        metaAdAccountId: params.metaAdAccountId,
        status: SyncStatus.success,
        rowsUpserted,
        apiCallsUsed,
        since,
        until,
        skippedRows,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido de insights';

      await this.repository.updateSyncLog(syncLog.id, {
        adAccountId: undefined,
        metaConnectionId: params.credential.connectionId,
        status: SyncStatus.failed,
        rowsUpserted,
        apiCallsUsed,
        errorMessage,
        startedAt,
        metadataJson: {
          scope: 'insights_daily',
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
        } as Prisma.InputJsonValue,
      });

      await this.systemLogService.log({
        level: 'error',
        module: 'sync',
        eventName: 'insights_sync_failed',
        message: 'Sync diario de insights fallido',
        metadata: {
          clientId: params.clientId,
          metaAdAccountId: params.metaAdAccountId,
          syncType: params.syncType,
          errorMessage,
          credentialSource: params.credential.source,
          connectionId: params.credential.connectionId,
        },
      });

      throw error;
    } finally {
      this.syncLockService.release(lockKey);
    }
  }

  private async resolveInsightsRange(params: {
    adAccountId: string;
    syncType: SyncType;
    dateFrom?: string;
    dateTo?: string;
  }) {
    if (params.dateFrom && params.dateTo) {
      return {
        since: params.dateFrom,
        until: params.dateTo,
      };
    }

    const today = new Date();
    const until = this.formatDate(today);

    if (params.syncType === SyncType.initial) {
      const sinceDate = new Date(today);
      sinceDate.setDate(sinceDate.getDate() - 30);
      return {
        since: this.formatDate(sinceDate),
        until,
      };
    }

    const latest = await this.insightsRepository.getLatestInsightDatesByAdAccount(
      params.adAccountId,
    );
    const dates = [latest.campaign, latest.adSet, latest.ad].filter(
      (value): value is Date => Boolean(value),
    );

    if (dates.length === 0) {
      const fallback = new Date(today);
      fallback.setDate(fallback.getDate() - 30);
      return {
        since: this.formatDate(fallback),
        until,
      };
    }

    const earliestMaxDate = new Date(
      Math.min(...dates.map((date) => date.getTime())),
    );
    earliestMaxDate.setDate(earliestMaxDate.getDate() + 1);

    return {
      since: this.formatDate(earliestMaxDate),
      until,
    };
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toDecimalString(value?: string) {
    return value && value !== '' ? value : undefined;
  }

  private toInt(value?: string) {
    return value && value !== '' ? Number.parseInt(value, 10) : undefined;
  }

  private pickActionValue(
    rows: Array<{ action_type: string; value: string }> | undefined,
    actionTypes: string[],
  ) {
    const match = rows?.find((row) => actionTypes.includes(row.action_type));
    return match?.value;
  }

  private deriveResult(row: MetaInsightRow) {
    const priorities = [
      {
        resultType: 'lead',
        actionTypes: ['lead', 'omni_lead', 'onsite_conversion.lead_grouped'],
      },
      {
        resultType: 'purchase',
        actionTypes: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'],
      },
      {
        resultType: 'link_click',
        actionTypes: ['link_click'],
      },
    ];

    for (const priority of priorities) {
      const result = this.pickActionValue(row.actions, priority.actionTypes);
      if (result) {
        const cost = this.pickActionValue(
          row.cost_per_action_type,
          priority.actionTypes,
        );
        return {
          results: result,
          resultType: priority.resultType,
          costPerResult: cost,
        };
      }
    }

    return {
      results: undefined,
      resultType: undefined,
      costPerResult: undefined,
    };
  }

  private buildInsightPayload(row: MetaInsightRow) {
    const derived = this.deriveResult(row);

    return {
      date: new Date(row.date_start),
      spend: this.toDecimalString(row.spend),
      impressions: this.toInt(row.impressions),
      reach: this.toInt(row.reach),
      frequency: this.toDecimalString(row.frequency),
      clicks: this.toInt(row.clicks),
      linkClicks: this.toInt(this.pickActionValue(row.actions, ['link_click'])),
      landingPageViews: this.toInt(
        this.pickActionValue(row.actions, ['landing_page_view']),
      ),
      cpm: this.toDecimalString(row.cpm),
      cpc: this.toDecimalString(row.cpc),
      ctr: this.toDecimalString(row.ctr),
      results: this.toDecimalString(derived.results),
      resultType: derived.resultType,
      costPerResult: this.toDecimalString(derived.costPerResult),
      leads: this.toDecimalString(
        this.pickActionValue(row.actions, [
          'lead',
          'omni_lead',
          'onsite_conversion.lead_grouped',
        ]),
      ),
      purchases: this.toDecimalString(
        this.pickActionValue(row.actions, [
          'purchase',
          'omni_purchase',
          'offsite_conversion.fb_pixel_purchase',
        ]),
      ),
      purchaseValue: this.toDecimalString(
        this.pickActionValue(row.action_values, [
          'purchase',
          'omni_purchase',
          'offsite_conversion.fb_pixel_purchase',
        ]),
      ),
      roas: this.toDecimalString(
        this.pickActionValue(row.purchase_roas, [
          'purchase',
          'omni_purchase',
          'offsite_conversion.fb_pixel_purchase',
        ]),
      ),
      actionsJson: row.actions as Prisma.InputJsonValue | undefined,
      actionValuesJson: row.action_values as Prisma.InputJsonValue | undefined,
      videoMetricsJson: {
        video_play_actions: row.video_play_actions,
        video_p25_watched_actions: row.video_p25_watched_actions,
        video_p50_watched_actions: row.video_p50_watched_actions,
        video_p75_watched_actions: row.video_p75_watched_actions,
        video_p100_watched_actions: row.video_p100_watched_actions,
        thruplays: row.thruplays,
      } as Prisma.InputJsonValue,
      rawJson: row as Prisma.InputJsonValue,
    };
  }

  private async persistCampaignInsights(
    rows: MetaInsightRow[],
    campaignMap: Map<string, string>,
  ): Promise<InsightPersistStats> {
    let upserted = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row.campaign_id) {
        skipped += 1;
        continue;
      }
      const campaignId = campaignMap.get(row.campaign_id);
      if (!campaignId) {
        skipped += 1;
        continue;
      }
      await this.insightsRepository.upsertCampaignInsightDaily({
        campaignId,
        ...this.buildInsightPayload(row),
      });
      upserted += 1;
    }
    return { upserted, skipped };
  }

  private async persistAdSetInsights(
    rows: MetaInsightRow[],
    adSetMap: Map<string, string>,
  ): Promise<InsightPersistStats> {
    let upserted = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row.adset_id) {
        skipped += 1;
        continue;
      }
      const adSetId = adSetMap.get(row.adset_id);
      if (!adSetId) {
        skipped += 1;
        continue;
      }
      await this.insightsRepository.upsertAdSetInsightDaily({
        adSetId,
        ...this.buildInsightPayload(row),
      });
      upserted += 1;
    }
    return { upserted, skipped };
  }

  private async persistAdInsights(
    rows: MetaInsightRow[],
    adMap: Map<string, string>,
  ): Promise<InsightPersistStats> {
    let upserted = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row.ad_id) {
        skipped += 1;
        continue;
      }
      const adId = adMap.get(row.ad_id);
      if (!adId) {
        skipped += 1;
        continue;
      }
      await this.insightsRepository.upsertAdInsightDaily({
        adId,
        ...this.buildInsightPayload(row),
      });
      upserted += 1;
    }
    return { upserted, skipped };
  }
}
