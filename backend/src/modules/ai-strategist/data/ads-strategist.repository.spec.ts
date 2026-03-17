import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { buildAnalysisContextHash } from '../../shared/utils/analysis-context';
import { AdsStrategistRepository } from './ads-strategist.repository';
import { NotFoundException } from '@nestjs/common';

describe('AdsStrategistRepository', () => {
  const manager: AuthUser = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager',
  };

  const prisma = {
    client: {
      findFirst: jest.fn(),
    },
    aiStrategistAnalysis: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    campaign: {
      findMany: jest.fn(),
    },
    campaignInsightDaily: {
      findMany: jest.fn(),
    },
    adSet: {
      findMany: jest.fn(),
    },
    adSetInsightDaily: {
      findMany: jest.fn(),
    },
    ad: {
      findMany: jest.fn(),
    },
    adInsightDaily: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: AdsStrategistRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AdsStrategistRepository(prisma);
  });

  it('enforces client assignment scope when resolving an accessible client', async () => {
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      empresa: 'Empresa',
    });

    await repository.findAccessibleClient(manager, 'client-1');

    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'client-1',
          assignments: {
            some: {
              userId: manager.sub,
            },
          },
        },
      }),
    );
  });

  it('keeps hierarchical and client filters combined for campaign analysis', async () => {
    (prisma.campaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.campaignInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.listEntities({
      actor: manager,
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        adAccountId: 'account-1',
        status: 'ACTIVE',
        search: 'prospecting',
      },
    });

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          effectiveStatus: 'ACTIVE',
          adAccount: {
            id: 'account-1',
            clienteId: 'client-1',
            client: {
              assignments: {
                some: {
                  userId: manager.sub,
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('persists a context hash consistent with the normalized context payload', async () => {
    (prisma.aiStrategistAnalysis.create as jest.Mock).mockResolvedValue({
      id: 'analysis-1',
    });

    await repository.createAnalysisHistory({
      actor: manager,
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        status: 'ACTIVE',
        search: ' prospecting ',
      },
      context: null,
      output: {
        executive_summary: 'Resumen',
        key_findings: [],
        entity_analysis: [],
        global_recommendations: [],
        risks_detected: [],
        next_tests: [],
        client_summary: 'Cliente',
      },
    });

    expect(prisma.aiStrategistAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contextHash: buildAnalysisContextHash({
            clientId: 'client-1',
            level: 'campaign',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-10',
            filters: {
              status: 'ACTIVE',
              search: 'prospecting',
            },
          }),
          contextNormalizedJson: {
            clientId: 'client-1',
            level: 'campaign',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-10',
            filters: {
              status: 'ACTIVE',
              search: 'prospecting',
              campaignId: undefined,
              adSetId: undefined,
              adAccountId: undefined,
            },
          },
        }),
      }),
    );
  });

  it('keeps ad hierarchy and client isolation combined for ad analysis', async () => {
    (prisma.ad.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.adInsightDaily.findMany as jest.Mock).mockResolvedValue([]);

    await repository.listEntities({
      actor: manager,
      clientId: 'client-1',
      level: 'ad',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        adAccountId: 'account-1',
        campaignId: 'campaign-1',
        adSetId: 'adset-1',
        status: 'ACTIVE',
      },
    });

    expect(prisma.ad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          effectiveStatus: 'ACTIVE',
          campaign: {
            adAccountId: 'account-1',
            adAccount: {
              clienteId: 'client-1',
              client: {
                assignments: {
                  some: {
                    userId: manager.sub,
                  },
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('keeps client isolation when listing strategist history for commercial managers', async () => {
    (prisma.aiStrategistAnalysis.count as jest.Mock).mockResolvedValue(0);
    (prisma.aiStrategistAnalysis.findMany as jest.Mock).mockResolvedValue([]);

    await repository.listHistory(manager, {
      clientId: 'client-1',
    });

    expect(prisma.aiStrategistAnalysis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          client: {
            assignments: {
              some: {
                userId: manager.sub,
              },
            },
          },
        }),
      }),
    );
  });

  it('returns paginated strategist history meta consistently', async () => {
    (prisma.aiStrategistAnalysis.count as jest.Mock).mockResolvedValue(3);
    (prisma.aiStrategistAnalysis.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'analysis-1',
        level: 'campaign',
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-10'),
        generatedAt: new Date('2026-03-11T10:00:00.000Z'),
        filtersJson: {},
        contextHash: 'hash-1',
        contextNormalizedJson: {
          clientId: 'client-1',
          level: 'campaign',
          dateFrom: '2026-03-01',
          dateTo: '2026-03-10',
          filters: {},
        },
        outputJson: {
          executive_summary: 'Resumen',
          key_findings: [],
          entity_analysis: [{ entity_id: 'c1' }],
          global_recommendations: [],
          risks_detected: [],
          next_tests: [],
          client_summary: 'Cliente',
        },
        client: {
          id: 'client-1',
          nombre: 'Cliente',
          empresa: 'Empresa',
        },
        generatedBy: null,
      },
    ]);

    const result = await repository.listHistory(manager, {
      clientId: 'client-1',
      page: '2',
      pageSize: '1',
    });

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(result.data[0]?.context_hash).toBe('hash-1');
  });

  it('prioritizes exact strategist matches when contextHash is provided', async () => {
    (prisma.aiStrategistAnalysis.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    (prisma.aiStrategistAnalysis.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'analysis-exact',
          level: 'campaign',
          dateFrom: new Date('2026-03-01'),
          dateTo: new Date('2026-03-10'),
          generatedAt: new Date('2026-03-12T10:00:00.000Z'),
          filtersJson: {},
          contextHash: 'hash-exact',
          contextNormalizedJson: {
            clientId: 'client-1',
            level: 'campaign',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-10',
            filters: {},
          },
          outputJson: {
            executive_summary: 'Exacto',
            key_findings: [],
            entity_analysis: [],
            global_recommendations: [],
            risks_detected: [],
            next_tests: [],
            client_summary: 'Cliente',
          },
          client: {
            id: 'client-1',
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
          generatedBy: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'analysis-similar',
          level: 'campaign',
          dateFrom: new Date('2026-03-01'),
          dateTo: new Date('2026-03-10'),
          generatedAt: new Date('2026-03-11T10:00:00.000Z'),
          filtersJson: {
            status: 'ACTIVE',
          },
          contextHash: 'hash-similar',
          contextNormalizedJson: {
            clientId: 'client-1',
            level: 'campaign',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-10',
            filters: {
              status: 'ACTIVE',
            },
          },
          outputJson: {
            executive_summary: 'Similar',
            key_findings: [],
            entity_analysis: [],
            global_recommendations: [],
            risks_detected: [],
            next_tests: [],
            client_summary: 'Cliente',
          },
          client: {
            id: 'client-1',
            nombre: 'Cliente',
            empresa: 'Empresa',
          },
          generatedBy: null,
        },
      ]);

    const result = await repository.listHistory(manager, {
      clientId: 'client-1',
      contextHash: 'hash-exact',
      page: '1',
      pageSize: '2',
    });

    expect(result.data[0]?.id).toBe('analysis-exact');
    expect(result.data[0]?.exact_context_match).toBe(true);
    expect(result.data[1]?.id).toBe('analysis-similar');
    expect(result.data[1]?.exact_context_match).toBe(false);
  });

  it('keeps client isolation when reading strategist history detail', async () => {
    (prisma.aiStrategistAnalysis.findFirst as jest.Mock).mockResolvedValue({
      id: 'analysis-1',
      level: 'campaign',
      dateFrom: new Date('2026-03-01'),
      dateTo: new Date('2026-03-10'),
      generatedAt: new Date('2026-03-11T10:00:00.000Z'),
      filtersJson: {},
      outputJson: {
        executive_summary: 'Resumen',
        key_findings: [],
        entity_analysis: [],
        global_recommendations: [],
        risks_detected: [],
        next_tests: [],
        client_summary: 'Cliente',
      },
      contextJson: null,
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      generatedBy: null,
    });

    await repository.getHistoryById(manager, 'analysis-1');

    expect(prisma.aiStrategistAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'analysis-1',
          client: {
            assignments: {
              some: {
                userId: manager.sub,
              },
            },
          },
        }),
      }),
    );
  });

  it('finds the latest exact strategist analysis by context hash', async () => {
    (prisma.aiStrategistAnalysis.findFirst as jest.Mock).mockResolvedValue({
      id: 'analysis-exact',
      level: 'campaign',
      dateFrom: new Date('2026-03-01'),
      dateTo: new Date('2026-03-10'),
      generatedAt: new Date('2026-03-12T10:00:00.000Z'),
      filtersJson: {
        status: 'ACTIVE',
      },
      contextHash: 'hash-exact',
      contextNormalizedJson: {
        clientId: 'client-1',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-10',
        filters: {
          status: 'ACTIVE',
        },
      },
      outputJson: {
        executive_summary: 'Exacto',
        key_findings: [],
        entity_analysis: [],
        global_recommendations: [],
        risks_detected: [],
        next_tests: [],
        client_summary: 'Cliente',
      },
      contextJson: null,
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      generatedBy: null,
    });

    const result = await repository.getLatestHistoryByContextHash(manager, {
      clientId: 'client-1',
      contextHash: 'hash-exact',
    });

    expect(result.context_hash).toBe('hash-exact');
    expect(result.exact_context_match).toBe(true);
  });

  it('rejects strategist history detail outside actor scope', async () => {
    (prisma.aiStrategistAnalysis.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(repository.getHistoryById(manager, 'analysis-out')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.aiStrategistAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'analysis-out',
          client: {
            assignments: {
              some: {
                userId: manager.sub,
              },
            },
          },
        }),
      }),
    );
  });
});
