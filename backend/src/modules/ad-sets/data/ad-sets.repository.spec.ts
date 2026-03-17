import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdSetsRepository } from './ad-sets.repository';

describe('AdSetsRepository', () => {
  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const prisma = {
    adSet: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    adSetInsightDaily: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: AdSetsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AdSetsRepository(prisma);
  });

  it('filters ad sets by assigned clients for commercial managers', async () => {
    (prisma.adSet.count as jest.Mock).mockResolvedValue(0);
    (prisma.adSet.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.adSetInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {});

    expect(prisma.adSet.findMany).toHaveBeenCalledWith(
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

  it('keeps hierarchical filters combined for ad sets', async () => {
    (prisma.adSet.count as jest.Mock).mockResolvedValue(0);
    (prisma.adSet.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.adSetInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {
      clienteId: 'client-1',
      adAccountId: 'account-1',
      campaignId: 'campaign-1',
      status: 'ACTIVE',
      search: 'broad',
    });

    expect(prisma.adSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'campaign-1',
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

  it('filters detail lookup by assigned clients for commercial managers', async () => {
    (prisma.adSet.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(repository.detail(manager, 'adset-1')).rejects.toThrow(
      'Ad set no encontrado',
    );

    expect(prisma.adSet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'adset-1',
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

  it('keeps client isolation in ad set detail and applies the requested range', async () => {
    (prisma.adSet.findFirst as jest.Mock).mockResolvedValue({
      id: 'adset-1',
      name: 'Ad Set 1',
      campaign: {
        adAccount: {
          client: {
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
        },
      },
      _count: {
        ads: 2,
      },
    });
    (prisma.adSetInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.detail(manager, 'adset-1', {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-11',
    });

    expect(prisma.adSet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'adset-1',
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
    expect(prisma.adSetInsightDaily.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adSetId: 'adset-1',
          date: {
            gte: new Date('2026-03-10'),
            lte: new Date('2026-03-11'),
          },
        }),
      }),
    );
  });

  it('builds the ad set daily chart for the requested entity', async () => {
    (prisma.adSet.findFirst as jest.Mock).mockResolvedValue({
      id: 'adset-1',
      name: 'Ad Set 1',
      campaign: {
        adAccount: {
          client: {
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
        },
      },
      _count: {
        ads: 2,
      },
    });
    (prisma.adSetInsightDaily.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          date: new Date('2026-03-10'),
          spend: '12',
          impressions: 200,
          reach: 150,
          clicks: 8,
          linkClicks: 6,
          landingPageViews: 5,
          results: '2',
          resultType: 'lead',
          leads: '2',
          purchases: '0',
          purchaseValue: '0',
        },
      ]);

    const result = await repository.dailyChart(manager, 'adset-1', {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-10',
    });

    expect(result).toEqual({
      entityId: 'adset-1',
      level: 'ad_sets',
      range: expect.objectContaining({
        dateFrom: '2026-03-10',
        dateTo: '2026-03-10',
      }),
      rows: [
        expect.objectContaining({
          date: '2026-03-10',
          spend: 12,
          clicks: 8,
          resultType: 'lead',
        }),
      ],
    });
  });
});
