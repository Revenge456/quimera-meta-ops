import { BadGatewayException, NotFoundException } from '@nestjs/common';

import { AdsStrategistAnalyzer } from '../domain/ads-strategist-analyzer';
import type { StrategistResponse } from '../domain/ads-strategist.types';
import { AdsStrategistService } from './ads-strategist.service';

describe('AdsStrategistService', () => {
  const actor = {
    sub: 'manager-1',
    email: 'manager@quimera.local',
    nombre: 'Manager',
    role: 'commercial_manager' as const,
  };

  const repository = {
    findAccessibleClient: jest.fn(),
    listEntities: jest.fn(),
    createAnalysisHistory: jest.fn(),
    listHistory: jest.fn(),
    getHistoryById: jest.fn(),
  };

  const aiLlmService = {
    generateStructuredJson: jest.fn(),
  };

  const systemLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  let maxEntities = '25';

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'AI_STRATEGIST_MAX_ENTITIES') {
        return maxEntities;
      }

      return undefined;
    }),
  };

  const validLlmResponse: StrategistResponse = {
    executive_summary: 'Resumen ejecutivo',
    key_findings: ['Hallazgo 1'],
    entity_analysis: [
      {
        entity_id: 'campaign-1',
        entity_name: 'Campana 1',
        level: 'campaign',
        classification: 'ESCALAR',
        confidence: 'ALTA',
        reasoning: 'Hay eficiencia y volumen suficiente.',
        main_metrics: {
          spend: 999,
          impressions: 999,
          clicks: 999,
          ctr: 99,
          cpc: 99,
          cpm: 99,
          roas: 99,
          results: 99,
          result_type: 'purchase',
        },
        detected_issues: [],
        opportunities: ['Escalar gradualmente'],
        recommended_actions: ['Subir presupuesto 10%'],
      },
    ],
    global_recommendations: ['Recomendacion'],
    risks_detected: ['Riesgo'],
    next_tests: ['Test'],
    client_summary: 'Resumen cliente',
  };

  let service: AdsStrategistService;

  beforeEach(() => {
    jest.clearAllMocks();
    maxEntities = '25';
    service = new AdsStrategistService(
      repository as never,
      new AdsStrategistAnalyzer(),
      aiLlmService as never,
      systemLogService as never,
      configService as never,
    );
    repository.findAccessibleClient.mockResolvedValue({
      id: 'client-1',
      nombre: 'Cliente',
      empresa: 'Empresa',
    });
    repository.createAnalysisHistory.mockResolvedValue({
      id: 'analysis-1',
    });
    repository.listEntities.mockResolvedValue([
      {
        entity_id: 'campaign-1',
        entity_name: 'Campana 1',
        level: 'campaign',
        status: 'ACTIVE',
        ad_account_id: 'account-1',
        ad_account_name: 'Account 1',
        campaign_id: 'campaign-1',
        campaign_name: 'Campana 1',
        ad_set_id: null,
        ad_set_name: null,
        main_metrics: {
          spend: 300,
          impressions: 10000,
          reach: 5000,
          frequency: 2,
          clicks: 180,
          linkClicks: 150,
          landingPageViews: 120,
          leads: 0,
          purchases: 5,
          purchaseValue: 900,
          results: 5,
          resultType: 'purchase',
          ctr: 1.8,
          cpc: 1.6667,
          cpm: 30,
          roas: 3,
          costPerResult: 60,
        },
        daily_series: [
          {
            date: '2026-03-01',
            spend: 100,
            impressions: 3000,
            reach: 1500,
            frequency: 2,
            clicks: 50,
            linkClicks: 40,
            landingPageViews: 30,
            leads: 0,
            purchases: 1,
            purchaseValue: 150,
            results: 1,
            resultType: 'purchase',
            ctr: 1.6667,
            cpc: 2,
            cpm: 33.3333,
            roas: 1.5,
            costPerResult: 100,
          },
          {
            date: '2026-03-02',
            spend: 200,
            impressions: 7000,
            reach: 3500,
            frequency: 2,
            clicks: 130,
            linkClicks: 110,
            landingPageViews: 90,
            leads: 0,
            purchases: 4,
            purchaseValue: 750,
            results: 4,
            resultType: 'purchase',
            ctr: 1.8571,
            cpc: 1.5385,
            cpm: 28.5714,
            roas: 3.75,
            costPerResult: 50,
          },
        ],
      },
    ]);
  });

  it('normalizes canonical metrics from backend instead of trusting LLM metric echoes', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue(validLlmResponse);

    const result = await service.analyze(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-02',
    });

    expect(result.entity_analysis[0]?.main_metrics).toEqual({
      spend: 300,
      impressions: 10000,
      clicks: 180,
      ctr: 1.8,
      cpc: 1.6667,
      cpm: 30,
      roas: 3,
      results: 5,
      result_type: 'purchase',
    });
    expect(repository.createAnalysisHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        level: 'campaign',
        output: expect.objectContaining({
          executive_summary: 'Resumen ejecutivo',
        }),
      }),
    );
  });

  it('retries once when the llm response does not satisfy the required structure', async () => {
    aiLlmService.generateStructuredJson
      .mockResolvedValueOnce({
        executive_summary: 'Invalido',
        entity_analysis: [],
      })
      .mockResolvedValueOnce(validLlmResponse);

    const result = await service.analyze(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-02',
    });

    expect(result.executive_summary).toBe('Resumen ejecutivo');
    expect(aiLlmService.generateStructuredJson).toHaveBeenCalledTimes(2);
  });

  it('fails after a controlled retry when the llm output remains invalid', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue({
      executive_summary: 'Invalido',
      entity_analysis: [],
    });

    await expect(
      service.analyze(actor, {
        clientId: 'client-1',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-02',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(aiLlmService.generateStructuredJson).toHaveBeenCalledTimes(2);
  });

  it('rejects classifications outside the enum and fails after the controlled retry', async () => {
    aiLlmService.generateStructuredJson.mockResolvedValue({
      ...validLlmResponse,
      entity_analysis: [
        {
          ...validLlmResponse.entity_analysis[0],
          classification: 'HOLD',
        },
      ],
    });

    await expect(
      service.analyze(actor, {
        clientId: 'client-1',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-02',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(aiLlmService.generateStructuredJson).toHaveBeenCalledTimes(2);
  });

  it('preserves client isolation by failing when the client is outside the actor scope', async () => {
    repository.findAccessibleClient.mockRejectedValueOnce(
      new NotFoundException('Cliente no encontrado'),
    );

    await expect(
      service.analyze(actor, {
        clientId: 'client-2',
        level: 'campaign',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-02',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(aiLlmService.generateStructuredJson).not.toHaveBeenCalled();
  });

  it('limits the analyzed entities to AI_STRATEGIST_MAX_ENTITIES prioritized by spend', async () => {
    maxEntities = '1';
    repository.listEntities.mockResolvedValue([
      {
        entity_id: 'campaign-low',
        entity_name: 'Campana Low',
        level: 'campaign',
        status: 'ACTIVE',
        ad_account_id: 'account-1',
        ad_account_name: 'Account 1',
        campaign_id: 'campaign-low',
        campaign_name: 'Campana Low',
        ad_set_id: null,
        ad_set_name: null,
        main_metrics: {
          spend: 100,
          impressions: 5000,
          reach: 3000,
          frequency: 1.6667,
          clicks: 60,
          linkClicks: 40,
          landingPageViews: 30,
          leads: 0,
          purchases: 2,
          purchaseValue: 150,
          results: 2,
          resultType: 'purchase',
          ctr: 1.2,
          cpc: 1.6667,
          cpm: 20,
          roas: 1.5,
          costPerResult: 50,
        },
        daily_series: [],
      },
      {
        entity_id: 'campaign-high',
        entity_name: 'Campana High',
        level: 'campaign',
        status: 'ACTIVE',
        ad_account_id: 'account-1',
        ad_account_name: 'Account 1',
        campaign_id: 'campaign-high',
        campaign_name: 'Campana High',
        ad_set_id: null,
        ad_set_name: null,
        main_metrics: {
          spend: 500,
          impressions: 12000,
          reach: 7000,
          frequency: 1.7143,
          clicks: 220,
          linkClicks: 170,
          landingPageViews: 130,
          leads: 0,
          purchases: 7,
          purchaseValue: 1500,
          results: 7,
          resultType: 'purchase',
          ctr: 1.8333,
          cpc: 2.2727,
          cpm: 41.6667,
          roas: 3,
          costPerResult: 71.4286,
        },
        daily_series: [],
      },
    ]);
    aiLlmService.generateStructuredJson.mockResolvedValue({
      ...validLlmResponse,
      entity_analysis: [
        {
          ...validLlmResponse.entity_analysis[0],
          entity_id: 'campaign-high',
          entity_name: 'Campana High',
        },
      ],
    });

    const result = await service.analyze(actor, {
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-02',
    });

    expect(result.entity_analysis).toHaveLength(1);
    expect(result.entity_analysis[0]?.entity_id).toBe('campaign-high');
  });
});
