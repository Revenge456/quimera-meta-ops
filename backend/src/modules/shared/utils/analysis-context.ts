import { createHash } from 'crypto';

type AnalysisContextLevel = 'campaign' | 'ad_set' | 'ad';

type AnalysisContextFilters = {
  status?: string;
  search?: string;
  campaignId?: string;
  adSetId?: string;
  adAccountId?: string;
};

export type NormalizedAnalysisContext = {
  clientId: string;
  level: AnalysisContextLevel;
  dateFrom: string;
  dateTo: string;
  filters: AnalysisContextFilters;
};

function normalizeOptionalValue(value?: string | null) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeAnalysisContext(input: {
  clientId: string;
  level: AnalysisContextLevel;
  dateFrom: string;
  dateTo: string;
  filters?: AnalysisContextFilters;
}): NormalizedAnalysisContext {
  return {
    clientId: input.clientId,
    level: input.level,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    filters: {
      status: normalizeOptionalValue(input.filters?.status),
      search: normalizeOptionalValue(input.filters?.search),
      campaignId: normalizeOptionalValue(input.filters?.campaignId),
      adSetId: normalizeOptionalValue(input.filters?.adSetId),
      adAccountId: normalizeOptionalValue(input.filters?.adAccountId),
    },
  };
}

export function serializeAnalysisContext(input: {
  clientId: string;
  level: AnalysisContextLevel;
  dateFrom: string;
  dateTo: string;
  filters?: AnalysisContextFilters;
}) {
  return JSON.stringify(normalizeAnalysisContext(input));
}

export function buildAnalysisContextHash(input: {
  clientId: string;
  level: AnalysisContextLevel;
  dateFrom: string;
  dateTo: string;
  filters?: AnalysisContextFilters;
}) {
  return createHash('sha256')
    .update(serializeAnalysisContext(input))
    .digest('hex');
}
