import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';

@Injectable()
export class AdAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(
    actor: AuthUser,
    filters: { clienteId?: string; status?: string; search?: string },
  ) {
    return this.prisma.adAccount.findMany({
      where: {
        ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? {
              name: {
                contains: filters.search,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(actor.role === 'commercial_manager'
          ? {
              client: {
                assignments: {
                  some: {
                    userId: actor.sub,
                  },
                },
              },
            }
          : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            empresa: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(actor: AuthUser, id: string) {
    const adAccount = await this.prisma.adAccount.findFirst({
      where: {
        id,
        ...(actor.role === 'commercial_manager'
          ? {
              client: {
                assignments: {
                  some: {
                    userId: actor.sub,
                  },
                },
              },
            }
          : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            empresa: true,
          },
        },
      },
    });

    if (!adAccount) {
      throw new NotFoundException('Cuenta publicitaria no encontrada');
    }

    return adAccount;
  }
}
