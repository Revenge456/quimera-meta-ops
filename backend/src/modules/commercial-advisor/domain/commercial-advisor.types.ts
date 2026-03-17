import type {
  StrategistClassification,
  StrategistLevel,
  StrategistResponse,
} from '../../ai-strategist/domain/ads-strategist.types';
import type { NormalizedAnalysisContext } from '../../shared/utils/analysis-context';

export type CommercialAdvisorFilters = {
  status?: string;
  adAccountId?: string;
  campaignId?: string;
  adSetId?: string;
  search?: string;
};

export type CommercialAdvisorResponse = {
  executive_summary: string;
  performance_explanation: string;
  decision_justifications: Array<{
    entity_id: string;
    entity_name: string;
    classification: StrategistClassification;
    justification: string;
  }>;
  objection_handling: {
    performance: string;
    budget: string;
  };
  additional_commercial_opportunity: string;
  next_phase_recommendation: string;
  agency_positioning_narrative: string;
  client_talking_points: string[];
  client_ready_summary: string;
};

export type CommercialAdvisorPreparedContext = {
  client: {
    id: string;
    nombre: string;
    empresa: string;
  };
  period: {
    date_from: string;
    date_to: string;
  };
  level: StrategistLevel;
  strategist_summary: {
    executive_summary: string;
    client_summary: string;
    key_findings: string[];
    global_recommendations: string[];
    risks_detected: string[];
    next_tests: string[];
  };
  classifications_summary: Record<StrategistClassification, number>;
  top_entities: StrategistResponse['entity_analysis'];
};

export type CommercialAdvisorHistorySummary = {
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
  filters: CommercialAdvisorFilters;
  context_hash: string | null;
  context_normalized: NormalizedAnalysisContext | null;
  exact_context_match?: boolean;
  executive_summary: string;
  client_ready_summary: string;
  strategist_analysis_id: string | null;
};

export type CommercialAdvisorHistoryDetail = CommercialAdvisorHistorySummary & {
  output: CommercialAdvisorResponse;
  strategist_output_snapshot: StrategistResponse | null;
};
