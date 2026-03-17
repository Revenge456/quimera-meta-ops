import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdsRepository } from './ads.repository';

describe('AdsRepository', () => {
  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const prisma = {
    ad: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    adInsightDaily: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: AdsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AdsRepository(prisma);
  });

  it('filters ads by assigned clients for commercial managers', async () => {
    (prisma.ad.count as jest.Mock).mockResolvedValue(0);
    (prisma.ad.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.adInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {});

    expect(prisma.ad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaign: {
            adAccount: {
              client: {
                assignments: {
                  some: {
                    userId: manager.sub,
                  },
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('keeps ad hierarchy filters consistent', async () => {
    (prisma.ad.count as jest.Mock).mockResolvedValue(0);
    (prisma.ad.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.adInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {
      clienteId: 'client-1',
      adAccountId: 'account-1',
      campaignId: 'campaign-1',
      adSetId: 'adset-1',
      status: 'ACTIVE',
      search: 'video',
    });

    expect(prisma.ad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          effectiveStatus: 'ACTIVE',
          campaign: {
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
          },
        }),
      }),
    );
  });

  it('keeps client isolation in ad detail and applies the requested range', async () => {
    (prisma.ad.findFirst as jest.Mock).mockResolvedValue({
      id: 'ad-1',
      name: 'Ad 1',
      campaign: {
        adAccount: {
          client: {
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
        },
      },
      adSet: {
        id: 'adset-1',
        name: 'Ad Set 1',
      },
      creatives: [],
      _count: {
        creatives: 0,
      },
    });
    (prisma.adInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.detail(manager, 'ad-1', {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-12',
    });

    expect(prisma.ad.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'ad-1',
          campaign: {
            adAccount: {
              client: {
                assignments: {
                  some: {
                    userId: manager.sub,
                  },
                },
              },
            },
          },
        }),
      }),
    );
    expect(prisma.adInsightDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adId: 'ad-1',
          date: {
            gte: new Date('2026-03-10'),
            lte: new Date('2026-03-12'),
          },
        }),
      }),
    );
  });

  it('builds the ad daily chart for the requested entity', async () => {
    (prisma.ad.findFirst as jest.Mock).mockResolvedValue({
      id: 'ad-1',
      name: 'Ad 1',
      campaign: {
        adAccount: {
          client: {
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
        },
      },
      adSet: {
        id: 'adset-1',
        name: 'Ad Set 1',
      },
      creatives: [],
      _count: {
        creatives: 0,
      },
    });
    (prisma.adInsightDaily.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          date: new Date('2026-03-10'),
          spend: '9',
          impressions: 120,
          reach: 110,
          clicks: 5,
          linkClicks: 4,
          landingPageViews: 4,
          results: '1',
          resultType: 'purchase',
          leads: '0',
          purchases: '1',
          purchaseValue: '35',
        },
      ]);

    const result = await repository.dailyChart(manager, 'ad-1', {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-10',
    });

    expect(result).toEqual({
      entityId: 'ad-1',
      level: 'ads',
      range: expect.objectContaining({
        dateFrom: '2026-03-10',
        dateTo: '2026-03-10',
      }),
      rows: [
        expect.objectContaining({
          date: '2026-03-10',
          spend: 9,
          purchases: 1,
          purchaseValue: 35,
          resultType: 'purchase',
        }),
      ],
    });
  });
});
