import { BadGatewayException, BadRequestException } from '@nestjs/common';

import type { AuthUser } from '../../shared/types/auth-user.type';
import { AiComparisonService } from './ai-comparison.service';

const actor: AuthUser = {
  sub: 'user-1',
  email: 'admin@quimera.local',
  nombre: 'Admin',
  role: 'admin',
};

function buildAnalysis(overrides: Partial<any> = {}) {
  return {
    id: 'analysis-current',
    client: {
      id: 'client-1',
      nombre: 'Cliente Uno',
      empresa: 'Quimera',
    },
    level: 'campaign',
    date_from: '2026-03-01',
    date_to: '2026-03-10',
    generated_at: '2026-03-10T12:00:00.000Z',
    context_hash: 'hash-1',
    output: {
      executive_summary: 'Resumen',
      key_findings: [],
      global_recommendations: [],
      risks_detected: [],
      next_tests: [],
      client_summary: 'Cliente',
      entity_analysis: [
        {
          entity_id: 'entity-1',
          entity_name: 'Campana A',
          level: 'campaign',
          classification: 'ESCALAR',
          confidence: 'ALTA',
          reasoning: 'Bien',
          main_metrics: {
            spend: 100,
            impressions: 1000,
            clicks: 50,
            ctr: 5,
            cpc: 2,
            cpm: 100,
            roas: 3,
            results: 10,
            result_type: 'lead',
          },
          detected_issues: [],
          opportunities: [],
          recommended_actions: [],
        },
      ],
    },
    ...overrides,
  };
}

