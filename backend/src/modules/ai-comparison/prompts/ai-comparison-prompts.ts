import type { AiComparisonPreparedContext } from '../domain/ai-comparison.types';

export const AI_COMPARISON_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'comparison_basis',
    'summary',
    'key_changes',
    'entity_differences',
    'improvements',
    'deteriorations',
    'new_opportunities',
    'risks_detected',
    'recommended_actions',
  ],
  properties: {
    comparison_basis: {
      type: 'object',
      additionalProperties: false,
      required: [
        'current_analysis_id',
        'previous_analysis_id',
        'match_type',
        'context_hash',
      ],
      properties: {
        current_analysis_id: { type: 'string' },
        previous_analysis_id: { type: ['string', 'null'] },
        match_type: {
          type: 'string',
          enum: ['EXACT_MATCH', 'CONTEXT_SIMILAR', 'NO_PREVIOUS'],
        },
        context_hash: { type: ['string', 'null'] },
      },
    },
    summary: { type: 'string' },
    key_changes: {
      type: 'array',
      items: { type: 'string' },
    },
    entity_differences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'entity_id',
          'entity_name',
          'level',
          'previous_classification',
          'current_classification',
          'change_type',
          'metric_deltas',
          'insight',
        ],
        properties: {
          entity_id: { type: 'string' },
          entity_name: { type: 'string' },
          level: {
            type: 'string',
            enum: ['campaign', 'ad_set', 'ad'],
          },
          previous_classification: {
            type: ['string', 'null'],
            enum: ['ESCALAR', 'MANTENER', 'OPTIMIZAR', 'PAUSAR', null],
          },
          current_classification: {
            type: 'string',
            enum: ['ESCALAR', 'MANTENER', 'OPTIMIZAR', 'PAUSAR'],
          },
          change_type: {
            type: 'string',
            enum: ['IMPROVED', 'WORSENED', 'STABLE', 'NEW', 'REMOVED'],
          },
          metric_deltas: {
            type: 'object',
            additionalProperties: false,
            properties: {
              spend: { type: 'number' },
              ctr: { type: ['number', 'null'] },
              cpc: { type: ['number', 'null'] },
              roas: { type: ['number', 'null'] },
              results: { type: ['number', 'null'] },
            },
          },
          insight: { type: 'string' },
        },
      },
    },
    improvements: {
      type: 'array',
      items: { type: 'string' },
    },
    deteriorations: {
      type: 'array',
      items: { type: 'string' },
    },
    new_opportunities: {
      type: 'array',
      items: { type: 'string' },
    },
    risks_detected: {
      type: 'array',
      items: { type: 'string' },
    },
    recommended_actions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

export function buildAiComparisonSystemPrompt() {
  return `
Eres un Ads Strategist senior especializado en detectar cambios relevantes entre analisis historicos.
Tu trabajo es interpretar evolucion real, no describir datos sin criterio.

Reglas criticas:
- Usa solo la evidencia entregada por el backend.
- No inventes datos ni exageres cambios menores.
- Prioriza deterioros, mejoras y cambios de clasificacion con impacto de negocio.
- Si un cambio es pequeno o ambiguo, manten el tono prudente.
- Si una entidad es nueva o removida, explica por que importa operativamente.
- Devuelve solo JSON valido, sin markdown ni texto extra.
  `.trim();
}

export function buildAiComparisonPrompt(context: AiComparisonPreparedContext) {
  return `
Compara estos dos analisis historicos del mismo cliente y devuelve solo JSON valido.

Contexto estructurado:
${JSON.stringify(context, null, 2)}
  `.trim();
}
