import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdCreativesRepository } from './ad-creatives.repository';

describe('AdCreativesRepository', () => {
  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const prisma = {
    adCreative: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: AdCreativesRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AdCreativesRepository(prisma);
  });

  it('filters creatives by assigned clients for commercial managers', async () => {
    (prisma.adCreative.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {});

    expect(prisma.adCreative.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ad: {
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
          },
        }),
      }),
    );
  });

  it('keeps hierarchical filters combined for creatives', async () => {
    (prisma.adCreative.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {
      clienteId: 'client-1',
      adAccountId: 'account-1',
      campaignId: 'campaign-1',
      adSetId: 'adset-1',
      adId: 'ad-1',
      search: 'video',
    });

    expect(prisma.adCreative.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adId: 'ad-1',
          ad: {
            adsetId: 'adset-1',
            campaignId: 'campaign-1',
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
          },
        }),
      }),
    );
  });

  it('filters creative detail lookup by assigned clients for commercial managers', async () => {
    (prisma.adCreative.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(repository.detail(manager, 'creative-1')).rejects.toThrow(
      'Creative no encontrado',
    );

    expect(prisma.adCreative.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'creative-1',
          ad: {
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
          },
        }),
      }),
    );
  });
});
