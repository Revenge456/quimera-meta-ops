import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';

@Injectable()
export class AdCreativesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(
    actor: AuthUser,
    filters: {
      clienteId?: string;
      adAccountId?: string;
      campaignId?: string;
      adSetId?: string;
      adId?: string;
      search?: string;
    },
  ) {
    const adAccountWhere = {
      ...(filters.clienteId ? { clienteId: filters.clienteId } : {}),
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
    };

    const campaignWhere = {
      ...(filters.adAccountId ? { adAccountId: filters.adAccountId } : {}),
      ...(Object.keys(adAccountWhere).length > 0 ? { adAccount: adAccountWhere } : {}),
    };

    const adWhere = {
      ...(filters.adSetId ? { adsetId: filters.adSetId } : {}),
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(Object.keys(campaignWhere).length > 0 ? { campaign: campaignWhere } : {}),
    };

    return this.prisma.adCreative.findMany({
      where: {
        ...(filters.adId ? { adId: filters.adId } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { headline: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(Object.keys(adWhere).length > 0 ? { ad: adWhere } : {}),
      },
      include: {
        ad: {
          include: {
            campaign: {
              include: {
                adAccount: {
                  include: {
                    client: {
                      select: {
                        id: true,
                        nombre: true,
                        empresa: true,
                      },
                    },
                  },
                },
              },
            },
            adSet: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(actor: AuthUser, id: string) {
    const adAccountWhere =
      actor.role === 'commercial_manager'
        ? {
            client: {
              assignments: {
                some: {
                  userId: actor.sub,
                },
              },
            },
          }
        : {};

    const campaignWhere =
      Object.keys(adAccountWhere).length > 0 ? { adAccount: adAccountWhere } : {};

    const adWhere = Object.keys(campaignWhere).length > 0 ? { campaign: campaignWhere } : {};

    const creative = await this.prisma.adCreative.findFirst({
      where: {
        id,
        ...(Object.keys(adWhere).length > 0 ? { ad: adWhere } : {}),
      },
      include: {
        ad: {
          include: {
            campaign: {
              include: {
                adAccount: {
                  include: {
                    client: {
                      select: {
                        id: true,
                        nombre: true,
                        empresa: true,
                      },
                    },
                  },
                },
              },
            },
            adSet: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!creative) {
      throw new NotFoundException('Creative no encontrado');
    }

    return creative;
  }
}
