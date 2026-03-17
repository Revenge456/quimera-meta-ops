import { ForbiddenException } from '@nestjs/common';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
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
    list: jest.fn(),
    create: jest.fn(),
    findAccessibleById: jest.fn(),
    assignUser: jest.fn(),
    unassignUser: jest.fn(),
    summary: jest.fn(),
  };

  const systemLogService = {
    log: jest.fn(),
  };

  let service: ClientsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientsService(
      repository as never,
      systemLogService as never,
    );
  });

  it('forbids client creation for commercial managers', async () => {
    await expect(
      service.create(manager, { nombre: 'Cliente', empresa: 'Empresa' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids assignments for commercial managers', async () => {
    await expect(
      service.assign(manager, 'client-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids unassignments for commercial managers', async () => {
    await expect(
      service.unassign(manager, 'client-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates summary to the repository with actor context', async () => {
    repository.summary.mockResolvedValue({
      clients: 1,
      assignments: 1,
      activeUsers: 1,
      logs: 0,
    });

    const result = await service.summary(admin);

    expect(repository.summary).toHaveBeenCalledWith(admin);
    expect(result).toEqual({
      clients: 1,
      assignments: 1,
      activeUsers: 1,
      logs: 0,
    });
  });
});
