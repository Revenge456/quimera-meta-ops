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

export async function buildAnalysisContextHash(input: {
  clientId: string;
  level: AnalysisContextLevel;
  dateFrom: string;
  dateTo: string;
  filters?: AnalysisContextFilters;
}) {
  const serialized = serializeAnalysisContext(input);
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized),
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
