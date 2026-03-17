import type { CommercialAdvisorPreparedContext } from '../domain/commercial-advisor.types';

export const COMMERCIAL_ADVISOR_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executive_summary',
    'performance_explanation',
    'decision_justifications',
    'objection_handling',
    'additional_commercial_opportunity',
    'next_phase_recommendation',
    'agency_positioning_narrative',
    'client_talking_points',
    'client_ready_summary',
  ],
  properties: {
    executive_summary: { type: 'string' },
    performance_explanation: { type: 'string' },
    decision_justifications: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['entity_id', 'entity_name', 'classification', 'justification'],
        properties: {
          entity_id: { type: 'string' },
          entity_name: { type: 'string' },
          classification: {
            type: 'string',
            enum: ['ESCALAR', 'MANTENER', 'OPTIMIZAR', 'PAUSAR'],
          },
          justification: { type: 'string' },
        },
      },
    },
    objection_handling: {
      type: 'object',
      additionalProperties: false,
      required: ['performance', 'budget'],
      properties: {
        performance: { type: 'string' },
        budget: { type: 'string' },
      },
    },
    additional_commercial_opportunity: { type: 'string' },
    next_phase_recommendation: { type: 'string' },
    agency_positioning_narrative: { type: 'string' },
    client_talking_points: {
      type: 'array',
      items: { type: 'string' },
    },
    client_ready_summary: { type: 'string' },
  },
} as const;

export function buildCommercialAdvisorSystemPrompt() {
  return `
Eres un Commercial Advisor senior para una agencia de performance.
Tu trabajo es traducir analisis tecnico a narrativa comercial clara, ejecutiva y confiable.

Reglas:
- No suenes defensivo.
- No suenes excesivamente tecnico.
- Convierte resultados en valor percibido y siguientes decisiones.
- Justifica mantener, optimizar, escalar o pausar sin atacar el trabajo previo.
- Ayuda a retencion, renovacion y upsell.
- Usa solo la evidencia del contexto entregado.
- No inventes datos ni promesas.
- Si la evidencia es debil o insuficiente, dilo con claridad y evita un tono triunfalista.
- Si predominan decisiones de optimizacion o pausa, no maquilles el rendimiento como si fuera una victoria.
- Devuelve solo JSON valido.
  `.trim();
}

export function buildCommercialAdvisorPrompt(
  context: CommercialAdvisorPreparedContext,
) {
  return `
Genera una pieza de advisory comercial y ejecutiva para cliente final.
No uses markdown.
No agregues campos extra.

Contexto:
${JSON.stringify(context, null, 2)}
  `.trim();
}
