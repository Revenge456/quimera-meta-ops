import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { ClientsRepository } from './clients.repository';

describe('ClientsRepository', () => {
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

  const prisma = {
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    clientAssignment: {
      count: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    systemLog: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  let repository: ClientsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ClientsRepository(prisma);
  });

  it('filters client list by assignments for commercial managers', async () => {
    const findMany = prisma.client.findMany as jest.Mock;
    findMany.mockResolvedValue([]);

    await repository.list(manager, {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignments: {
            some: {
              userId: manager.sub,
            },
          },
        }),
      }),
    );
  });

  it('does not restrict client list for admins', async () => {
    const findMany = prisma.client.findMany as jest.Mock;
    findMany.mockResolvedValue([]);

    await repository.list(admin, {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('builds a scoped summary for commercial managers', async () => {
    const transaction = prisma.$transaction as jest.Mock;
    transaction.mockResolvedValue([2, 2, 1]);

    const summary = await repository.summary(manager);

    expect(prisma.client.count).toHaveBeenCalledWith({
      where: {
        assignments: {
          some: {
            userId: manager.sub,
          },
        },
      },
    });
    expect(prisma.clientAssignment.count).toHaveBeenCalledWith({
      where: {
        userId: manager.sub,
      },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        id: manager.sub,
        active: true,
      },
    });
    expect(summary).toEqual({
      clients: 2,
      assignments: 2,
      activeUsers: 1,
      logs: 0,
    });
  });

  it('builds a global summary for admins', async () => {
    const transaction = prisma.$transaction as jest.Mock;
    transaction.mockResolvedValue([12, 24, 4, 18]);

    const summary = await repository.summary(admin);

    expect(prisma.client.count).toHaveBeenCalledWith();
    expect(prisma.clientAssignment.count).toHaveBeenCalledWith();
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { active: true } });
    expect(prisma.systemLog.count).toHaveBeenCalledWith();
    expect(summary).toEqual({
      clients: 12,
      assignments: 24,
      activeUsers: 4,
      logs: 18,
    });
  });
});
