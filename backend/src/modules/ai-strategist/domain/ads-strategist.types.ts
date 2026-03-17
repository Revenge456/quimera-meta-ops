import type { PerformanceSummary } from '../../shared/utils/performance-metrics';
import type { NormalizedAnalysisContext } from '../../shared/utils/analysis-context';

export type StrategistLevel = 'campaign' | 'ad_set' | 'ad';
export type StrategistClassification =
  | 'ESCALAR'
  | 'MANTENER'
  | 'OPTIMIZAR'
  | 'PAUSAR';
export type StrategistConfidence = 'ALTA' | 'MEDIA' | 'BAJA';

export type StrategistFilters = {
  status?: string;
  adAccountId?: string;
  campaignId?: string;
  adSetId?: string;
  search?: string;
};

export type StrategistDailySeriesPoint = PerformanceSummary & {
  date: string;
};

export type StrategistEntityRecord = {
  entity_id: string;
  entity_name: string;
  level: StrategistLevel;
  status: string | null;
  ad_account_id: string;
  ad_account_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_set_id: string | null;
  ad_set_name: string | null;
  main_metrics: PerformanceSummary;
  daily_series: StrategistDailySeriesPoint[];
};

export type StrategistTrendDirection =
  | 'MEJORA'
  | 'ESTABLE'
  | 'DETERIORO'
  | 'SIN_DATO';

export type StrategistPreparedEntity = StrategistEntityRecord & {
  trend: {
    direction: StrategistTrendDirection;
    summary: string;
    signals: string[];
  };
  data_sufficiency: {
    has_enough_data: boolean;
    confidence_hint: StrategistConfidence;
    evidence_flags: string[];
  };
  strategic_hints: {
    classification_hint: StrategistClassification;
    detected_issues: string[];
    opportunities: string[];
    business_context: string[];
    result_consistency: 'CONSISTENT' | 'MIXED' | 'NO_RESULT';
    concentration_share: number | null;
  };
  prompt_series: StrategistDailySeriesPoint[];
};

export type StrategistPreparedContext = {
  client: {
    id: string;
    nombre: string;
    empresa: string;
  };
  level: StrategistLevel;
  date_from: string;
  date_to: string;
  entities_total: number;
  entities_analyzed: number;
  entities_truncated: boolean;
  portfolio_summary: PerformanceSummary & {
    dominant_result_type: string | null;
    concentration_risk: boolean;
    concentration_share_top_3: number;
  };
  global_hints: {
    key_findings: string[];
    risks_detected: string[];
    next_tests: string[];
  };
  entities: StrategistPreparedEntity[];
};

export type StrategistResponse = {
  executive_summary: string;
  key_findings: string[];
  entity_analysis: Array<{
    entity_id: string;
    entity_name: string;
    level: StrategistLevel;
    classification: StrategistClassification;
    confidence: StrategistConfidence;
    reasoning: string;
    main_metrics: {
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number | null;
      cpc: number | null;
      cpm: number | null;
      roas: number | null;
      results: number | null;
      result_type: string | 'mixed' | null;
    };
    detected_issues: string[];
    opportunities: string[];
    recommended_actions: string[];
  }>;
  global_recommendations: string[];
  risks_detected: string[];
  next_tests: string[];
  client_summary: string;
};

export type StrategistHistorySummary = {
  id: string;
  client: {
    id: string;
    nombre: string;
    empresa: string;
  };
  generated_by: {
    id: string;
    nombre: string;
    email: string;
  } | null;
  level: StrategistLevel;
  date_from: string;
  date_to: string;
  generated_at: string;
  filters: StrategistFilters;
  context_hash: string | null;
  context_normalized: NormalizedAnalysisContext | null;
  exact_context_match?: boolean;
  executive_summary: string;
  entities_analyzed: number;
};

export type StrategistHistoryDetail = StrategistHistorySummary & {
  context_snapshot: StrategistPreparedContext | null;
  output: StrategistResponse;
};
