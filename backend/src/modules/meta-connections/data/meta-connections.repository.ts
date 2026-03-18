import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MetaConnectionProvider,
  MetaConnectionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';

const safeConnectionSelect = {
  id: true,
  provider: true,
  metaBusinessId: true,
  metaBusinessName: true,
  tokenType: true,
  expiresAt: true,
  status: true,
  connectedByUserId: true,
  lastValidatedAt: true,
  lastSyncAt: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      nombre: true,
      empresa: true,
    },
  },
  connectedBy: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
  adAccounts: {
    select: {
      id: true,
      metaAccountId: true,
      name: true,
      currency: true,
      timezone: true,
      status: true,
      updatedAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  },
} satisfies Prisma.MetaConnectionSelect;

@Injectable()
export class MetaConnectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertClientExists(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        nombre: true,
        empresa: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async createConnection(params: {
    clientId: string;
    connectedByUserId?: string;
    metaBusinessId?: string;
    metaBusinessName?: string;
    accessTokenEncrypted: string;
    tokenType?: string;
    expiresAt?: Date;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    return this.prisma.metaConnection.create({
      data: {
        clientId: params.clientId,
        provider: MetaConnectionProvider.meta,
        metaBusinessId: params.metaBusinessId,
        metaBusinessName: params.metaBusinessName,
        accessTokenEncrypted: params.accessTokenEncrypted,
        tokenType: params.tokenType,
        expiresAt: params.expiresAt,
        status: MetaConnectionStatus.invalid,
        connectedByUserId: params.connectedByUserId,
        metadataJson: params.metadataJson,
      },
      select: safeConnectionSelect,
    });
  }

  listConnections(
    actor: AuthUser,
    filters: {
      clientId?: string;
      status?: MetaConnectionStatus;
      provider?: MetaConnectionProvider;
    },
  ) {
    return this.prisma.metaConnection.findMany({
      where: this.buildAccessWhere(actor, filters),
      select: safeConnectionSelect,
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async getConnectionById(actor: AuthUser, id: string) {
    const connection = await this.prisma.metaConnection.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(actor, {}),
      },
      select: safeConnectionSelect,
    });

    if (!connection) {
      throw new NotFoundException('Conexion Meta no encontrada');
    }

    return connection;
  }

  async getConnectionRecordById(id: string) {
    const connection = await this.prisma.metaConnection.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            empresa: true,
            metaAdAccountIds: true,
          },
        },
        adAccounts: {
          select: {
            id: true,
            metaAccountId: true,
            name: true,
          },
        },
      },
    });

    if (!connection) {
      throw new NotFoundException('Conexion Meta no encontrada');
    }

    return connection;
  }

  async getAccessibleConnectionRecord(actor: AuthUser, id: string) {
    const connection = await this.prisma.metaConnection.findFirst({
      where: {
        id,
        ...this.buildAccessWhere(actor, {}),
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            empresa: true,
            metaAdAccountIds: true,
          },
        },
        adAccounts: {
          select: {
            id: true,
            metaAccountId: true,
            name: true,
            currency: true,
            timezone: true,
            status: true,
          },
        },
      },
    });

    if (!connection) {
      throw new NotFoundException('Conexion Meta no encontrada');
    }

    return connection;
  }

  updateConnectionValidation(
    connectionId: string,
    params: {
      status: MetaConnectionStatus;
      metaBusinessId?: string | null;
      metaBusinessName?: string | null;
      metadataJson?: Prisma.InputJsonValue;
      lastValidatedAt: Date;
    },
  ) {
    return this.prisma.metaConnection.update({
      where: { id: connectionId },
      data: {
        status: params.status,
        metaBusinessId: params.metaBusinessId,
        metaBusinessName: params.metaBusinessName,
        metadataJson: params.metadataJson,
        lastValidatedAt: params.lastValidatedAt,
      },
      select: safeConnectionSelect,
    });
  }

  updateLastSync(connectionId: string, at: Date) {
    return this.prisma.metaConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: at,
      },
    });
  }

  async attachAdAccountsToConnection(params: {
    clientId: string;
    connectionId: string;
    accounts: Array<{
      metaAccountId: string;
      name: string;
      currency?: string;
      timezone?: string;
      status?: string;
      rawJson?: Prisma.InputJsonValue;
    }>;
  }) {
    const metaAccountIds = params.accounts.map((account) => account.metaAccountId);

    const existing = metaAccountIds.length
      ? await this.prisma.adAccount.findMany({
          where: {
            metaAccountId: {
              in: metaAccountIds,
            },
          },
          select: {
            id: true,
            clienteId: true,
            metaAccountId: true,
          },
        })
      : [];

    for (const account of existing) {
      if (account.clienteId !== params.clientId) {
        throw new BadRequestException(
          `La cuenta ${account.metaAccountId} ya pertenece a otro cliente`,
        );
      }
    }

    for (const account of params.accounts) {
      await this.prisma.adAccount.upsert({
        where: { metaAccountId: account.metaAccountId },
        update: {
          clienteId: params.clientId,
          metaConnectionId: params.connectionId,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone,
          status: account.status,
          rawJson: account.rawJson,
        },
        create: {
          clienteId: params.clientId,
          metaConnectionId: params.connectionId,
          metaAccountId: account.metaAccountId,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone,
          status: account.status,
          rawJson: account.rawJson,
        },
      });
    }

    const allClientAccounts = await this.prisma.adAccount.findMany({
      where: {
        clienteId: params.clientId,
      },
      select: {
        metaAccountId: true,
      },
      orderBy: {
        metaAccountId: 'asc',
      },
    });

    await this.prisma.client.update({
      where: { id: params.clientId },
      data: {
        metaAdAccountIds: allClientAccounts.map((account) => account.metaAccountId),
      },
    });

    return this.prisma.metaConnection.findUniqueOrThrow({
      where: { id: params.connectionId },
      select: safeConnectionSelect,
    });
  }

  async getSyncResolutionClient(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        nombre: true,
        metaAdAccountIds: true,
        metaConnections: {
          where: {
            provider: MetaConnectionProvider.meta,
            status: MetaConnectionStatus.active,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          select: {
            id: true,
            accessTokenEncrypted: true,
            status: true,
            adAccounts: {
              select: {
                metaAccountId: true,
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

  private buildAccessWhere(
    actor: AuthUser,
    filters: {
      clientId?: string;
      status?: MetaConnectionStatus;
      provider?: MetaConnectionProvider;
    },
  ): Prisma.MetaConnectionWhereInput {
    const where: Prisma.MetaConnectionWhereInput = {
      clientId: filters.clientId,
      status: filters.status,
      provider: filters.provider,
    };

    if (actor.role === 'admin') {
      return where;
    }

    return {
      ...where,
      client: {
        assignments: {
          some: {
            userId: actor.sub,
          },
        },
      },
    };
  }
}
