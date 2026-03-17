import { aggregatePerformance, buildDailyChart } from './performance-metrics';

describe('performance-metrics', () => {
  it('aggregates range metrics from totals instead of averaging percentages', () => {
    const summary = aggregatePerformance([
      {
        date: new Date('2026-03-10'),
        spend: '100',
        impressions: 1000,
        clicks: 20,
        results: '4',
        resultType: 'lead',
        purchaseValue: '300',
      },
      {
        date: new Date('2026-03-11'),
        spend: '50',
        impressions: 500,
        clicks: 5,
        results: '2',
        resultType: 'lead',
        purchaseValue: '150',
      },
    ]);

    expect(summary.spend).toBe(150);
    expect(summary.impressions).toBe(1500);
    expect(summary.clicks).toBe(25);
    expect(summary.ctr).toBeCloseTo(1.6667, 4);
    expect(summary.cpc).toBe(6);
    expect(summary.cpm).toBe(100);
    expect(summary.results).toBe(6);
    expect(summary.costPerResult).toBe(25);
    expect(summary.roas).toBe(3);
  });

  it('marks results as mixed when result types differ across the range', () => {
    const summary = aggregatePerformance([
      {
        date: new Date('2026-03-10'),
        spend: '100',
        results: '4',
        resultType: 'lead',
      },
      {
        date: new Date('2026-03-11'),
        spend: '40',
        results: '2',
        resultType: 'purchase',
      },
    ]);

    expect(summary.resultType).toBe('mixed');
    expect(summary.results).toBeNull();
    expect(summary.costPerResult).toBeNull();
  });

  it('builds daily chart rows preserving per-day metrics', () => {
    const chart = buildDailyChart([
      {
        date: new Date('2026-03-10'),
        spend: '10',
        impressions: 100,
        clicks: 4,
        results: '1',
        resultType: 'lead',
      },
    ]);

    expect(chart).toEqual([
      expect.objectContaining({
        date: '2026-03-10',
        spend: 10,
        impressions: 100,
        clicks: 4,
        results: 1,
        resultType: 'lead',
      }),
    ]);
  });
});
