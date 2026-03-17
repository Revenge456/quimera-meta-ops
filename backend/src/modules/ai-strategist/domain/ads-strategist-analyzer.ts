import { Injectable } from '@nestjs/common';

import { aggregatePerformance } from '../../shared/utils/performance-metrics';
import type {
  StrategistClassification,
  StrategistConfidence,
  StrategistPreparedContext,
  StrategistPreparedEntity,
  StrategistEntityRecord,
  StrategistTrendDirection,
} from './ads-strategist.types';

const MIN_SPEND_FOR_CONFIDENCE = 150;
const MIN_CLICKS_FOR_CONFIDENCE = 25;
const MIN_RESULTS_FOR_CONFIDENCE = 3;
const MAX_SERIES_POINTS_FOR_PROMPT = 31;

@Injectable()
export class AdsStrategistAnalyzer {
  buildContext(params: {
    client: {
      id: string;
      nombre: string;
      empresa: string;
    };
    level: StrategistPreparedContext['level'];
    dateFrom: string;
    dateTo: string;
    entities: StrategistEntityRecord[];
    maxEntities: number;
  }): StrategistPreparedContext {
    const sortedEntities = [...params.entities].sort(
      (left, right) => right.main_metrics.spend - left.main_metrics.spend,
    );
    const selectedEntities = sortedEntities.slice(0, params.maxEntities);
    const totalSpend = selectedEntities.reduce(
      (sum, entity) => sum + entity.main_metrics.spend,
      0,
    );

    const preparedEntities = selectedEntities.map((entity) =>
      this.prepareEntity(entity, totalSpend),
    );

    const top3Spend = preparedEntities
      .slice(0, 3)
      .reduce((sum, entity) => sum + entity.main_metrics.spend, 0);
    const concentrationShareTop3 = totalSpend
      ? Number((top3Spend / totalSpend).toFixed(4))
      : 0;

    const portfolioSummary = aggregatePerformance(
      preparedEntities.flatMap((entity) =>
        entity.daily_series.map((row) => ({
          date: new Date(row.date),
          spend: row.spend,
          impressions: row.impressions,
          reach: row.reach,
          clicks: row.clicks,
          linkClicks: row.linkClicks,
          landingPageViews: row.landingPageViews,
          results: row.results,
          resultType: row.resultType,
          leads: row.leads,
          purchases: row.purchases,
          purchaseValue: row.purchaseValue,
        })),
      ),
    );

    const dominantResultTypes = new Set(
      preparedEntities
        .map((entity) => entity.main_metrics.resultType)
        .filter((value): value is string => Boolean(value) && value !== 'mixed'),
    );

    return {
      client: params.client,
      level: params.level,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      entities_total: params.entities.length,
      entities_analyzed: preparedEntities.length,
      entities_truncated: params.entities.length > preparedEntities.length,
      portfolio_summary: {
        ...portfolioSummary,
        dominant_result_type:
          dominantResultTypes.size === 1
            ? [...dominantResultTypes][0] ?? null
            : dominantResultTypes.size > 1
              ? 'mixed'
              : null,
        concentration_risk: concentrationShareTop3 >= 0.8,
        concentration_share_top_3: concentrationShareTop3,
      },
      global_hints: this.buildGlobalHints(preparedEntities, concentrationShareTop3),
      entities: preparedEntities,
    };
  }

  private prepareEntity(
    entity: StrategistEntityRecord,
    totalSpend: number,
  ): StrategistPreparedEntity {
    const dataSufficiency = this.evaluateDataSufficiency(entity.main_metrics);
    const trend = this.buildTrend(entity.daily_series);
    const strategicHints = this.buildStrategicHints(
      entity.main_metrics,
      dataSufficiency,
      trend.direction,
      totalSpend,
      entity,
    );

    return {
      ...entity,
      trend,
      data_sufficiency: dataSufficiency,
      strategic_hints: strategicHints,
      prompt_series: this.trimSeriesForPrompt(entity.daily_series),
    };
  }

