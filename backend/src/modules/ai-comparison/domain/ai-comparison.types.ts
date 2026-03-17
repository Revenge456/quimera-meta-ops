import type {
  StrategistClassification,
  StrategistLevel,
  StrategistResponse,
} from '../../ai-strategist/domain/ads-strategist.types';

export type ComparisonChangeType =
  | 'IMPROVED'
  | 'WORSENED'
  | 'STABLE'
  | 'NEW'
  | 'REMOVED';

export type StrategistComparisonAnalysis = {
  id: string;
  client: {
    id: string;
    nombre: string;
    empresa: string;
  };
  level: StrategistLevel;
  date_from: string;
  date_to: string;
  generated_at: string;
  context_hash: string | null;
  output: StrategistResponse;
};

export type EntityComparisonInput = {
  entity_id: string;
  entity_name: string;
  level: StrategistLevel;
  previous_classification: StrategistClassification | null;
  current_classification: StrategistClassification;
  change_type: ComparisonChangeType;
  metric_deltas: {
    spend?: number;
    ctr?: number | null;
    cpc?: number | null;
    roas?: number | null;
    results?: number | null;
  };
  current_metrics: StrategistResponse['entity_analysis'][number]['main_metrics'] | null;
  previous_metrics: StrategistResponse['entity_analysis'][number]['main_metrics'] | null;
};

export type AiComparisonPreparedContext = {
  client: {
    id: string;
    nombre: string;
    empresa: string;
  };
  level: StrategistLevel;
  comparison_basis: {
    current_analysis_id: string;
    previous_analysis_id: string;
    current_generated_at: string;
    previous_generated_at: string;
    current_period: {
      date_from: string;
      date_to: string;
    };
    previous_period: {
      date_from: string;
      date_to: string;
    };
    context_hash: string | null;
  };
  portfolio_delta: {
    spend: number;
    ctr: number | null;
    cpc: number | null;
    roas: number | null;
    results: number | null;
  };
  classification_changes: {
    improved: number;
    worsened: number;
    stable: number;
    new_entities: number;
    removed_entities: number;
  };
  entities: EntityComparisonInput[];
};

export type AiComparisonResponse = {
  comparison_basis: {
    current_analysis_id: string;
    previous_analysis_id: string | null;
    match_type: 'EXACT_MATCH' | 'CONTEXT_SIMILAR' | 'NO_PREVIOUS';
    context_hash: string | null;
  };
  summary: string;
  key_changes: string[];
  entity_differences: Array<{
    entity_id: string;
    entity_name: string;
    level: StrategistLevel;
    previous_classification: StrategistClassification | null;
    current_classification: StrategistClassification;
    change_type: ComparisonChangeType;
    metric_deltas: {
      spend?: number;
      ctr?: number | null;
      cpc?: number | null;
      roas?: number | null;
      results?: number | null;
    };
    insight: string;
  }>;
  improvements: string[];
  deteriorations: string[];
  new_opportunities: string[];
  risks_detected: string[];
  recommended_actions: string[];
};
