import { BadGatewayException, NotFoundException } from '@nestjs/common';

import type { StrategistResponse } from '../../ai-strategist/domain/ads-strategist.types';
import { CommercialAdvisorService } from './commercial-advisor.service';

describe('CommercialAdvisorService', () => {
  const actor = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager' as const,
  };

  const repository = {
    findAccessibleClient: jest.fn(),
    createAdvisorHistory: jest.fn(),
    listHistory: jest.fn(),
    getHistoryById: jest.fn(),
  };

  const adsStrategistService = {
    analyzeAndPersist: jest.fn(),
    getHistoryById: jest.fn(),
    getLatestHistoryByContextHash: jest.fn(),
  };

  const aiLlmService = {
    generateStructuredJson: jest.fn(),
  };

  const systemLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const strategistOutput: StrategistResponse = {
    executive_summary: 'Resumen tecnico',
    key_findings: ['Hallazgo 1'],
    entity_analysis: [
      {
        entity_id: 'campaign-1',
        entity_name: 'Campana 1',
        level: 'campaign',
        classification: 'OPTIMIZAR',
        confidence: 'MEDIA',
        reasoning: 'Hay espacio de mejora.',
        main_metrics: {
          spend: 350,
          impressions: 10000,
          clicks: 170,
          ctr: 1.7,
          cpc: 2.0588,
          cpm: 35,
          roas: 1.8,
          results: 6,
          result_type: 'purchase',
        },
        detected_issues: ['CTR mejorable'],
        opportunities: ['Test creativo'],
        recommended_actions: ['Refrescar anuncios'],
      },
    ],
    global_recommendations: ['Recomendacion 1'],
    risks_detected: ['Riesgo 1'],
    next_tests: ['Test 1'],
    client_summary: 'Resumen cliente',
  };

  const validAdvisorOutput = {
    executive_summary: 'Resumen ejecutivo comercial',
    performance_explanation: 'El periodo deja una base defendible con espacio claro de mejora.',
    decision_justifications: [
      {
        entity_id: 'campaign-1',
        entity_name: 'Nombre viejo',
        classification: 'PAUSAR',
        justification:
          'La recomendacion de optimizar protege eficiencia antes de escalar presupuesto.',
      },
    ],
    objection_handling: {
      performance:
        'La lectura no habla de fracaso, sino de una fase donde conviene ajustar para capturar mejor retorno.',
      budget:
        'Antes de aumentar presupuesto, proponemos ordenar la eficiencia para que la siguiente inversion tenga mejor impacto.',
    },
    additional_commercial_opportunity:
      'Abrir una fase de experimentacion creativa y landing puede mejorar retencion y preparar expansion.',
    next_phase_recommendation:
      'Entrar en un bloque de optimizacion controlada y reevaluar escala en el siguiente corte.',
    agency_positioning_narrative:
      'La agencia actua como socio que protege inversion y prioriza decisiones con criterio.',
    client_talking_points: ['Hay base para defender trabajo y abrir una mejora concreta.'],
    client_ready_summary:
      'El rendimiento actual justifica una fase de optimizacion con objetivo de capturar mas valor antes de escalar.',
  };

  let service: CommercialAdvisorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommercialAdvisorService(
      repository as never,
      adsStrategistService as never,
      aiLlmService as never,
      systemLogService as never,
    );
    repository.findAccessibleClient.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      empresa: 'Empresa',
    });
    repository.createAdvisorHistory.mockResolvedValue({
      id: 'advisor-1',
    });
    adsStrategistService.analyzeAndPersist.mockResolvedValue({
      analysisId: 'analysis-1',
      output: strategistOutput,
    });
    adsStrategistService.getHistoryById.mockResolvedValue({
      id: 'analysis-existing',
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      level: 'campaign',
      date_from: '2026-03-01',
      date_to: '2026-03-10',
      filters: {
        status: 'ACTIVE',
      },
      output: strategistOutput,
    });
    adsStrategistService.getLatestHistoryByContextHash.mockResolvedValue({
      id: 'analysis-context',
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      level: 'campaign',
      date_from: '2026-03-01',
      date_to: '2026-03-10',
      filters: {
        status: 'ACTIVE',
        search: 'prospecting',
      },
      output: strategistOutput,
    });
  });

  it('normalizes decision entity names and classifications from strategist output', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue(validAdvisorOutput);

    const result = await service.generate(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
    });

    expect(result.decision_justifications[0]).toEqual({
      entity_id: 'campaign-1',
      entity_name: 'Campana 1',
      classification: 'OPTIMIZAR',
      justification:
        'La recomendacion de optimizar protege eficiencia antes de escalar presupuesto.',
    });
    expect(repository.createAdvisorHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        strategistAnalysisId: 'analysis-1',
      }),
    );
  });

  it('retries once when the commercial output is malformed', async () => {
    aiLlmService.generateStructuredJson
      .mockResolvedValueOnce({
        executive_summary: 'Invalido',
      })
      .mockResolvedValueOnce(validAdvisorOutput);

    const result = await service.generate(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
    });

    expect(result.executive_summary).toBe('Resumen ejecutivo comercial');
    expect(aiLlmService.generateStructuredJson).toHaveBeenCalledTimes(2);
  });

  it('fails after retry if the llm keeps returning invalid structure', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue({
      executive_summary: 'Invalido',
    });

    await expect(
      service.generate(actor, {
        clientId: 'client-1',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-10',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects entity references outside strategist scope', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue({
      ...validAdvisorOutput,
      decision_justifications: [
        {
          entity_id: 'campaign-2',
          entity_name: 'Fuera de alcance',
          classification: 'OPTIMIZAR',
          justification: 'Texto',
        },
      ],
    });

    await expect(
      service.generate(actor, {
        clientId: 'client-1',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-10',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('preserves client isolation before generating commercial narrative', async () => {
    adsStrategistService.analyzeAndPersist.mockRejectedValueOnce(
      new NotFoundException('Cliente no encontrado'),
    );

    await expect(
      service.generate(actor, {
        clientId: 'client-2',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-10',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(adsStrategistService.analyzeAndPersist).toHaveBeenCalledWith(actor, {
      clientId: 'client-2',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
    });
    expect(aiLlmService.generateStructuredJson).not.toHaveBeenCalled();
    expect(repository.findAccessibleClient).not.toHaveBeenCalled();
  });

  it('stays cautious and skips the llm when the strategist output is too weak to support advisory', async () => {
    adsStrategistService.analyzeAndPersist.mockResolvedValueOnce({
      analysisId: 'analysis-weak',
      output: {
        ...strategistOutput,
        entity_analysis: [],
        executive_summary: 'Sin evidencia suficiente',
        client_summary: 'Sin material suficiente',
      },
    });

    const result = await service.generate(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
    });

    expect(result.executive_summary).toContain('No hay suficiente material');
    expect(result.objection_handling.budget).toContain(
      'No es recomendable empujar presupuesto adicional',
    );
    expect(aiLlmService.generateStructuredJson).not.toHaveBeenCalled();
    expect(repository.createAdvisorHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        strategistAnalysisId: 'analysis-weak',
      }),
    );
  });

  it('reuses an existing strategist analysis when strategistAnalysisId is provided', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue(validAdvisorOutput);

    const result = await service.generateWithHistory(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      strategistAnalysisId: 'analysis-existing',
    });

    expect(adsStrategistService.getHistoryById).toHaveBeenCalledWith(
      actor,
      'analysis-existing',
    );
    expect(adsStrategistService.analyzeAndPersist).not.toHaveBeenCalled();
    expect(repository.createAdvisorHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        strategistAnalysisId: 'analysis-existing',
        filters: { status: 'ACTIVE' },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        advisoryId: 'advisor-1',
        strategistAnalysisId: 'analysis-existing',
      }),
    );
  });

  it('reuses the most recent exact strategist match when contextHash is provided', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue(validAdvisorOutput);

    const result = await service.generateWithHistory(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      contextHash: 'hash-123',
    });

    expect(adsStrategistService.getLatestHistoryByContextHash).toHaveBeenCalledWith(
      actor,
      {
        clientId: 'client-1',
        contextHash: 'hash-123',
      },
    );
    expect(adsStrategistService.analyzeAndPersist).not.toHaveBeenCalled();
    expect(repository.createAdvisorHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        strategistAnalysisId: 'analysis-context',
        filters: {
          status: 'ACTIVE',
          search: 'prospecting',
        },
      }),
    );
    expect(result.strategistAnalysisId).toBe('analysis-context');
  });
});
