import {
  buildAnalysisContextHash,
  normalizeAnalysisContext,
  serializeAnalysisContext,
} from './analysis-context';

describe('analysis-context utils', () => {
  it('builds the same hash for equivalent contexts with reordered or empty filters', () => {
    const left = buildAnalysisContextHash({
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        search: ' prospecting ',
        status: 'ACTIVE',
        adSetId: '',
      },
    });

    const right = buildAnalysisContextHash({
      clientId: 'client-1',
      level: 'campaign',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        status: 'ACTIVE',
        search: 'prospecting',
      },
    });

    expect(left).toBe(right);
  });

  it('keeps normalized json consistent with the generated hash input', () => {
    const normalized = normalizeAnalysisContext({
      clientId: 'client-1',
      level: 'ad',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        status: 'ACTIVE',
        campaignId: 'campaign-1',
        adSetId: 'adset-1',
      },
    });

    expect(serializeAnalysisContext(normalized)).toBe(JSON.stringify(normalized));
    expect(buildAnalysisContextHash(normalized)).toHaveLength(64);
  });
});
