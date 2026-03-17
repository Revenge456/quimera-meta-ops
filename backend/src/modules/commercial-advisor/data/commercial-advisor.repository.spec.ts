import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { CommercialAdvisorRepository } from './commercial-advisor.repository';
import { NotFoundException } from '@nestjs/common';

describe('CommercialAdvisorRepository', () => {
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
    commercialAdvisorAnalysis: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  let repository: CommercialAdvisorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CommercialAdvisorRepository(prisma);
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

  it('keeps client isolation when listing advisory history for commercial managers', async () => {
    (prisma.commercialAdvisorAnalysis.count as jest.Mock).mockResolvedValue(0);
    (prisma.commercialAdvisorAnalysis.findMany as jest.Mock).mockResolvedValue([]);

    await repository.listHistory(manager, {
      clientId: 'client-1',
    });

    expect(prisma.commercialAdvisorAnalysis.findMany).toHaveBeenCalledWith(
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

  it('returns paginated advisory history meta consistently', async () => {
    (prisma.commercialAdvisorAnalysis.count as jest.Mock).mockResolvedValue(4);
    (prisma.commercialAdvisorAnalysis.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'advisor-1',
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
        strategistAnalysisId: 'analysis-1',
        outputJson: {
          executive_summary: 'Resumen comercial',
          performance_explanation: 'Explicacion',
          decision_justifications: [],
          objection_handling: {
            performance: 'Performance',
            budget: 'Budget',
          },
          additional_commercial_opportunity: 'Oportunidad',
          next_phase_recommendation: 'Siguiente fase',
          agency_positioning_narrative: 'Narrativa',
          client_talking_points: [],
          client_ready_summary: 'Resumen cliente',
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
      pageSize: '2',
    });

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(result.data[0]?.strategist_analysis_id).toBe('analysis-1');
    expect(result.data[0]?.context_hash).toBe('hash-1');
  });

  it('prioritizes exact advisor matches when contextHash is provided', async () => {
    (prisma.commercialAdvisorAnalysis.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    (prisma.commercialAdvisorAnalysis.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'advisor-exact',
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
          strategistAnalysisId: 'analysis-exact',
          outputJson: {
            executive_summary: 'Exacto',
            performance_explanation: 'Exacto',
            decision_justifications: [],
            objection_handling: {
              performance: 'Performance',
              budget: 'Budget',
            },
            additional_commercial_opportunity: 'Oportunidad',
            next_phase_recommendation: 'Siguiente fase',
            agency_positioning_narrative: 'Narrativa',
            client_talking_points: [],
            client_ready_summary: 'Resumen cliente',
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
          id: 'advisor-similar',
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
          strategistAnalysisId: 'analysis-similar',
          outputJson: {
            executive_summary: 'Similar',
            performance_explanation: 'Similar',
            decision_justifications: [],
            objection_handling: {
              performance: 'Performance',
              budget: 'Budget',
            },
            additional_commercial_opportunity: 'Oportunidad',
            next_phase_recommendation: 'Siguiente fase',
            agency_positioning_narrative: 'Narrativa',
            client_talking_points: [],
            client_ready_summary: 'Resumen cliente',
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

    expect(result.data[0]?.id).toBe('advisor-exact');
    expect(result.data[0]?.exact_context_match).toBe(true);
    expect(result.data[1]?.id).toBe('advisor-similar');
    expect(result.data[1]?.exact_context_match).toBe(false);
  });

  it('keeps client isolation when reading advisory history detail', async () => {
    (prisma.commercialAdvisorAnalysis.findFirst as jest.Mock).mockResolvedValue({
      id: 'advisor-1',
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
      strategistAnalysisId: 'analysis-1',
      strategistOutputJson: null,
      outputJson: {
        executive_summary: 'Resumen comercial',
        performance_explanation: 'Explicacion',
        decision_justifications: [],
        objection_handling: {
          performance: 'Performance',
          budget: 'Budget',
        },
        additional_commercial_opportunity: 'Oportunidad',
        next_phase_recommendation: 'Siguiente fase',
        agency_positioning_narrative: 'Narrativa',
        client_talking_points: [],
        client_ready_summary: 'Resumen cliente',
      },
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      generatedBy: null,
    });

    await repository.getHistoryById(manager, 'advisor-1');

    expect(prisma.commercialAdvisorAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'advisor-1',
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

  it('rejects advisory history detail outside actor scope', async () => {
    (prisma.commercialAdvisorAnalysis.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(repository.getHistoryById(manager, 'advisor-out')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.commercialAdvisorAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'advisor-out',
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
