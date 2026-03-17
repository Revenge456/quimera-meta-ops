import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, filters: { search?: string; estado?: ClientStatus }) {
    const where = {
      ...(filters.estado ? { estado: filters.estado } : {}),
      ...(filters.search
        ? {
            OR: [
              { nombre: { contains: filters.search, mode: 'insensitive' as const } },
              { empresa: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(actor.role === 'commercial_manager'
        ? {
            assignments: {
              some: {
                userId: actor.sub,
              },
            },
          }
        : {}),
    };

    return this.prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: { nombre: string; empresa: string; estado?: ClientStatus }) {
    return this.prisma.client.create({
      data,
    });
  }

  async findAccessibleById(clientId: string, actor: AuthUser) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        ...(actor.role === 'commercial_manager'
          ? {
              assignments: {
                some: {
                  userId: actor.sub,
                },
              },
            }
          : {}),
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async assignUser(clienteId: string, userId: string) {
    return this.prisma.clientAssignment.upsert({
      where: {
        userId_clienteId: {
          userId,
          clienteId,
        },
      },
      update: {},
      create: {
        clienteId,
        userId,
      },
    });
  }

  async unassignUser(clienteId: string, userId: string) {
    return this.prisma.clientAssignment.deleteMany({
      where: {
        clienteId,
        userId,
      },
    });
  }

  async summary(actor: AuthUser) {
    if (actor.role === 'admin') {
      const [clients, assignments, activeUsers, logs] =
        await this.prisma.$transaction([
          this.prisma.client.count(),
          this.prisma.clientAssignment.count(),
          this.prisma.user.count({ where: { active: true } }),
          this.prisma.systemLog.count(),
        ]);

      return {
        clients,
        assignments,
        activeUsers,
        logs,
      };
    }

    const [clients, assignments, activeUsers] = await this.prisma.$transaction([
      this.prisma.client.count({
        where: {
          assignments: {
            some: {
              userId: actor.sub,
            },
          },
        },
      }),
      this.prisma.clientAssignment.count({
        where: {
          userId: actor.sub,
        },
      }),
      this.prisma.user.count({
        where: {
          id: actor.sub,
          active: true,
        },
      }),
    ]);

    return {
      clients,
      assignments,
      activeUsers,
      logs: 0,
    };
  }
}
