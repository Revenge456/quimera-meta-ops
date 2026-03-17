import { AdsStrategistAnalyzer } from './ads-strategist-analyzer';
import type { StrategistEntityRecord } from './ads-strategist.types';

function buildEntity(
  overrides: Partial<StrategistEntityRecord> = {},
): StrategistEntityRecord {
  return {
    entity_id: 'entity-1',
    entity_name: 'Entity 1',
    level: 'campaign',
    status: 'ACTIVE',
    ad_account_id: 'account-1',
    ad_account_name: 'Account 1',
    campaign_id: 'campaign-1',
    campaign_name: 'Campaign 1',
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
      leads: 10,
      purchases: 0,
      purchaseValue: 0,
      results: 10,
      resultType: 'lead',
      ctr: 1.8,
      cpc: 1.6667,
      cpm: 30,
      roas: null,
      costPerResult: 30,
    },
    daily_series: [
      {
        date: '2026-03-01',
        spend: 100,
        impressions: 3000,
        reach: 1500,
        frequency: 2,
        clicks: 40,
        linkClicks: 35,
        landingPageViews: 30,
        leads: 2,
        purchases: 0,
        purchaseValue: 0,
        results: 2,
        resultType: 'lead',
        ctr: 1.3333,
        cpc: 2.5,
        cpm: 33.3333,
        roas: null,
        costPerResult: 50,
      },
      {
        date: '2026-03-02',
        spend: 100,
        impressions: 3000,
        reach: 1500,
        frequency: 2,
        clicks: 50,
        linkClicks: 42,
        landingPageViews: 33,
        leads: 3,
        purchases: 0,
        purchaseValue: 0,
        results: 3,
        resultType: 'lead',
        ctr: 1.6667,
        cpc: 2,
        cpm: 33.3333,
        roas: null,
        costPerResult: 33.3333,
      },
      {
        date: '2026-03-03',
        spend: 50,
        impressions: 2000,
        reach: 1200,
        frequency: 1.6667,
        clicks: 40,
        linkClicks: 34,
        landingPageViews: 28,
        leads: 3,
        purchases: 0,
        purchaseValue: 0,
        results: 3,
        resultType: 'lead',
        ctr: 2,
        cpc: 1.25,
        cpm: 25,
        roas: null,
        costPerResult: 16.6667,
      },
      {
        date: '2026-03-04',
        spend: 50,
        impressions: 2000,
        reach: 800,
        frequency: 2.5,
        clicks: 50,
        linkClicks: 39,
        landingPageViews: 29,
        leads: 2,
        purchases: 0,
        purchaseValue: 0,
        results: 2,
        resultType: 'lead',
        ctr: 2.5,
        cpc: 1,
        cpm: 25,
        roas: null,
        costPerResult: 25,
      },
    ],
    ...overrides,
  };
}

describe('AdsStrategistAnalyzer', () => {
  const analyzer = new AdsStrategistAnalyzer();

  it('classifies strong entities as ESCALAR when efficiency and trend support it', () => {
    const context = analyzer.buildContext({
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-04',
      maxEntities: 25,
      entities: [
        buildEntity({
          main_metrics: {
            ...buildEntity().main_metrics,
            roas: 2.6,
            purchases: 5,
            purchaseValue: 780,
            results: 5,
            resultType: 'purchase',
            costPerResult: 60,
          },
          daily_series: buildEntity().daily_series.map((row, index) => ({
            ...row,
            purchases: index < 2 ? 1 : 2,
            purchaseValue: index < 2 ? 100 : 290,
            results: index < 2 ? 1 : 2,
            resultType: 'purchase',
            roas: index < 2 ? 1 : 3,
          })),
        }),
      ],
    });

    expect(context.entities[0]?.strategic_hints.classification_hint).toBe('ESCALAR');
  });

  it('marks low-volume entities with BAJA confidence and avoids aggressive hints', () => {
    const context = analyzer.buildContext({
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-04',
      maxEntities: 25,
      entities: [
        buildEntity({
          main_metrics: {
            ...buildEntity().main_metrics,
            spend: 40,
            clicks: 6,
            results: 1,
            costPerResult: 40,
          },
        }),
      ],
    });

    expect(context.entities[0]?.data_sufficiency.confidence_hint).toBe('BAJA');
    expect(context.entities[0]?.strategic_hints.classification_hint).toBe('MANTENER');
    expect(context.entities[0]?.data_sufficiency.evidence_flags).toContain('low_spend');
  });

  it('handles mixed result types as inconsistent and lowers confidence', () => {
    const context = analyzer.buildContext({
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-04',
      maxEntities: 25,
      entities: [
        buildEntity({
          main_metrics: {
            ...buildEntity().main_metrics,
            resultType: 'mixed',
            results: null,
            costPerResult: null,
          },
        }),
      ],
    });

    expect(context.entities[0]?.strategic_hints.result_consistency).toBe('MIXED');
    expect(context.entities[0]?.data_sufficiency.evidence_flags).toContain(
      'mixed_result_type',
    );
  });

  it('classifies sustained poor performance as PAUSAR when evidence is sufficient', () => {
    const context = analyzer.buildContext({
      client: {
        id: 'client-1',
        nombre: 'Cliente',
        empresa: 'Empresa',
      },
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-04',
      maxEntities: 25,
      entities: [
        buildEntity({
          main_metrics: {
            ...buildEntity().main_metrics,
            spend: 400,
            clicks: 60,
            ctr: 0.6,
            cpc: 6.6667,
            results: 0,
            roas: 0.3,
            costPerResult: null,
          },
          daily_series: buildEntity().daily_series.map((row) => ({
            ...row,
            clicks: 15,
            ctr: 0.6,
            cpc: 6.6667,
            results: 0,
            roas: 0.3,
          })),
        }),
      ],
    });

    expect(context.entities[0]?.strategic_hints.classification_hint).toBe('PAUSAR');
  });
});
