import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MetaConnectionStatus } from '@prisma/client';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { MetaConnectionsService } from './meta-connections.service';

describe('MetaConnectionsService', () => {
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
    assertClientExists: jest.fn(),
    createConnection: jest.fn(),
    listConnections: jest.fn(),
    getConnectionById: jest.fn(),
    getAccessibleConnectionRecord: jest.fn(),
    updateConnectionValidation: jest.fn(),
    attachAdAccountsToConnection: jest.fn(),
    getSyncResolutionClient: jest.fn(),
    updateLastSync: jest.fn(),
  };

  const tokenCryptoService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const metaAdsClient = {
    getConnectionIdentity: jest.fn(),
    listAccessibleAdAccounts: jest.fn(),
    getGlobalFallbackCredential: jest.fn(),
  };

  const systemLogService = {
    log: jest.fn(),
  };

  let service: MetaConnectionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetaConnectionsService(
      repository as never,
      tokenCryptoService as never,
      metaAdsClient as never,
      systemLogService as never,
    );

    repository.assertClientExists.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      empresa: 'Empresa',
    });
    tokenCryptoService.encrypt.mockReturnValue('encrypted-token');
    tokenCryptoService.decrypt.mockReturnValue('decrypted-token');
    repository.createConnection.mockResolvedValue({
      id: 'connection-1',
      provider: 'meta',
      status: MetaConnectionStatus.invalid,
      client: {
        id: 'client-1',
        nombre: 'Cliente',
      },
    });
  });

  it('creates a connection storing only the encrypted token and returning a safe payload', async () => {
    const result = await service.createConnection(admin, {
      clientId: 'client-1',
      accessToken: 'plain-token',
      tokenType: 'bearer',
    });

    expect(tokenCryptoService.encrypt).toHaveBeenCalledWith('plain-token');
    expect(repository.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        accessTokenEncrypted: 'encrypted-token',
        tokenType: 'bearer',
      }),
    );
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('accessTokenEncrypted');
  });

  it('forbids non-admin users from creating credentials', async () => {
    await expect(
      service.createConnection(manager, {
        clientId: 'client-1',
        accessToken: 'plain-token',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks a connection as active after successful validation', async () => {
    repository.getAccessibleConnectionRecord.mockResolvedValue({
      id: 'connection-1',
      metaBusinessId: null,
      metaBusinessName: null,
      accessTokenEncrypted: 'encrypted-token',
      client: {
        id: 'client-1',
      },
      adAccounts: [],
    });
    metaAdsClient.getConnectionIdentity.mockResolvedValue({
      row: { id: 'user-1', name: 'Business User' },
    });
    metaAdsClient.listAccessibleAdAccounts.mockResolvedValue({
      rows: [
        {
          id: 'act_1',
          business: {
            id: 'biz-1',
            name: 'Business One',
          },
        },
      ],
    });
    repository.updateConnectionValidation.mockResolvedValue({
      id: 'connection-1',
      status: MetaConnectionStatus.active,
    });

    const result = await service.validateConnection(admin, 'connection-1');

    expect(metaAdsClient.getConnectionIdentity).toHaveBeenCalledWith({
      accessToken: 'decrypted-token',
      source: 'client_connection',
      connectionId: 'connection-1',
    });
    expect(repository.updateConnectionValidation).toHaveBeenCalledWith(
      'connection-1',
      expect.objectContaining({
        status: MetaConnectionStatus.active,
        metaBusinessId: 'biz-1',
        metaBusinessName: 'Business One',
      }),
    );
    expect(result).toEqual({
      id: 'connection-1',
      status: MetaConnectionStatus.active,
    });
  });

  it('marks a connection as expired when validation reports an expired token', async () => {
    repository.getAccessibleConnectionRecord.mockResolvedValue({
      id: 'connection-1',
      metaBusinessId: null,
      metaBusinessName: null,
      accessTokenEncrypted: 'encrypted-token',
      client: {
        id: 'client-1',
      },
      adAccounts: [],
    });
    metaAdsClient.getConnectionIdentity.mockRejectedValue(
      new Error('Token expired by provider'),
    );
    repository.updateConnectionValidation.mockResolvedValue({
      id: 'connection-1',
      status: MetaConnectionStatus.expired,
    });

    const result = await service.validateConnection(admin, 'connection-1');

    expect(repository.updateConnectionValidation).toHaveBeenCalledWith(
      'connection-1',
      expect.objectContaining({
        status: MetaConnectionStatus.expired,
      }),
    );
    expect(result).toEqual({
      id: 'connection-1',
      status: MetaConnectionStatus.expired,
    });
  });

  it('discovers accessible ad accounts and flags already attached ones', async () => {
    repository.getAccessibleConnectionRecord.mockResolvedValue({
      id: 'connection-1',
      accessTokenEncrypted: 'encrypted-token',
      client: {
        id: 'client-1',
        nombre: 'Cliente',
      },
      adAccounts: [
        {
          id: 'local-1',
          metaAccountId: 'act_1',
          name: 'Attached Account',
        },
      ],
    });
    metaAdsClient.listAccessibleAdAccounts.mockResolvedValue({
      rows: [
        {
          id: 'act_1',
          account_id: '111',
          name: 'Attached Account',
          currency: 'USD',
          timezone_name: 'America/Lima',
          account_status: 1,
          business: { id: 'biz-1', name: 'Biz' },
        },
        {
          id: 'act_2',
          account_id: '222',
          name: 'New Account',
          currency: 'USD',
          timezone_name: 'America/Lima',
          account_status: 1,
        },
      ],
    });

    const result = await service.discoverAdAccounts(admin, 'connection-1');

    expect(result.accounts).toEqual([
      expect.objectContaining({
        metaAccountId: 'act_1',
        attached: true,
      }),
      expect.objectContaining({
        metaAccountId: 'act_2',
        attached: false,
      }),
    ]);
  });

  it('attaches discovered ad accounts to the selected client connection', async () => {
    repository.getAccessibleConnectionRecord.mockResolvedValue({
      id: 'connection-1',
      client: {
        id: 'client-1',
        nombre: 'Cliente',
      },
    });
    repository.attachAdAccountsToConnection.mockResolvedValue({
      id: 'connection-1',
      adAccounts: [
        {
          metaAccountId: 'act_1',
          name: 'Account 1',
        },
      ],
    });

    const result = await service.attachAdAccounts(admin, 'connection-1', {
      accounts: [
        {
          metaAccountId: 'act_1',
          name: 'Account 1',
          currency: 'USD',
          timezone: 'America/Lima',
          status: 'ACTIVE',
          metaBusinessId: 'biz-1',
          metaBusinessName: 'Biz',
        },
      ],
    });

    expect(repository.attachAdAccountsToConnection).toHaveBeenCalledWith({
      clientId: 'client-1',
      connectionId: 'connection-1',
      accounts: [
        expect.objectContaining({
          metaAccountId: 'act_1',
          name: 'Account 1',
          currency: 'USD',
          timezone: 'America/Lima',
          status: 'ACTIVE',
        }),
      ],
    });
    expect(result).toEqual({
      id: 'connection-1',
      adAccounts: [
        {
          metaAccountId: 'act_1',
          name: 'Account 1',
        },
      ],
    });
  });

  it('prefers client-specific active connections over the global fallback', async () => {
    repository.getSyncResolutionClient.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      metaAdAccountIds: ['act_legacy'],
      metaConnections: [
        {
          id: 'connection-1',
          accessTokenEncrypted: 'encrypted-token',
          status: MetaConnectionStatus.active,
          adAccounts: [
            { metaAccountId: 'act_1' },
            { metaAccountId: 'act_2' },
          ],
        },
      ],
    });
    metaAdsClient.getGlobalFallbackCredential.mockReturnValue({
      accessToken: 'fallback-token',
      source: 'global_fallback',
    });

    const result = await service.resolveSyncTargetsForClient('client-1');

    expect(result.targets).toEqual([
      {
        metaAdAccountId: 'act_1',
        credential: {
          accessToken: 'decrypted-token',
          source: 'client_connection',
          connectionId: 'connection-1',
        },
      },
      {
        metaAdAccountId: 'act_2',
        credential: {
          accessToken: 'decrypted-token',
          source: 'client_connection',
          connectionId: 'connection-1',
        },
      },
    ]);
  });

  it('falls back to the global token only when there is no active client connection', async () => {
    repository.getSyncResolutionClient.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      metaAdAccountIds: ['act_legacy_1', 'act_legacy_2'],
      metaConnections: [],
    });
    metaAdsClient.getGlobalFallbackCredential.mockReturnValue({
      accessToken: 'fallback-token',
      source: 'global_fallback',
    });

    const result = await service.resolveSyncTargetsForClient('client-1');

    expect(result.targets).toEqual([
      {
        metaAdAccountId: 'act_legacy_1',
        credential: {
          accessToken: 'fallback-token',
          source: 'global_fallback',
        },
      },
      {
        metaAdAccountId: 'act_legacy_2',
        credential: {
          accessToken: 'fallback-token',
          source: 'global_fallback',
        },
      },
    ]);
  });

  it('fails clearly when only legacy ids exist but no fallback token is configured', async () => {
    repository.getSyncResolutionClient.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      metaAdAccountIds: ['act_legacy_1'],
      metaConnections: [],
    });
    metaAdsClient.getGlobalFallbackCredential.mockReturnValue(null);

    await expect(service.resolveSyncTargetsForClient('client-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails clearly when the client has an active connection without attached accounts', async () => {
    repository.getSyncResolutionClient.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      metaAdAccountIds: [],
      metaConnections: [
        {
          id: 'connection-1',
          accessTokenEncrypted: 'encrypted-token',
          status: MetaConnectionStatus.active,
          adAccounts: [],
        },
      ],
    });

    await expect(service.resolveSyncTargetsForClient('client-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
