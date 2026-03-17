import type { StrategistPreparedContext } from '../domain/ads-strategist.types';

export const ADS_STRATEGIST_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executive_summary',
    'key_findings',
    'entity_analysis',
    'global_recommendations',
    'risks_detected',
    'next_tests',
    'client_summary',
  ],
  properties: {
    executive_summary: { type: 'string' },
    key_findings: {
      type: 'array',
      items: { type: 'string' },
    },
    entity_analysis: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'entity_id',
          'entity_name',
          'level',
          'classification',
          'confidence',
          'reasoning',
          'main_metrics',
          'detected_issues',
          'opportunities',
          'recommended_actions',
        ],
        properties: {
          entity_id: { type: 'string' },
          entity_name: { type: 'string' },
          level: {
            type: 'string',
            enum: ['campaign', 'ad_set', 'ad'],
          },
          classification: {
            type: 'string',
            enum: ['ESCALAR', 'MANTENER', 'OPTIMIZAR', 'PAUSAR'],
          },
          confidence: {
            type: 'string',
            enum: ['ALTA', 'MEDIA', 'BAJA'],
          },
          reasoning: { type: 'string' },
          main_metrics: {
            type: 'object',
            additionalProperties: false,
            required: [
              'spend',
              'impressions',
              'clicks',
              'ctr',
              'cpc',
              'cpm',
              'roas',
              'results',
              'result_type',
            ],
            properties: {
              spend: { type: 'number' },
              impressions: { type: 'number' },
              clicks: { type: 'number' },
              ctr: { type: ['number', 'null'] },
              cpc: { type: ['number', 'null'] },
              cpm: { type: ['number', 'null'] },
              roas: { type: ['number', 'null'] },
              results: { type: ['number', 'null'] },
              result_type: { type: ['string', 'null'] },
            },
          },
          detected_issues: {
            type: 'array',
            items: { type: 'string' },
          },
          opportunities: {
            type: 'array',
            items: { type: 'string' },
          },
          recommended_actions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    global_recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
    risks_detected: {
      type: 'array',
      items: { type: 'string' },
    },
    next_tests: {
      type: 'array',
      items: { type: 'string' },
    },
    client_summary: { type: 'string' },
  },
} as const;

export function buildAdsStrategistSystemPrompt() {
  return `
Eres un Ads Strategist senior de performance para un equipo interno.
Tu funcion es priorizar decisiones, auditar riesgos y detectar oportunidades reales.

Reglas criticas:
- Usa solo la evidencia entregada por el backend.
- No inventes datos, no cambies metricas, no supongas causas sin evidencia.
- No declares ganadores con bajo spend, pocos clics o muestra debil.
- Si la data es insuficiente, dilo explicitamente y baja la confianza.
- Si result_type es "mixed", no consolides resultados como si fueran homogeneos.
- La salida debe ser JSON valido, sin markdown y sin texto fuera del JSON.
- Clasifica cada entidad obligatoriamente en ESCALAR, MANTENER, OPTIMIZAR o PAUSAR.
- Piensa como estratega senior: interpreta implicancias de negocio y performance, no describas numeros sueltos.
  `.trim();
}

export function buildAdsStrategistOutputFormatterPrompt() {
  return `
Devuelve estrictamente la estructura JSON pedida.
No agregues campos extra.
No omitas ninguna entidad incluida en "entities".
La confianza debe reflejar suficiencia de datos y consistencia de resultados.
  `.trim();
}

export function buildAdsStrategistAnalysisPrompt(
  context: StrategistPreparedContext,
) {
  return `
Analiza este cliente con criterio de estratega senior y devuelve solo JSON valido.

${buildAdsStrategistOutputFormatterPrompt()}

Contexto estructurado:
${JSON.stringify(context, null, 2)}
  `.trim();
}
