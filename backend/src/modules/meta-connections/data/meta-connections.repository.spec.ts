import { NotFoundException } from '@nestjs/common';
import { MetaConnectionStatus } from '@prisma/client';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { MetaConnectionsRepository } from './meta-connections.repository';

describe('MetaConnectionsRepository', () => {
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
    metaConnection: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  let repository: MetaConnectionsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new MetaConnectionsRepository(prisma as never);
  });

  it('filters connection lists by assigned clients for commercial managers', async () => {
    prisma.metaConnection.findMany.mockResolvedValue([]);

    await repository.listConnections(manager, {
      clientId: 'client-1',
      status: MetaConnectionStatus.active,
    });

    expect(prisma.metaConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          status: MetaConnectionStatus.active,
          client: {
            assignments: {
              some: {
                userId: 'manager-1',
              },
            },
          },
        }),
      }),
    );
  });

  it('does not add assignment filters for admin connection lists', async () => {
    prisma.metaConnection.findMany.mockResolvedValue([]);

    await repository.listConnections(admin, {
      clientId: 'client-1',
      status: MetaConnectionStatus.active,
    });

    expect(prisma.metaConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          client: expect.anything(),
        }),
      }),
    );
  });

  it('rejects detail reads outside of actor scope', async () => {
    prisma.metaConnection.findFirst.mockResolvedValue(null);

    await expect(repository.getConnectionById(manager, 'connection-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.metaConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'connection-1',
          client: {
            assignments: {
              some: {
                userId: 'manager-1',
              },
            },
          },
        }),
      }),
    );
  });
});
