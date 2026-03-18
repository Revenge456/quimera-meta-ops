import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SyncType } from '@prisma/client';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { SyncEngineService } from './sync-engine.service';

describe('SyncEngineService', () => {
  const admin: AuthUser = {
    sub: 'admin-1',
    email: 'admin@quimera.local',
    nombre: 'Admin',
    role: 'admin',
  };

  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const repository = {
    createSyncLog: jest.fn(),
    findAdAccountByMetaId: jest.fn(),
    getLatestSuccessfulSync: jest.fn(),
    getInsightEntityMapByAdAccount: jest.fn(),
    upsertAdAccount: jest.fn(),
    upsertCampaign: jest.fn(),
    upsertAdSet: jest.fn(),
    upsertAd: jest.fn(),
    upsertAdCreative: jest.fn(),
    updateSyncLog: jest.fn(),
    listSyncLogs: jest.fn(),
  };

  const insightsRepository = {
    getLatestInsightDatesByAdAccount: jest.fn(),
    upsertCampaignInsightDaily: jest.fn(),
    upsertAdSetInsightDaily: jest.fn(),
    upsertAdInsightDaily: jest.fn(),
  };

  const metaAdsClient = {
    getAdAccount: jest.fn(),
    listCampaigns: jest.fn(),
    listAdSets: jest.fn(),
    listAds: jest.fn(),
    getCreative: jest.fn(),
    listInsights: jest.fn(),
  };

  const systemLogService = {
    log: jest.fn(),
  };

  const metaConnectionsService = {
    resolveSyncTargetsForClient: jest.fn(),
    touchConnectionLastSync: jest.fn(),
  };

  const syncLockService = {
    acquire: jest.fn(),
    release: jest.fn(),
  };

  let service: SyncEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createSyncLog.mockResolvedValue({ id: 'sync-log-1' });
    repository.findAdAccountByMetaId.mockResolvedValue({
      id: 'account-internal-1',
    });
    repository.getLatestSuccessfulSync.mockResolvedValue({
      completedAt: new Date('2026-03-17T10:00:00.000Z'),
    });
    repository.getInsightEntityMapByAdAccount.mockResolvedValue({
      campaigns: [
        {
          id: 'campaign-internal-1',
          metaCampaignId: 'cmp_1',
          ads: [{ id: 'ad-internal-direct-1', metaAdId: 'ad_direct_1' }],
          adSets: [
            {
              id: 'adset-internal-1',
              metaAdsetId: 'adset_1',
              ads: [{ id: 'ad-internal-1', metaAdId: 'ad_1' }],
            },
          ],
        },
      ],
    });
    repository.upsertAdAccount.mockResolvedValue({ id: 'account-internal-1' });
    repository.upsertCampaign.mockResolvedValue({ id: 'campaign-internal-1' });
    repository.upsertAdSet.mockResolvedValue({ id: 'adset-internal-1' });
    repository.upsertAd.mockResolvedValue({ id: 'ad-internal-1' });
    repository.upsertAdCreative.mockResolvedValue({ id: 'creative-internal-1' });
    insightsRepository.getLatestInsightDatesByAdAccount.mockResolvedValue({
      campaign: null,
      adSet: null,
      ad: null,
    });
    insightsRepository.upsertCampaignInsightDaily.mockResolvedValue({
      id: 'campaign-insight-1',
    });
    insightsRepository.upsertAdSetInsightDaily.mockResolvedValue({
      id: 'adset-insight-1',
    });
    insightsRepository.upsertAdInsightDaily.mockResolvedValue({
      id: 'ad-insight-1',
    });
    syncLockService.acquire.mockReturnValue(true);

    service = new SyncEngineService(
      repository as never,
      insightsRepository as never,
      metaAdsClient as never,
      metaConnectionsService as never,
      systemLogService as never,
      syncLockService as never,
    );

    metaConnectionsService.resolveSyncTargetsForClient.mockResolvedValue({
      clientId: 'client-1',
      clientName: 'Cliente',
      targets: [
        {
          metaAdAccountId: 'act_1',
          credential: {
            accessToken: 'token-1',
            source: 'client_connection',
            connectionId: 'connection-1',
          },
        },
      ],
    });
  });

  it('forbids catalog sync trigger for commercial managers', async () => {
    await expect(
      service.triggerClientSync(manager, 'client-1', SyncType.initial),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids insights sync trigger for commercial managers', async () => {
    await expect(
      service.triggerClientInsightsSync(manager, 'client-1', SyncType.initial),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails when client has no configured meta ad accounts', async () => {
    metaConnectionsService.resolveSyncTargetsForClient.mockRejectedValue(
      new BadRequestException(
        'El cliente no tiene conexion Meta activa ni meta_ad_account_ids legacy configurados',
      ),
    );

    await expect(
      service.triggerClientSync(admin, 'client-1', SyncType.initial),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails when a catalog lock already exists for the account', async () => {
    syncLockService.acquire.mockReturnValue(false);

    await expect(
      service.triggerClientSync(admin, 'client-1', SyncType.initial),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the previous successful sync timestamp for incremental catalog sync', async () => {
    metaAdsClient.getAdAccount.mockResolvedValue({
      apiCallsUsed: 1,
      row: { id: 'act_1', name: 'Account 1' },
    });
    metaAdsClient.listCampaigns.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });
    metaAdsClient.listAds.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientSync(admin, 'client-1', SyncType.incremental);

    expect(repository.findAdAccountByMetaId).toHaveBeenCalledWith('act_1');
    expect(repository.getLatestSuccessfulSync).toHaveBeenCalledWith(
      'client-1',
      'account-internal-1',
    );
    expect(metaAdsClient.listCampaigns).toHaveBeenCalledWith(
      'act_1',
      {
        accessToken: 'token-1',
        source: 'client_connection',
        connectionId: 'connection-1',
      },
      '2026-03-17T10:00:00.000Z',
    );
    expect(metaAdsClient.listAds).toHaveBeenCalledWith(
      'act_1',
      {
        accessToken: 'token-1',
        source: 'client_connection',
        connectionId: 'connection-1',
      },
      '2026-03-17T10:00:00.000Z',
    );
  });

  it('updates sync_log as success with useful counters for catalog sync', async () => {
    metaAdsClient.getAdAccount.mockResolvedValue({
      apiCallsUsed: 1,
      row: { id: 'act_1', name: 'Account 1' },
    });
    metaAdsClient.listCampaigns.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });
    metaAdsClient.listAds.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientSync(admin, 'client-1', SyncType.initial);

    expect(repository.updateSyncLog).toHaveBeenCalledWith(
      'sync-log-1',
      expect.objectContaining({
        adAccountId: 'account-internal-1',
        metaConnectionId: 'connection-1',
        status: 'success',
        rowsUpserted: 1,
        apiCallsUsed: 3,
      }),
    );
    expect(systemLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'sync',
        eventName: 'catalog_sync_success',
      }),
    );
    expect(metaConnectionsService.touchConnectionLastSync).toHaveBeenCalledWith(
      'connection-1',
    );
    expect(syncLockService.release).toHaveBeenCalledWith('client-1:act_1');
  });

  it('updates sync_log as failed and releases the lock on catalog sync errors', async () => {
    metaAdsClient.getAdAccount.mockResolvedValue({
      apiCallsUsed: 1,
      row: { id: 'act_1', name: 'Account 1' },
    });
    metaAdsClient.listCampaigns.mockRejectedValue(new Error('Meta exploded'));

    await expect(
      service.triggerClientSync(admin, 'client-1', SyncType.initial),
    ).rejects.toThrow('Meta exploded');

    expect(repository.updateSyncLog).toHaveBeenCalledWith(
      'sync-log-1',
      expect.objectContaining({
        status: 'failed',
        metaConnectionId: 'connection-1',
        rowsUpserted: 1,
        apiCallsUsed: 1,
        errorMessage: 'Meta exploded',
      }),
    );
    expect(systemLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'sync',
        eventName: 'catalog_sync_failed',
      }),
    );
    expect(syncLockService.release).toHaveBeenCalledWith('client-1:act_1');
  });

  it('uses the requested custom date range for insights sync', async () => {
    metaAdsClient.listInsights.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.incremental,
      '2026-03-01',
      '2026-03-10',
    );

    expect(metaAdsClient.listInsights).toHaveBeenNthCalledWith(1, {
      metaAccountId: 'act_1',
      credential: {
        accessToken: 'token-1',
        source: 'client_connection',
        connectionId: 'connection-1',
      },
      level: 'campaign',
      since: '2026-03-01',
      until: '2026-03-10',
    });
    expect(metaAdsClient.listInsights).toHaveBeenNthCalledWith(2, {
      metaAccountId: 'act_1',
      credential: {
        accessToken: 'token-1',
        source: 'client_connection',
        connectionId: 'connection-1',
      },
      level: 'adset',
      since: '2026-03-01',
      until: '2026-03-10',
    });
    expect(metaAdsClient.listInsights).toHaveBeenNthCalledWith(3, {
      metaAccountId: 'act_1',
      credential: {
        accessToken: 'token-1',
        source: 'client_connection',
        connectionId: 'connection-1',
      },
      level: 'ad',
      since: '2026-03-01',
      until: '2026-03-10',
    });
  });

  it('uses the earliest latest entity date plus one day for incremental insights', async () => {
    insightsRepository.getLatestInsightDatesByAdAccount.mockResolvedValue({
      campaign: new Date('2026-03-15T00:00:00.000Z'),
      adSet: new Date('2026-03-13T00:00:00.000Z'),
      ad: new Date('2026-03-14T00:00:00.000Z'),
    });
    metaAdsClient.listInsights.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.incremental,
    );

    expect(insightsRepository.getLatestInsightDatesByAdAccount).toHaveBeenCalledWith(
      'account-internal-1',
    );
    expect(metaAdsClient.listInsights).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        since: '2026-03-14',
      }),
    );
  });

  it('does not re-sync the latest stored border date for incremental insights', async () => {
    insightsRepository.getLatestInsightDatesByAdAccount.mockResolvedValue({
      campaign: new Date('2026-03-16T00:00:00.000Z'),
      adSet: new Date('2026-03-16T00:00:00.000Z'),
      ad: new Date('2026-03-16T00:00:00.000Z'),
    });
    metaAdsClient.listInsights.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.incremental,
    );

    expect(metaAdsClient.listInsights).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        since: '2026-03-17',
      }),
    );
  });

  it('falls back to a rolling window when no insights history exists', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

    insightsRepository.getLatestInsightDatesByAdAccount.mockResolvedValue({
      campaign: null,
      adSet: null,
      ad: null,
    });
    metaAdsClient.listInsights.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.incremental,
    );

    expect(metaAdsClient.listInsights).toHaveBeenNthCalledWith(1, {
      metaAccountId: 'act_1',
      credential: {
        accessToken: 'token-1',
        source: 'client_connection',
        connectionId: 'connection-1',
      },
      level: 'campaign',
      since: '2026-02-15',
      until: '2026-03-17',
    });

    jest.useRealTimers();
  });

  it('persists daily insights idempotently and logs success', async () => {
    metaAdsClient.listInsights
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            campaign_id: 'cmp_1',
            date_start: '2026-03-16',
            spend: '25.50',
            impressions: '1000',
            reach: '800',
            frequency: '1.25',
            clicks: '50',
            cpm: '25.5',
            cpc: '0.51',
            ctr: '5.0',
            actions: [
              { action_type: 'link_click', value: '45' },
              { action_type: 'lead', value: '10' },
              { action_type: 'landing_page_view', value: '30' },
            ],
            action_values: [{ action_type: 'purchase', value: '0' }],
            cost_per_action_type: [{ action_type: 'lead', value: '2.55' }],
            purchase_roas: [{ action_type: 'purchase', value: '0' }],
            thruplays: [{ action_type: 'video_view', value: '12' }],
          },
        ],
      })
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            adset_id: 'adset_1',
            date_start: '2026-03-16',
            spend: '15.00',
          },
        ],
      })
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            ad_id: 'ad_1',
            date_start: '2026-03-16',
            spend: '5.25',
          },
        ],
      });

    const result = await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.initial,
      '2026-03-16',
      '2026-03-16',
    );

    expect(insightsRepository.upsertCampaignInsightDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-internal-1',
        date: new Date('2026-03-16'),
        spend: '25.50',
        impressions: 1000,
        linkClicks: 45,
        landingPageViews: 30,
        results: '10',
        resultType: 'lead',
        costPerResult: '2.55',
        leads: '10',
        rawJson: expect.any(Object),
      }),
    );
    expect(insightsRepository.upsertAdSetInsightDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        adSetId: 'adset-internal-1',
      }),
    );
    expect(insightsRepository.upsertAdInsightDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        adId: 'ad-internal-1',
      }),
    );
    expect(repository.updateSyncLog).toHaveBeenCalledWith(
      'sync-log-1',
      expect.objectContaining({
        adAccountId: 'account-internal-1',
        metaConnectionId: 'connection-1',
        status: 'success',
        rowsUpserted: 3,
        apiCallsUsed: 3,
        metadataJson: expect.objectContaining({
          scope: 'insights_daily',
          since: '2026-03-16',
          until: '2026-03-16',
          credentialSource: 'client_connection',
          connectionId: 'connection-1',
        }),
      }),
    );
    expect(systemLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'insights_sync_success',
      }),
    );
    expect(syncLockService.release).toHaveBeenCalledWith('insights:client-1:act_1');
    expect(metaConnectionsService.touchConnectionLastSync).toHaveBeenCalledWith(
      'connection-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        clientId: 'client-1',
        syncType: 'initial',
      }),
    );
  });

  it('derives purchase as result type when no lead action exists', async () => {
    metaAdsClient.listInsights
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            campaign_id: 'cmp_1',
            date_start: '2026-03-16',
            actions: [{ action_type: 'purchase', value: '3' }],
            cost_per_action_type: [{ action_type: 'purchase', value: '7.20' }],
          },
        ],
      })
      .mockResolvedValueOnce({ apiCallsUsed: 1, rows: [] })
      .mockResolvedValueOnce({ apiCallsUsed: 1, rows: [] });

    await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.initial,
      '2026-03-16',
      '2026-03-16',
    );

    expect(insightsRepository.upsertCampaignInsightDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        results: '3',
        resultType: 'purchase',
        costPerResult: '7.20',
        purchases: '3',
      }),
    );
  });

  it('derives link_click as fallback result type when no lead or purchase exists', async () => {
    metaAdsClient.listInsights
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            campaign_id: 'cmp_1',
            date_start: '2026-03-16',
            actions: [{ action_type: 'link_click', value: '11' }],
            cost_per_action_type: [{ action_type: 'link_click', value: '1.15' }],
          },
        ],
      })
      .mockResolvedValueOnce({ apiCallsUsed: 1, rows: [] })
      .mockResolvedValueOnce({ apiCallsUsed: 1, rows: [] });

    await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.initial,
      '2026-03-16',
      '2026-03-16',
    );

    expect(insightsRepository.upsertCampaignInsightDaily).toHaveBeenCalledWith(
      expect.objectContaining({
        results: '11',
        resultType: 'link_click',
        costPerResult: '1.15',
        linkClicks: 11,
      }),
    );
  });

  it('logs skipped insight rows when local entities are missing', async () => {
    metaAdsClient.listInsights
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            campaign_id: 'cmp_missing',
            date_start: '2026-03-16',
            spend: '10.00',
          },
        ],
      })
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            adset_id: 'adset_missing',
            date_start: '2026-03-16',
            spend: '8.00',
          },
        ],
      })
      .mockResolvedValueOnce({
        apiCallsUsed: 1,
        rows: [
          {
            ad_id: 'ad_missing',
            date_start: '2026-03-16',
            spend: '3.00',
          },
        ],
      });

    const result = await service.triggerClientInsightsSync(
      admin,
      'client-1',
      SyncType.initial,
      '2026-03-16',
      '2026-03-16',
    );

    expect(insightsRepository.upsertCampaignInsightDaily).not.toHaveBeenCalled();
    expect(insightsRepository.upsertAdSetInsightDaily).not.toHaveBeenCalled();
    expect(insightsRepository.upsertAdInsightDaily).not.toHaveBeenCalled();
    expect(repository.updateSyncLog).toHaveBeenCalledWith(
      'sync-log-1',
      expect.objectContaining({
        status: 'success',
        rowsUpserted: 0,
        metadataJson: expect.objectContaining({
          skippedRows: 3,
          skippedByLevel: {
            campaign: 1,
            adSet: 1,
            ad: 1,
          },
        }),
      }),
    );
    expect(systemLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'insights_sync_rows_skipped',
        level: 'warn',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accounts: [
          expect.objectContaining({
            skippedRows: 3,
          }),
        ],
      }),
    );
  });

  it('marks insights sync as failed and releases the lock on errors', async () => {
    metaAdsClient.listInsights.mockRejectedValue(new Error('Insights exploded'));

    await expect(
      service.triggerClientInsightsSync(
        admin,
        'client-1',
        SyncType.initial,
        '2026-03-01',
        '2026-03-02',
      ),
    ).rejects.toThrow('Insights exploded');

    expect(repository.updateSyncLog).toHaveBeenCalledWith(
      'sync-log-1',
      expect.objectContaining({
        status: 'failed',
        metaConnectionId: 'connection-1',
        rowsUpserted: 0,
        apiCallsUsed: 0,
        errorMessage: 'Insights exploded',
        metadataJson: expect.objectContaining({
          scope: 'insights_daily',
        }),
      }),
    );
    expect(systemLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'insights_sync_failed',
      }),
    );
    expect(syncLockService.release).toHaveBeenCalledWith('insights:client-1:act_1');
  });

  it('supports legacy global fallback credentials when resolving sync targets', async () => {
    metaConnectionsService.resolveSyncTargetsForClient.mockResolvedValue({
      clientId: 'client-1',
      clientName: 'Cliente',
      targets: [
        {
          metaAdAccountId: 'act_legacy',
          credential: {
            accessToken: 'fallback-token',
            source: 'global_fallback',
          },
        },
      ],
    });
    metaAdsClient.getAdAccount.mockResolvedValue({
      apiCallsUsed: 1,
      row: { id: 'act_legacy', name: 'Legacy Account' },
    });
    metaAdsClient.listCampaigns.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });
    metaAdsClient.listAds.mockResolvedValue({
      apiCallsUsed: 1,
      rows: [],
    });

    await service.triggerClientSync(admin, 'client-1', SyncType.initial);

    expect(metaAdsClient.getAdAccount).toHaveBeenCalledWith('act_legacy', {
      accessToken: 'fallback-token',
      source: 'global_fallback',
    });
    expect(repository.updateSyncLog).toHaveBeenCalledWith(
      'sync-log-1',
      expect.objectContaining({
        metaConnectionId: undefined,
        metadataJson: expect.objectContaining({
          credentialSource: 'global_fallback',
          connectionId: undefined,
        }),
      }),
    );
    expect(metaConnectionsService.touchConnectionLastSync).not.toHaveBeenCalled();
  });
});