  private evaluateDataSufficiency(
    metrics: StrategistEntityRecord['main_metrics'],
  ): StrategistPreparedEntity['data_sufficiency'] {
    const evidenceFlags: string[] = [];

    if (metrics.spend < MIN_SPEND_FOR_CONFIDENCE) {
      evidenceFlags.push('low_spend');
    }

    if (metrics.clicks < MIN_CLICKS_FOR_CONFIDENCE) {
      evidenceFlags.push('low_clicks');
    }

    if ((metrics.results ?? 0) < MIN_RESULTS_FOR_CONFIDENCE) {
      evidenceFlags.push('low_results');
    }

    if (!metrics.impressions) {
      evidenceFlags.push('no_delivery');
    }

    if (metrics.resultType === 'mixed') {
      evidenceFlags.push('mixed_result_type');
    }

    const hasEnoughData =
      metrics.spend >= MIN_SPEND_FOR_CONFIDENCE &&
      (metrics.clicks >= MIN_CLICKS_FOR_CONFIDENCE || (metrics.results ?? 0) >= 1);

    let confidenceHint: StrategistConfidence = hasEnoughData ? 'MEDIA' : 'BAJA';

    if (
      hasEnoughData &&
      metrics.spend >= MIN_SPEND_FOR_CONFIDENCE * 2 &&
      metrics.clicks >= MIN_CLICKS_FOR_CONFIDENCE * 2 &&
      (metrics.resultType === null || metrics.resultType !== 'mixed')
    ) {
      confidenceHint = 'ALTA';
    }

    if (metrics.resultType === 'mixed' && confidenceHint === 'ALTA') {
      confidenceHint = 'MEDIA';
    }

    return {
      has_enough_data: hasEnoughData,
      confidence_hint: confidenceHint,
      evidence_flags: evidenceFlags,
    };
  }

  private buildTrend(
    series: StrategistEntityRecord['daily_series'],
  ): StrategistPreparedEntity['trend'] {
    if (series.length < 4) {
      return {
        direction: 'SIN_DATO',
        summary: 'El periodo no tiene suficientes puntos diarios para estimar tendencia.',
        signals: ['serie_diaria_insuficiente'],
      };
    }

    const midpoint = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, midpoint);
    const secondHalf = series.slice(midpoint);

    const firstSummary = aggregatePerformance(
      firstHalf.map((row) => ({
        date: new Date(row.date),
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        linkClicks: row.linkClicks,
        landingPageViews: row.landingPageViews,
        results: row.results,
        resultType: row.resultType,
        leads: row.leads,
        purchases: row.purchases,
        purchaseValue: row.purchaseValue,
      })),
    );
    const secondSummary = aggregatePerformance(
      secondHalf.map((row) => ({
        date: new Date(row.date),
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        linkClicks: row.linkClicks,
        landingPageViews: row.landingPageViews,
        results: row.results,
        resultType: row.resultType,
        leads: row.leads,
        purchases: row.purchases,
        purchaseValue: row.purchaseValue,
      })),
    );

    const signals: string[] = [];
    let score = 0;

    score += this.compareDirectionalMetric(
      firstSummary.ctr,
      secondSummary.ctr,
      true,
      'ctr_mejora',
      'ctr_caida',
      signals,
    );
    score += this.compareDirectionalMetric(
      firstSummary.cpc,
      secondSummary.cpc,
      false,
      'cpc_mejora',
      'cpc_empeora',
      signals,
    );
    score += this.compareDirectionalMetric(
      firstSummary.results,
      secondSummary.results,
      true,
      'resultados_mejoran',
      'resultados_caen',
      signals,
    );
    score += this.compareDirectionalMetric(
      firstSummary.roas,
      secondSummary.roas,
      true,
      'roas_mejora',
      'roas_caida',
      signals,
    );

    let direction: StrategistTrendDirection = 'ESTABLE';
    if (score >= 2) {
      direction = 'MEJORA';
    } else if (score <= -2) {
      direction = 'DETERIORO';
    }

    const summary =
      direction === 'MEJORA'
        ? 'La segunda mitad del periodo muestra senales de mejora frente a la primera.'
        : direction === 'DETERIORO'
          ? 'La segunda mitad del periodo muestra deterioro frente a la primera.'
          : 'La lectura del periodo es relativamente estable o mixta.';

