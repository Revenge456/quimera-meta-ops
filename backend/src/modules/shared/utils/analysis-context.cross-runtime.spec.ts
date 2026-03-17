import {
  buildAnalysisContextHash as buildBackendHash,
  normalizeAnalysisContext as normalizeBackendContext,
  serializeAnalysisContext as serializeBackendContext,
} from './analysis-context';
import {
  buildAnalysisContextHash as buildFrontendHash,
  normalizeAnalysisContext as normalizeFrontendContext,
  serializeAnalysisContext as serializeFrontendContext,
} from '../../../../../frontend/utils/analysisContext';

describe('analysis-context cross runtime consistency', () => {
  it('genera exactamente la misma normalizacion y hash en backend y frontend', async () => {
    const input = {
      clientId: 'client-1',
      level: 'ad_set' as const,
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        status: ' ACTIVE ',
        search: ' prospecting ',
        campaignId: 'campaign-1',
        adSetId: 'adset-1',
        adAccountId: '',
      },
    };

    const backendNormalized = normalizeBackendContext(input);
    const frontendNormalized = normalizeFrontendContext(input);

    expect(frontendNormalized).toEqual(backendNormalized);
    expect(serializeFrontendContext(input)).toBe(serializeBackendContext(input));
    await expect(buildFrontendHash(input)).resolves.toBe(buildBackendHash(input));
  });

  it('genera hashes distintos cuando cambia el contexto', async () => {
    const base = {
      clientId: 'client-1',
      level: 'campaign' as const,
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
      filters: {
        status: 'ACTIVE',
        search: 'prospecting',
      },
    };

    const changed = {
      ...base,
      filters: {
        ...base.filters,
        search: 'retargeting',
      },
    };

    const backendBase = buildBackendHash(base);
    const backendChanged = buildBackendHash(changed);

    expect(backendChanged).not.toBe(backendBase);
    await expect(buildFrontendHash(changed)).resolves.not.toBe(
      await buildFrontendHash(base),
    );
  });
});
