import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClientStatus } from '@prisma/client';

import { SystemLogService } from '../../logging/application/system-log.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { ClientsRepository } from '../data/clients.repository';

@Injectable()
export class ClientsService {
  constructor(
    private readonly repository: ClientsRepository,
    private readonly systemLogService: SystemLogService,
  ) {}

  async list(
    actor: AuthUser,
    filters: { search?: string; estado?: ClientStatus },
  ) {
    return this.repository.list(actor, filters);
  }

  async create(
    actor: AuthUser,
    input: { nombre: string; empresa: string; estado?: ClientStatus },
  ) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }

    const client = await this.repository.create(input);
    await this.systemLogService.log({
      level: 'info',
      module: 'clients',
      eventName: 'client_created',
      message: 'Cliente creado',
      metadata: {
        clientId: client.id,
        actorId: actor.sub,
      },
    });

    return client;
  }

  async detail(actor: AuthUser, clientId: string) {
    return this.repository.findAccessibleById(clientId, actor);
  }

  async assign(actor: AuthUser, clientId: string, userId: string) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }

    const assignment = await this.repository.assignUser(clientId, userId);
    await this.systemLogService.log({
      level: 'info',
      module: 'clients',
      eventName: 'assignment_created',
      message: 'Usuario asignado a cliente',
      metadata: {
        clientId,
        userId,
        actorId: actor.sub,
      },
    });

    return assignment;
  }

  async unassign(actor: AuthUser, clientId: string, userId: string) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }

    await this.repository.unassignUser(clientId, userId);
    await this.systemLogService.log({
      level: 'info',
      module: 'clients',
      eventName: 'assignment_removed',
      message: 'Usuario removido del cliente',
      metadata: {
        clientId,
        userId,
        actorId: actor.sub,
      },
    });

    return { success: true };
  }

  async summary(actor: AuthUser) {
    return this.repository.summary(actor);
  }
}