    return {
      direction,
      summary,
      signals,
    };
  }

  private compareDirectionalMetric(
    previous: number | null,
    current: number | null,
    higherIsBetter: boolean,
    positiveSignal: string,
    negativeSignal: string,
    signals: string[],
  ) {
    if (previous === null || current === null || previous === 0) {
      return 0;
    }

    const delta = (current - previous) / Math.abs(previous);
    if (delta >= 0.15) {
      signals.push(higherIsBetter ? positiveSignal : negativeSignal);
      return higherIsBetter ? 1 : -1;
    }

    if (delta <= -0.15) {
      signals.push(higherIsBetter ? negativeSignal : positiveSignal);
      return higherIsBetter ? -1 : 1;
    }

    return 0;
  }

  private buildStrategicHints(
    metrics: StrategistEntityRecord['main_metrics'],
    dataSufficiency: StrategistPreparedEntity['data_sufficiency'],
    trendDirection: StrategistTrendDirection,
    totalSpend: number,
    entity: StrategistEntityRecord,
  ): StrategistPreparedEntity['strategic_hints'] {
    const detectedIssues: string[] = [];
    const opportunities: string[] = [];
    const businessContext: string[] = [];

    if (metrics.ctr !== null && metrics.ctr < 1 && metrics.impressions >= 1000) {
      detectedIssues.push(
        'CTR bajo para el volumen servido, lo que apunta a fatiga creativa o mensaje poco atractivo.',
      );
      businessContext.push(
        'Una atraccion creativa debil reduce la eficiencia del gasto antes de llegar a la conversion.',
      );
    }

    if (metrics.cpc !== null && metrics.cpc > 2.5 && metrics.clicks >= 25) {
      detectedIssues.push(
        'CPC alto con suficiente volumen de clics, senal de subasta cara o segmentacion poco eficiente.',
      );
      businessContext.push(
        'El costo de entrada al funnel esta presionando el margen de la cuenta.',
      );
    }

    if (metrics.frequency !== null && metrics.frequency >= 2.8 && metrics.impressions >= 500) {
      detectedIssues.push(
        'Frecuencia alta en relacion con el alcance, indicio de saturacion o fatiga creativa.',
      );
      opportunities.push(
        'Probar nuevas creatividades o refrescar angulos de mensaje para recuperar eficiencia.',
      );
    }

    if (
      metrics.ctr !== null &&
      metrics.ctr >= 1.2 &&
      metrics.clicks >= 30 &&
      (metrics.results ?? 0) === 0
    ) {
      detectedIssues.push(
        'Hay interes en el anuncio pero no se traduce en resultados, lo que sugiere friccion post-click o trafico de baja calidad.',
      );
      opportunities.push(
        'Revisar landing, evento de conversion y coherencia entre promesa creativa y oferta.',
      );
    }

    if (metrics.roas !== null && metrics.roas < 1 && metrics.spend >= 150) {
      detectedIssues.push(
        'ROAS por debajo de equilibrio con gasto relevante, senal de que el funnel final no devuelve valor suficiente.',
      );
      businessContext.push(
        'Escalar con esta eficiencia destruye retorno y consume presupuesto util para mejores lineas.',
      );
    }

    if (metrics.spend >= 100 && metrics.clicks < 10) {
      detectedIssues.push(
        'El gasto no esta generando volumen de clics, lo que sugiere problema de delivery, setup o atractivo insuficiente.',
      );
    }

    if (trendDirection === 'DETERIORO') {
      detectedIssues.push(
        'La tendencia del periodo muestra deterioro, por lo que el problema ya no es puntual sino sostenido.',
      );
    }

    if (
      metrics.roas !== null &&
      metrics.roas >= 2 &&
      dataSufficiency.has_enough_data &&
      trendDirection !== 'DETERIORO'
    ) {
      opportunities.push(
        'La eficiencia final es positiva y con suficiente volumen para evaluar incremento controlado de presupuesto.',
      );
    }

    if (
      metrics.ctr !== null &&
      metrics.ctr >= 1.5 &&
      (metrics.results ?? 0) >= 3 &&
      trendDirection === 'MEJORA'
    ) {
      opportunities.push(
        'La combinacion de atraccion y tendencia positiva justifica tests de escala gradual sin perder control.',
      );
    }

    const concentrationShare = totalSpend
      ? Number((metrics.spend / totalSpend).toFixed(4))
      : null;

    if (concentrationShare !== null && concentrationShare >= 0.4) {
      businessContext.push(
        'La entidad concentra una porcion material del gasto del periodo y cualquier deterioro impacta de forma desproporcionada al cliente.',
      );
    }

    let classificationHint: StrategistClassification = 'MANTENER';

    if (!dataSufficiency.has_enough_data) {
      classificationHint = 'MANTENER';
    } else if (
      ((metrics.results ?? 0) === 0 && metrics.spend >= 200 && metrics.clicks >= 25) ||
      (metrics.roas !== null && metrics.roas < 0.8 && metrics.spend >= 150) ||
      trendDirection === 'DETERIORO'
    ) {
      classificationHint = 'PAUSAR';
    } else if (
      metrics.roas !== null &&
      metrics.roas >= 2 &&
      (metrics.results ?? 0) >= 3
    ) {
      classificationHint = 'ESCALAR';
    } else if (
      detectedIssues.length > 0 ||
      metrics.resultType === 'mixed' ||
      trendDirection === 'ESTABLE'
    ) {
      classificationHint = 'OPTIMIZAR';
    }

    if (
      detectedIssues.length === 0 &&
      opportunities.length === 0 &&
      classificationHint === 'OPTIMIZAR'
    ) {
      classificationHint = 'MANTENER';
    }

    return {
      classification_hint: classificationHint,
      detected_issues: detectedIssues,
      opportunities,
      business_context: businessContext,
      result_consistency:
        entity.main_metrics.resultType === 'mixed'
          ? 'MIXED'
          : entity.main_metrics.resultType
            ? 'CONSISTENT'
            : 'NO_RESULT',
      concentration_share: concentrationShare,
    };
  }

  private buildGlobalHints(
    entities: StrategistPreparedEntity[],
    concentrationShareTop3: number,
  ): StrategistPreparedContext['global_hints'] {
    if (entities.length === 0) {
      return {
        key_findings: ['No hay entidades con datos suficientes para analizar.'],
        risks_detected: [],
        next_tests: ['Verificar filtros o ampliar el rango del analisis.'],
      };
    }

    const lowConfidence = entities.filter(
      (entity) => entity.data_sufficiency.confidence_hint === 'BAJA',
    ).length;
    const deteriorating = entities.filter(
      (entity) => entity.trend.direction === 'DETERIORO',
    ).length;
    const mixedResults = entities.filter(
      (entity) => entity.main_metrics.resultType === 'mixed',
    ).length;

    const keyFindings = [
      `${entities.length} entidades incluidas en el analisis estrategico.`,
      `${lowConfidence} entidades tienen evidencia insuficiente o debil para decisiones agresivas.`,
    ];

    const risksDetected = [
      ...(deteriorating > 0
        ? [`${deteriorating} entidades muestran deterioro dentro del periodo.`]
        : []),
      ...(mixedResults > 0
        ? [`${mixedResults} entidades mezclan tipos de resultado y reducen la confianza del analisis.`]
        : []),
      ...(concentrationShareTop3 >= 0.8
        ? ['El gasto esta concentrado en pocas entidades y aumenta el riesgo de dependencia.']
        : []),
    ];

    const nextTests = [
      'Validar creatividades nuevas en entidades con CTR debil o frecuencia elevada.',
      'Separar hipotesis de trafico vs. conversion cuando hay buen CTR sin resultados.',
    ];

    return {
      key_findings: keyFindings,
      risks_detected: risksDetected,
      next_tests: nextTests,
    };
  }

  private trimSeriesForPrompt(series: StrategistEntityRecord['daily_series']) {
    if (series.length <= MAX_SERIES_POINTS_FOR_PROMPT) {
      return series;
    }

    const trimmed: StrategistEntityRecord['daily_series'] = [];
    const step = (series.length - 1) / (MAX_SERIES_POINTS_FOR_PROMPT - 1);

    for (let index = 0; index < MAX_SERIES_POINTS_FOR_PROMPT; index += 1) {
      const sourceIndex = Math.round(index * step);
      trimmed.push(series[sourceIndex] ?? series[series.length - 1]!);
    }

    return trimmed;
  }
}