describe('AiComparisonService', () => {
  const repository = {
    getAccessibleAnalysisById: jest.fn(),
    findPreviousAnalysis: jest.fn(),
  };

  const aiLlmService = {
    generateStructuredJson: jest.fn(),
  };

  const systemLogService = {
    log: jest.fn(),
  };

  let service: AiComparisonService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiComparisonService(
      repository as never,
      aiLlmService as never,
      systemLogService as never,
    );
  });

  it('usa fallback por context hash cuando no llega previousAnalysisId', async () => {
    const current = buildAnalysis();
    const currentEntity = current.output.entity_analysis[0]!;
    const previous = buildAnalysis({
      id: 'analysis-prev',
      generated_at: '2026-03-08T12:00:00.000Z',
      output: {
        ...current.output,
        entity_analysis: [
          {
            ...currentEntity,
            classification: 'OPTIMIZAR',
            main_metrics: {
              ...currentEntity.main_metrics,
              spend: 80,
            },
          },
        ],
      },
    });

    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(previous);
    aiLlmService.generateStructuredJson.mockResolvedValue({
      summary: 'Mejora clara.',
      key_changes: ['Subio la clasificacion principal.'],
      entity_differences: [
        {
          entity_id: 'entity-1',
          entity_name: 'Inventado',
          level: 'campaign',
          previous_classification: 'OPTIMIZAR',
          current_classification: 'ESCALAR',
          change_type: 'IMPROVED',
          metric_deltas: { spend: 20, ctr: 0, cpc: 0, roas: 0, results: 0 },
          insight: 'Mejoro.',
        },
      ],
      improvements: ['Hay mejora.'],
      deteriorations: [],
      new_opportunities: [],
      risks_detected: [],
      recommended_actions: ['Escalar con control.'],
    });

    const result = await service.compare(actor, {
      currentAnalysisId: current.id,
      contextHash: 'hash-1',
    });

    expect(repository.findPreviousAnalysis).toHaveBeenCalledWith(actor, {
      current,
      previousAnalysisId: undefined,
      contextHash: 'hash-1',
    });
    expect(result.entity_differences[0]?.entity_name).toBe('Campana A');
    expect(result.entity_differences[0]?.change_type).toBe('IMPROVED');
    expect(result.comparison_basis.match_type).toBe('EXACT_MATCH');
  });

  it('detecta entidades nuevas y removidas al normalizar la comparacion', async () => {
    const current = buildAnalysis({
      output: {
        ...buildAnalysis().output,
        entity_analysis: [
          buildAnalysis().output.entity_analysis[0],
          {
            ...buildAnalysis().output.entity_analysis[0],
            entity_id: 'entity-2',
            entity_name: 'Campana Nueva',
            classification: 'OPTIMIZAR',
          },
        ],
      },
    });
    const previous = buildAnalysis({
      id: 'analysis-prev',
      generated_at: '2026-03-08T12:00:00.000Z',
      output: {
        ...buildAnalysis().output,
        entity_analysis: [
          {
            ...buildAnalysis().output.entity_analysis[0],
            entity_id: 'entity-3',
            entity_name: 'Campana Vieja',
            classification: 'PAUSAR',
          },
        ],
      },
    });

    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(previous);
    aiLlmService.generateStructuredJson.mockResolvedValue({
      summary: 'Cambios mixtos.',
      key_changes: ['Entra una nueva y sale otra.'],
      entity_differences: [
        {
          entity_id: 'entity-2',
          entity_name: 'Otro',
          level: 'campaign',
          previous_classification: null,
          current_classification: 'OPTIMIZAR',
          change_type: 'NEW',
          metric_deltas: { spend: 100 },
          insight: 'Nueva.',
        },
        {
          entity_id: 'entity-3',
          entity_name: 'Otra',
          level: 'campaign',
          previous_classification: 'PAUSAR',
          current_classification: 'PAUSAR',
          change_type: 'REMOVED',
          metric_deltas: { spend: -100 },
          insight: 'Salio.',
        },
      ],
      improvements: [],
      deteriorations: [],
      new_opportunities: [],
      risks_detected: [],
      recommended_actions: [],
    });

    const result = await service.compare(actor, {
      currentAnalysisId: current.id,
    });

    expect(result.entity_differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_id: 'entity-2',
          change_type: 'NEW',
          entity_name: 'Campana Nueva',
        }),
        expect.objectContaining({
          entity_id: 'entity-3',
          change_type: 'REMOVED',
          entity_name: 'Campana Vieja',
        }),
      ]),
    );
  });

  it('falla si el previous viene de otro cliente o nivel', async () => {
    const current = buildAnalysis();
    const previous = buildAnalysis({
      id: 'analysis-prev',
      client: {
        id: 'client-2',
        nombre: 'Otro',
        empresa: 'Otra',
      },
    });

    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(previous);

    await expect(
      service.compare(actor, {
        currentAnalysisId: current.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usa fallback similar cuando no hay contextHash exacto disponible', async () => {
    const current = buildAnalysis({
      context_hash: null,
    });
    const previous = buildAnalysis({
      id: 'analysis-prev',
      context_hash: null,
      generated_at: '2026-03-08T12:00:00.000Z',
    });

    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(previous);
    aiLlmService.generateStructuredJson.mockResolvedValue({
      summary: 'Fallback similar.',
      key_changes: [],
      entity_differences: [],
      improvements: [],
      deteriorations: [],
      new_opportunities: [],
      risks_detected: [],
      recommended_actions: [],
    });

    const result = await service.compare(actor, {
      currentAnalysisId: current.id,
    });

    expect(result.comparison_basis.match_type).toBe('CONTEXT_SIMILAR');
  });

  it('reintenta si la respuesta del llm no cumple el schema', async () => {
    const current = buildAnalysis();
    const previous = buildAnalysis({
      id: 'analysis-prev',
      generated_at: '2026-03-08T12:00:00.000Z',
    });

    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(previous);
    aiLlmService.generateStructuredJson
      .mockResolvedValueOnce({
        summary: 'Invalido',
      })
      .mockResolvedValueOnce({
        summary: 'Valido',
        key_changes: [],
        entity_differences: [],
        improvements: [],
        deteriorations: [],
        new_opportunities: [],
        risks_detected: [],
        recommended_actions: [],
      });

    const result = await service.compare(actor, {
      currentAnalysisId: current.id,
    });

    expect(aiLlmService.generateStructuredJson).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe('Valido');
  });

  it('devuelve mensaje claro si no existe previous compatible', async () => {
    const current = buildAnalysis();
    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(null);

    const result = await service.compare(actor, {
      currentAnalysisId: current.id,
    });

    expect(result.entity_differences).toHaveLength(0);
    expect(result.comparison_basis.match_type).toBe('NO_PREVIOUS');
    expect(aiLlmService.generateStructuredJson).not.toHaveBeenCalled();
  });

  it('rechaza entidad fuera del diff canonico', async () => {
    const current = buildAnalysis();
    const previous = buildAnalysis({
      id: 'analysis-prev',
      generated_at: '2026-03-08T12:00:00.000Z',
    });

    repository.getAccessibleAnalysisById.mockResolvedValue(current);
    repository.findPreviousAnalysis.mockResolvedValue(previous);
    aiLlmService.generateStructuredJson.mockResolvedValue({
      summary: 'Invalido',
      key_changes: [],
      entity_differences: [
        {
          entity_id: 'otro',
          entity_name: 'Fuera',
          level: 'campaign',
          previous_classification: null,
          current_classification: 'ESCALAR',
          change_type: 'NEW',
          metric_deltas: {},
          insight: 'No valida',
        },
      ],
      improvements: [],
      deteriorations: [],
      new_opportunities: [],
      risks_detected: [],
      recommended_actions: [],
    });

    await expect(
      service.compare(actor, {
        currentAnalysisId: current.id,
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
