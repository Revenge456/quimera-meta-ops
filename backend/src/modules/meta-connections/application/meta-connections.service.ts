import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MetaConnectionStatus, type Prisma } from '@prisma/client';

import { SystemLogService } from '../../logging/application/system-log.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import {
  MetaAdsClient,
  type MetaAccessCredential,
} from '../../sync/integration/meta-ads.client';
import { MetaConnectionsRepository } from '../data/meta-connections.repository';
import { MetaTokenCryptoService } from '../domain/meta-token-crypto.service';

type MetaConnectionFilters = {
  clientId?: string;
  status?: MetaConnectionStatus;
};

@Injectable()
export class MetaConnectionsService {
  constructor(
    private readonly repository: MetaConnectionsRepository,
    private readonly tokenCryptoService: MetaTokenCryptoService,
    private readonly metaAdsClient: MetaAdsClient,
    private readonly systemLogService: SystemLogService,
  ) {}

  async createConnection(
    actor: AuthUser,
    params: {
      clientId: string;
      accessToken: string;
      tokenType?: string;
      expiresAt?: string;
      metaBusinessId?: string;
      metaBusinessName?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    this.assertAdmin(actor);
    const client = await this.repository.assertClientExists(params.clientId);
    const encryptedToken = this.tokenCryptoService.encrypt(params.accessToken);

    const created = await this.repository.createConnection({
      clientId: client.id,
      connectedByUserId: actor.sub,
      metaBusinessId: params.metaBusinessId,
      metaBusinessName: params.metaBusinessName,
      accessTokenEncrypted: encryptedToken,
      tokenType: params.tokenType,
      expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
      metadataJson: params.metadata,
    });

    await this.systemLogService.log({
      level: 'info',
      module: 'meta-connections',
      eventName: 'connection_created',
      message: 'Conexion Meta creada',
      metadata: {
        connectionId: created.id,
        clientId: client.id,
        connectedByUserId: actor.sub,
      },
    });

    return created;
  }

  listConnections(actor: AuthUser, filters: MetaConnectionFilters) {
    return this.repository.listConnections(actor, filters);
  }

  getConnection(actor: AuthUser, id: string) {
    return this.repository.getConnectionById(actor, id);
  }

  async validateConnection(actor: AuthUser, connectionId: string) {
    this.assertAdmin(actor);
    const connection = await this.repository.getAccessibleConnectionRecord(
      actor,
      connectionId,
    );

    const credential = this.resolveConnectionCredential(connection);
    const validatedAt = new Date();

    try {
      const [identity, adAccounts] = await Promise.all([
        this.metaAdsClient.getConnectionIdentity(credential),
        this.metaAdsClient.listAccessibleAdAccounts(credential),
      ]);

      const firstBusiness = adAccounts.rows.find((row) => row.business?.id);
      const updated = await this.repository.updateConnectionValidation(connection.id, {
        status: MetaConnectionStatus.active,
        metaBusinessId: firstBusiness?.business?.id ?? connection.metaBusinessId ?? null,
        metaBusinessName:
          firstBusiness?.business?.name ?? connection.metaBusinessName ?? null,
        lastValidatedAt: validatedAt,
        metadataJson: {
          identity: identity.row,
          accessibleAdAccounts: adAccounts.rows.length,
        },
      });

      await this.systemLogService.log({
        level: 'info',
        module: 'meta-connections',
        eventName: 'connection_validated',
        message: 'Conexion Meta validada correctamente',
        metadata: {
          connectionId: connection.id,
          clientId: connection.client.id,
          accessibleAdAccounts: adAccounts.rows.length,
        },
      });

      return updated;
    } catch (error) {
      const status = this.classifyConnectionStatus(error);
      const updated = await this.repository.updateConnectionValidation(connection.id, {
        status,
        metaBusinessId: connection.metaBusinessId ?? null,
        metaBusinessName: connection.metaBusinessName ?? null,
        lastValidatedAt: validatedAt,
        metadataJson: {
          validationError:
            error instanceof Error ? error.message : 'Error desconocido de Meta',
        },
      });

      await this.systemLogService.log({
        level: 'warn',
        module: 'meta-connections',
        eventName: 'connection_validation_failed',
        message: 'La conexion Meta no pudo validarse',
        metadata: {
          connectionId: connection.id,
          clientId: connection.client.id,
          status,
          error: error instanceof Error ? error.message : 'unknown',
        },
      });

      return updated;
    }
  }

  async discoverAdAccounts(actor: AuthUser, connectionId: string) {
    this.assertAdmin(actor);
    const connection = await this.repository.getAccessibleConnectionRecord(
      actor,
      connectionId,
    );
    const credential = this.resolveConnectionCredential(connection);
    const discovered = await this.metaAdsClient.listAccessibleAdAccounts(credential);
    const attachedIds = new Set(
      connection.adAccounts.map((account) => account.metaAccountId),
    );

    return {
      connectionId: connection.id,
      client: connection.client,
      accounts: discovered.rows.map((row) => ({
        metaAccountId: row.id,
        accountId: row.account_id,
        name: row.name,
        currency: row.currency,
        timezone: row.timezone_name,
        status: row.account_status != null ? String(row.account_status) : undefined,
        metaBusinessId: row.business?.id,
        metaBusinessName: row.business?.name,
        attached: attachedIds.has(row.id),
      })),
    };
  }

  async attachAdAccounts(
    actor: AuthUser,
    connectionId: string,
    params: {
      accounts: Array<{
        metaAccountId: string;
        name: string;
        currency?: string;
        timezone?: string;
        status?: string;
        metaBusinessId?: string;
        metaBusinessName?: string;
      }>;
    },
  ) {
    this.assertAdmin(actor);
    if (params.accounts.length === 0) {
      throw new BadRequestException('Debes enviar al menos una cuenta publicitaria');
    }

    const connection = await this.repository.getAccessibleConnectionRecord(
      actor,
      connectionId,
    );

    const updated = await this.repository.attachAdAccountsToConnection({
      clientId: connection.client.id,
      connectionId: connection.id,
      accounts: params.accounts.map((account) => ({
        metaAccountId: account.metaAccountId,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone,
        status: account.status,
        rawJson: {
          business: {
            id: account.metaBusinessId,
            name: account.metaBusinessName,
          },
        } as Prisma.InputJsonValue,
      })),
    });

    await this.systemLogService.log({
      level: 'info',
      module: 'meta-connections',
      eventName: 'connection_accounts_attached',
      message: 'Cuentas publicitarias vinculadas a la conexion Meta',
      metadata: {
        connectionId: connection.id,
        clientId: connection.client.id,
        attachedAccounts: params.accounts.map((account) => account.metaAccountId),
      },
    });

    return updated;
  }

  async resolveSyncTargetsForClient(clientId: string) {
    const client = await this.repository.getSyncResolutionClient(clientId);
    const targets: Array<{
      metaAdAccountId: string;
      credential: MetaAccessCredential;
    }> = [];

    for (const connection of client.metaConnections) {
      const credential = {
        accessToken: this.tokenCryptoService.decrypt(connection.accessTokenEncrypted),
        source: 'client_connection' as const,
        connectionId: connection.id,
      };

      for (const account of connection.adAccounts) {
        targets.push({
          metaAdAccountId: account.metaAccountId,
          credential,
        });
      }
    }

    if (targets.length > 0) {
      return {
        clientId: client.id,
        clientName: client.nombre,
        targets: this.dedupeTargets(targets),
      };
    }

    if (client.metaConnections.length > 0) {
      throw new BadRequestException(
        'El cliente tiene conexion Meta activa pero no tiene cuentas publicitarias vinculadas',
      );
    }

    const fallbackCredential = this.metaAdsClient.getGlobalFallbackCredential();
    if (client.metaAdAccountIds.length > 0 && fallbackCredential) {
      return {
        clientId: client.id,
        clientName: client.nombre,
        targets: client.metaAdAccountIds.map((metaAdAccountId) => ({
          metaAdAccountId,
          credential: fallbackCredential,
        })),
      };
    }

    if (client.metaAdAccountIds.length > 0 && !fallbackCredential) {
      throw new ServiceUnavailableException(
        'El cliente no tiene conexion Meta activa y el fallback global no esta configurado',
      );
    }

    throw new BadRequestException(
      'El cliente no tiene conexion Meta activa ni meta_ad_account_ids legacy configurados',
    );
  }

  touchConnectionLastSync(connectionId: string) {
    return this.repository.updateLastSync(connectionId, new Date());
  }

  private resolveConnectionCredential(connection: {
    id: string;
    accessTokenEncrypted: string;
  }) {
    return {
      accessToken: this.tokenCryptoService.decrypt(connection.accessTokenEncrypted),
      source: 'client_connection' as const,
      connectionId: connection.id,
    };
  }

  private classifyConnectionStatus(error: unknown) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : 'unknown error';

    if (message.includes('expired')) {
      return MetaConnectionStatus.expired;
    }

    if (message.includes('revoked')) {
      return MetaConnectionStatus.revoked;
    }

    return MetaConnectionStatus.invalid;
  }

  private dedupeTargets(
    targets: Array<{
      metaAdAccountId: string;
      credential: MetaAccessCredential;
    }>,
  ) {
    const seen = new Set<string>();
    return targets.filter((target) => {
      if (seen.has(target.metaAdAccountId)) {
        return false;
      }

      seen.add(target.metaAdAccountId);
      return true;
    });
  }

  private assertAdmin(actor: AuthUser) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException();
    }
  }
}
