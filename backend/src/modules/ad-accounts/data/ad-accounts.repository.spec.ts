import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdAccountsRepository } from './ad-accounts.repository';

describe('AdAccountsRepository', () => {
  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const prisma = {
    adAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: AdAccountsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AdAccountsRepository(prisma);
  });

  it('filters ad accounts by assigned clients for commercial managers', async () => {
    (prisma.adAccount.findMany as jest.Mock).mockResolvedValue([]);

    await repository.list(manager, {});

    expect(prisma.adAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          client: {
            assignments: {
              some: {
                userId: manager.sub,
              },
            },
          },
        }),
      }),
    );
  });
});
