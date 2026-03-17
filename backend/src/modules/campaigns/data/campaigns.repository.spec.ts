import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { CampaignsRepository } from './campaigns.repository';

describe('CampaignsRepository', () => {
  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const prisma = {
    campaign: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    campaignInsightDaily: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: CampaignsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CampaignsRepository(prisma);
  });

  it('filters campaigns by assigned clients for commercial managers', async () => {
    (prisma.campaign.count as jest.Mock).mockResolvedValue(0);
    (prisma.campaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.campaignInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {});

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adAccount: {
            client: {
              assignments: {
                some: {
                  userId: manager.sub,
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('keeps client and assignment filters combined for commercial managers', async () => {
    (prisma.campaign.count as jest.Mock).mockResolvedValue(0);
    (prisma.campaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.campaignInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, { clienteId: 'client-1', adAccountId: 'account-1' });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adAccountId: 'account-1',
          adAccount: {
            clienteId: 'client-1',
            client: {
              assignments: {
                some: {
                  userId: manager.sub,
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('aggregates campaign metrics by range and recalculates derived ratios from totals', async () => {
    (prisma.campaign.count as jest.Mock).mockResolvedValue(1);
    (prisma.campaign.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'campaign-1',
        name: 'Campaign 1',
        adAccount: {
          client: {
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
        },
        _count: {
          adSets: 1,
          ads: 2,
        },
      },
    ]);
    (prisma.campaignInsightDaily.findMany as jest.Mock).mockResolvedValue([
      {
        campaignId: 'campaign-1',
        date: new Date('2026-03-10'),
        spend: '100',
        impressions: 1000,
        reach: 800,
        clicks: 20,
        linkClicks: 18,
        landingPageViews: 15,
        results: '4',
        resultType: 'lead',
        leads: '4',
        purchases: '0',
        purchaseValue: '0',
      },
      {
        campaignId: 'campaign-1',
        date: new Date('2026-03-11'),
        spend: '50',
        impressions: 500,
        reach: 300,
        clicks: 5,
        linkClicks: 4,
        landingPageViews: 3,
        results: '2',
        resultType: 'lead',
        leads: '2',
        purchases: '0',
        purchaseValue: '0',
      },
    ]);

    const result = await repository.list(manager, {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-11',
    });

    expect(result.data[0]!.metrics).toEqual(
      expect.objectContaining({
        spend: 150,
        impressions: 1500,
        clicks: 25,
        ctr: 1.6667,
        cpc: 6,
        cpm: 100,
        results: 6,
        resultType: 'lead',
        costPerResult: 25,
      }),
    );
    expect(result.meta).toEqual(
      expect.objectContaining({
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    );
  });

  it('supports metric sorting with pagination metadata', async () => {
    (prisma.campaign.count as jest.Mock).mockResolvedValue(2);
    (prisma.campaign.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 'campaign-1' },
        { id: 'campaign-2' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'campaign-2',
          name: 'Campaign 2',
          adAccount: {
            client: {
              nombre: 'Cliente',
              empresa: 'Empresa',
            },
          },
          _count: {
            adSets: 1,
            ads: 2,
          },
        },
      ]);
    (prisma.campaignInsightDaily.groupBy as jest.Mock).mockResolvedValue([
      {
        campaignId: 'campaign-1',
        _sum: {
          spend: '10',
          impressions: 100,
          clicks: 5,
          results: '1',
          purchases: '0',
          purchaseValue: '0',
        },
      },
      {
        campaignId: 'campaign-2',
        _sum: {
          spend: '50',
          impressions: 100,
          clicks: 20,
          results: '2',
          purchases: '1',
          purchaseValue: '70',
        },
      },
    ]);
    (prisma.campaignInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    const result = await repository.list(manager, {
      sortBy: 'spend',
      sortOrder: 'desc',
      page: 1,
      pageSize: 1,
    });

    expect(prisma.campaignInsightDaily.groupBy).toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('campaign-2');
    expect(result.meta).toEqual(
      expect.objectContaining({
        total: 2,
        page: 1,
        pageSize: 1,
        sortBy: 'spend',
        sortOrder: 'desc',
      }),
    );
  });

  it('keeps client isolation in campaign detail and uses the same range for detail metrics', async () => {
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: 'campaign-1',
      name: 'Campaign 1',
      adAccount: {
        client: {
          nombre: 'Cliente',
          empresa: 'Empresa',
        },
      },
      _count: {
        adSets: 1,
        ads: 2,
      },
    });
    (prisma.campaignInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.detail(manager, 'campaign-1', {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-15',
    });

    expect(prisma.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'campaign-1',
          adAccount: {
            client: {
              assignments: {
                some: {
                  userId: manager.sub,
                },
              },
            },
          },
        }),
      }),
    );
    expect(prisma.campaignInsightDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'campaign-1',
          date: {
            gte: new Date('2026-03-10'),
            lte: new Date('2026-03-15'),
          },
        }),
      }),
    );
  });

  it('builds the campaign daily chart within the requested range', async () => {
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: 'campaign-1',
      name: 'Campaign 1',
      adAccount: {
        client: {
          nombre: 'Cliente',
          empresa: 'Empresa',
        },
      },
      _count: {
        adSets: 1,
        ads: 2,
      },
    });
    (prisma.campaignInsightDaily.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          date: new Date('2026-03-10'),
          spend: '30',
          impressions: 300,
          reach: 200,
          clicks: 12,
          linkClicks: 9,
          landingPageViews: 8,
          results: '2',
          resultType: 'lead',
          leads: '2',
          purchases: '0',
          purchaseValue: '0',
        },
      ]);

    const result = await repository.dailyChart(manager, 'campaign-1', {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-10',
    });

    expect(result).toEqual({
      entityId: 'campaign-1',
      level: 'campaigns',
      range: expect.objectContaining({
        dateFrom: '2026-03-10',
        dateTo: '2026-03-10',
      }),
      rows: [
        expect.objectContaining({
          date: '2026-03-10',
          spend: 30,
          clicks: 12,
          resultType: 'lead',
        }),
      ],
    });
  });
});
