type DecimalLike = number | string | { toString(): string } | null | undefined;

export type EntitySortOrder = 'asc' | 'desc';
export type EntitySortField =
  | 'name'
  | 'status'
  | 'createdAt'
  | 'spend'
  | 'impressions'
  | 'clicks'
  | 'results'
  | 'purchases'
  | 'purchaseValue'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'roas';

export type PaginationParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type ResolvedListSort = {
  field: EntitySortField;
  order: EntitySortOrder;
  mode: 'entity' | 'metric';
};

export type EntityMetricSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  results: number | null;
  purchases: number;
  purchaseValue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  roas: number | null;
};

export function toMetricNumber(value: DecimalLike) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number.parseFloat(value);
  }

  return Number(value.toString());
}

function safeRatio(numerator: number, denominator: number, factor = 1) {
  if (!denominator) {
    return null;
  }

  return Number(((numerator / denominator) * factor).toFixed(4));
}

export function resolvePagination(page?: number | string, pageSize?: number | string) {
  const normalizedPage = Math.max(1, Number(page ?? 1) || 1);
  const normalizedPageSize = Math.min(
    100,
    Math.max(1, Number(pageSize ?? 25) || 25),
  );

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
  } satisfies PaginationParams;
}

export function resolveEntityListSort(
  sortBy: string | undefined,
  sortOrder: string | undefined,
): ResolvedListSort {
  const allowed: EntitySortField[] = [
    'name',
    'status',
    'createdAt',
    'spend',
    'impressions',
    'clicks',
    'results',
    'purchases',
    'purchaseValue',
    'ctr',
    'cpc',
    'cpm',
    'roas',
  ];

  const field = allowed.includes(sortBy as EntitySortField)
    ? (sortBy as EntitySortField)
    : 'createdAt';
  const order: EntitySortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    field,
    order,
    mode: ['name', 'status', 'createdAt'].includes(field) ? 'entity' : 'metric',
  };
}

export function buildListMeta(params: {
  total: number;
  pagination: PaginationParams;
  sort: ResolvedListSort;
}) {
  return {
    page: params.pagination.page,
    pageSize: params.pagination.pageSize,
    total: params.total,
    totalPages: Math.max(1, Math.ceil(params.total / params.pagination.pageSize)),
    sortBy: params.sort.field,
    sortOrder: params.sort.order,
  };
}

export function buildMetricSummaryFromAggregate(sum: {
  spend?: DecimalLike;
  impressions?: number | null;
  clicks?: number | null;
  results?: DecimalLike;
  purchases?: DecimalLike;
  purchaseValue?: DecimalLike;
}) {
  const spend = Number(toMetricNumber(sum.spend).toFixed(2));
  const impressions = sum.impressions ?? 0;
  const clicks = sum.clicks ?? 0;
  const resultsValue = toMetricNumber(sum.results);
  const purchases = Number(toMetricNumber(sum.purchases).toFixed(4));
  const purchaseValue = Number(toMetricNumber(sum.purchaseValue).toFixed(2));

  return {
    spend,
    impressions,
    clicks,
    results: sum.results === null || sum.results === undefined ? null : resultsValue,
    purchases,
    purchaseValue,
    ctr: safeRatio(clicks, impressions, 100),
    cpc: safeRatio(spend, clicks),
    cpm: safeRatio(spend, impressions, 1000),
    roas: safeRatio(purchaseValue, spend),
  } satisfies EntityMetricSummary;
}

export function sortIdsByMetric(params: {
  ids: string[];
  summaries: Map<string, EntityMetricSummary>;
  field: EntitySortField;
  order: EntitySortOrder;
}) {
  const direction = params.order === 'asc' ? 1 : -1;

  return [...params.ids].sort((leftId, rightId) => {
    const left = params.summaries.get(leftId) ?? emptyMetricSummary();
    const right = params.summaries.get(rightId) ?? emptyMetricSummary();

    const leftValue = left[params.field as keyof EntityMetricSummary] ?? null;
    const rightValue = right[params.field as keyof EntityMetricSummary] ?? null;

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === null) {
      return 1;
    }

    if (rightValue === null) {
      return -1;
    }

    return leftValue > rightValue ? direction : -direction;
  });
}

function emptyMetricSummary(): EntityMetricSummary {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    results: null,
    purchases: 0,
    purchaseValue: 0,
    ctr: null,
    cpc: null,
    cpm: null,
    roas: null,
  };
}
