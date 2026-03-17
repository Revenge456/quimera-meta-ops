import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export type DateRange = {
  from: Date;
  to: Date;
  dateFrom: string;
  dateTo: string;
};

export type DailyInsightLike = {
  date: Date;
  spend?: DecimalLike;
  impressions?: number | null;
  reach?: number | null;
  clicks?: number | null;
  linkClicks?: number | null;
  landingPageViews?: number | null;
  results?: DecimalLike;
  resultType?: string | null;
  leads?: DecimalLike;
  purchases?: DecimalLike;
  purchaseValue?: DecimalLike;
};

export type PerformanceSummary = {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  results: number | null;
  resultType: string | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  roas: number | null;
  costPerResult: number | null;
};

export type DailyChartPoint = PerformanceSummary & {
  date: string;
};

function toNumber(value: DecimalLike) {
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

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(
  dateFrom?: string,
  dateTo?: string,
  fallbackDays = 13,
): DateRange {
  const today = new Date();

  const to = dateTo ? new Date(dateTo) : new Date(today);
  const from = dateFrom ? new Date(dateFrom) : new Date(today);

  if (!dateFrom) {
    from.setDate(from.getDate() - fallbackDays);
  }

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.getTime() > to.getTime()
  ) {
    throw new BadRequestException('Rango de fechas invalido');
  }

  return {
    from,
    to,
    dateFrom: formatDateOnly(from),
    dateTo: formatDateOnly(to),
  };
}

export function emptyPerformanceSummary(): PerformanceSummary {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: null,
    clicks: 0,
    linkClicks: 0,
    landingPageViews: 0,
    leads: 0,
    purchases: 0,
    purchaseValue: 0,
    results: null,
    resultType: null,
    ctr: null,
    cpc: null,
    cpm: null,
    roas: null,
    costPerResult: null,
  };
}

export function aggregatePerformance(rows: DailyInsightLike[]): PerformanceSummary {
  const summary = emptyPerformanceSummary();
  const resultTypes = new Set<string>();

  for (const row of rows) {
    summary.spend += toNumber(row.spend);
    summary.impressions += row.impressions ?? 0;
    summary.reach += row.reach ?? 0;
    summary.clicks += row.clicks ?? 0;
    summary.linkClicks += row.linkClicks ?? 0;
    summary.landingPageViews += row.landingPageViews ?? 0;
    summary.leads += toNumber(row.leads);
    summary.purchases += toNumber(row.purchases);
    summary.purchaseValue += toNumber(row.purchaseValue);

    if (row.resultType) {
      resultTypes.add(row.resultType);
    }
  }

  if (resultTypes.size === 1) {
    const resultType = [...resultTypes][0] ?? null;
    summary.resultType = resultType;
    summary.results = Number(
      rows.reduce((total, row) => total + toNumber(row.results), 0).toFixed(4),
    );
    summary.costPerResult = safeRatio(summary.spend, summary.results ?? 0);
  } else if (resultTypes.size > 1) {
    summary.resultType = 'mixed';
    summary.results = null;
    summary.costPerResult = null;
  }

  summary.ctr = safeRatio(summary.clicks, summary.impressions, 100);
  summary.cpc = safeRatio(summary.spend, summary.clicks);
  summary.cpm = safeRatio(summary.spend, summary.impressions, 1000);
  summary.frequency = safeRatio(summary.impressions, summary.reach);
  summary.roas = safeRatio(summary.purchaseValue, summary.spend);

  summary.spend = Number(summary.spend.toFixed(2));
  summary.purchaseValue = Number(summary.purchaseValue.toFixed(2));
  summary.leads = Number(summary.leads.toFixed(4));
  summary.purchases = Number(summary.purchases.toFixed(4));

  return summary;
}

export function buildDailyChart(rows: DailyInsightLike[]): DailyChartPoint[] {
  return rows.map((row) => {
    const point = aggregatePerformance([row]);

    return {
      date: formatDateOnly(row.date),
      ...point,
    };
  });
}
