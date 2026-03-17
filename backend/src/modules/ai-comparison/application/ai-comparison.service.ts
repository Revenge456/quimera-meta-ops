import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import { AiLlmService } from '../../ai-strategist/application/ai-llm.service';
import type {
  StrategistClassification,
  StrategistResponse,
} from '../../ai-strategist/domain/ads-strategist.types';
import { SystemLogService } from '../../logging/application/system-log.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AiComparisonRepository } from '../data/ai-comparison.repository';
import type {
  AiComparisonPreparedContext,
  AiComparisonResponse,
  ComparisonChangeType,
  EntityComparisonInput,
  StrategistComparisonAnalysis,
} from '../domain/ai-comparison.types';
import {
  AI_COMPARISON_OUTPUT_SCHEMA,
  buildAiComparisonPrompt,
  buildAiComparisonSystemPrompt,
} from '../prompts/ai-comparison-prompts';

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});
addFormats(ajv);
const comparisonValidator = ajv.compile(
  AI_COMPARISON_OUTPUT_SCHEMA,
) as ValidateFunction<AiComparisonResponse>;

const classificationRank: Record<StrategistClassification, number> = {
  PAUSAR: 0,
  OPTIMIZAR: 1,
  MANTENER: 2,
  ESCALAR: 3,
};

@Injectable()
export class AiComparisonService {
  constructor(
    private readonly repository: AiComparisonRepository,
    private readonly aiLlmService: AiLlmService,
    private readonly systemLogService: SystemLogService,
  ) {}

  async compare(
    actor: AuthUser,
    params: {
      currentAnalysisId: string;
      previousAnalysisId?: string;
      contextHash?: string;
    },
  ): Promise<AiComparisonResponse> {
    if (!['admin', 'commercial_manager'].includes(actor.role)) {
      throw new ForbiddenException();
    }

    const current = await this.repository.getAccessibleAnalysisById(
      actor,
      params.currentAnalysisId,
    );

    const previous = await this.repository.findPreviousAnalysis(actor, {
      current,
      previousAnalysisId: params.previousAnalysisId,
      contextHash: params.contextHash,
    });

    if (!previous) {
      return {
        comparison_basis: {
          current_analysis_id: current.id,
          previous_analysis_id: null,
          match_type: 'NO_PREVIOUS',
          context_hash: params.contextHash ?? current.context_hash,
        },
        summary:
          'No existe un analisis previo compatible para comparar este strategist en el tiempo.',
        key_changes: [
          'Todavia no hay una referencia historica comparable para este contexto.',
        ],
        entity_differences: [],
        improvements: [],
        deteriorations: [],
        new_opportunities: [
          'Generar una nueva corrida futura del mismo contexto para habilitar comparacion evolutiva.',
        ],
        risks_detected: [],
        recommended_actions: [
          'Mantener el mismo contexto de analisis y volver a comparar cuando exista una corrida previa compatible.',
        ],
      };
    }

    if (current.client.id !== previous.client.id) {
      throw new BadRequestException(
        'Solo se pueden comparar analisis del mismo cliente',
      );
    }

    if (current.level !== previous.level) {
      throw new BadRequestException(
        'Solo se pueden comparar analisis del mismo nivel',
      );
    }

    const prepared = this.buildPreparedContext(current, previous);

    await this.systemLogService.log({
      level: 'info',
      module: 'ai-comparison',
      eventName: 'comparison_started',
      message: 'Inicio de comparacion de strategist historicos',
      metadata: {
        currentAnalysisId: current.id,
        previousAnalysisId: previous.id,
        clientId: current.client.id,
        level: current.level,
      },
    });

    const systemPrompt = buildAiComparisonSystemPrompt();
    const userPrompt = buildAiComparisonPrompt(prepared);
    let lastErrorMessage = 'Salida invalida del LLM';

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const rawOutput = await this.aiLlmService.generateStructuredJson({
        systemPrompt,
        userPrompt,
        schemaName: 'ai_comparison_output',
        schema: AI_COMPARISON_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
      });

      const candidateOutput = {
        ...(rawOutput as Record<string, unknown>),
        comparison_basis: {
          current_analysis_id: prepared.comparison_basis.current_analysis_id,
          previous_analysis_id: prepared.comparison_basis.previous_analysis_id,
          match_type: this.resolveMatchType(current, previous, params.contextHash),
          context_hash: prepared.comparison_basis.context_hash,
        },
      };

      const validation = this.validateOutput(candidateOutput, prepared);
      if (validation.ok) {
        const normalized = this.normalizeOutput(
          validation.value,
          prepared,
          this.resolveMatchType(current, previous, params.contextHash),
        );

        await this.systemLogService.log({
          level: 'info',
          module: 'ai-comparison',
          eventName: 'comparison_succeeded',
          message: 'Comparacion historica completada',
          metadata: {
            currentAnalysisId: current.id,
            previousAnalysisId: previous.id,
            clientId: current.client.id,
            level: current.level,
            attempt,
          },
        });

        return normalized;
      }

      lastErrorMessage = validation.error;

      await this.systemLogService.log({
        level: 'warn',
        module: 'ai-comparison',
        eventName: 'comparison_invalid_retry',
        message: 'La salida de comparacion no cumplio contrato y se reintentara',
        metadata: {
          currentAnalysisId: current.id,
          previousAnalysisId: previous.id,
          attempt,
          error: validation.error,
        },
      });
    }

    await this.systemLogService.log({
      level: 'error',
      module: 'ai-comparison',
      eventName: 'comparison_failed',
      message: 'La comparacion historica fallo por salida invalida del LLM',
      metadata: {
        currentAnalysisId: current.id,
        previousAnalysisId: previous.id,
        error: lastErrorMessage,
      },
    });

    throw new BadGatewayException(
      `El LLM no devolvio una comparacion valida tras reintento: ${lastErrorMessage}`,
    );
  }

  private buildPreparedContext(
    current: StrategistComparisonAnalysis,
    previous: StrategistComparisonAnalysis,
  ): AiComparisonPreparedContext {
    const previousById = new Map(
      previous.output.entity_analysis.map((entity) => [entity.entity_id, entity]),
    );
    const currentById = new Map(
      current.output.entity_analysis.map((entity) => [entity.entity_id, entity]),
    );

    const entityIds = new Set([
      ...previous.output.entity_analysis.map((entity) => entity.entity_id),
      ...current.output.entity_analysis.map((entity) => entity.entity_id),
    ]);

    const entities: EntityComparisonInput[] = [];
    const classificationChanges = {
      improved: 0,
      worsened: 0,
      stable: 0,
      new_entities: 0,
      removed_entities: 0,
    };

    for (const entityId of entityIds) {
      const previousEntity = previousById.get(entityId) ?? null;
      const currentEntity = currentById.get(entityId) ?? null;

      const entityName =
        currentEntity?.entity_name ?? previousEntity?.entity_name ?? entityId;
      const previousClassification = previousEntity?.classification ?? null;
      const currentClassification =
        currentEntity?.classification ?? previousEntity?.classification;

      if (!currentClassification) {
        throw new NotFoundException(
          `No se pudo resolver clasificacion para la entidad ${entityId}`,
        );
      }

      const changeType = this.resolveChangeType(
        previousClassification,
        currentEntity?.classification ?? null,
      );

      if (changeType === 'IMPROVED') classificationChanges.improved += 1;
      if (changeType === 'WORSENED') classificationChanges.worsened += 1;
      if (changeType === 'STABLE') classificationChanges.stable += 1;
      if (changeType === 'NEW') classificationChanges.new_entities += 1;
      if (changeType === 'REMOVED') classificationChanges.removed_entities += 1;

      entities.push({
        entity_id: entityId,
        entity_name: entityName,
        level: current.level,
        previous_classification: previousClassification,
        current_classification: currentClassification,
        change_type: changeType,
        metric_deltas: this.computeMetricDeltas(
          currentEntity?.main_metrics ?? null,
          previousEntity?.main_metrics ?? null,
        ),
        current_metrics: currentEntity?.main_metrics ?? null,
        previous_metrics: previousEntity?.main_metrics ?? null,
      });
    }

    return {
      client: current.client,
      level: current.level,
      comparison_basis: {
        current_analysis_id: current.id,
        previous_analysis_id: previous.id,
        current_generated_at: current.generated_at,
        previous_generated_at: previous.generated_at,
        current_period: {
          date_from: current.date_from,
          date_to: current.date_to,
        },
        previous_period: {
          date_from: previous.date_from,
          date_to: previous.date_to,
        },
        context_hash: current.context_hash ?? previous.context_hash,
      },
      portfolio_delta: this.computeMetricDeltas(
        this.aggregatePortfolio(current.output),
        this.aggregatePortfolio(previous.output),
      ),
      classification_changes: classificationChanges,
      entities: entities.sort((left, right) => {
        const leftMagnitude = Math.abs(left.metric_deltas.spend ?? 0);
        const rightMagnitude = Math.abs(right.metric_deltas.spend ?? 0);
        return rightMagnitude - leftMagnitude;
      }),
    };
  }

  private aggregatePortfolio(output: StrategistResponse) {
    const totals = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
      roasWeightedValue: 0,
    };

    for (const entity of output.entity_analysis) {
      totals.spend += entity.main_metrics.spend;
      totals.impressions += entity.main_metrics.impressions;
      totals.clicks += entity.main_metrics.clicks;
      totals.results += entity.main_metrics.results ?? 0;
      totals.roasWeightedValue +=
        (entity.main_metrics.roas ?? 0) * entity.main_metrics.spend;
    }

    return {
      spend: totals.spend,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr:
        totals.impressions > 0
          ? (totals.clicks / totals.impressions) * 100
          : null,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
      cpm:
        totals.impressions > 0
          ? (totals.spend / totals.impressions) * 1000
          : null,
      roas: totals.spend > 0 ? totals.roasWeightedValue / totals.spend : null,
      results: totals.results,
      result_type: null,
    };
  }

  private resolveChangeType(
    previousClassification: StrategistClassification | null,
    currentClassification: StrategistClassification | null,
  ): ComparisonChangeType {
    if (!previousClassification && currentClassification) {
      return 'NEW';
    }

    if (previousClassification && !currentClassification) {
      return 'REMOVED';
    }

    if (!previousClassification || !currentClassification) {
      return 'STABLE';
    }

    const previousRank = classificationRank[previousClassification];
    const currentRank = classificationRank[currentClassification];

    if (currentRank > previousRank) {
      return 'IMPROVED';
    }

    if (currentRank < previousRank) {
      return 'WORSENED';
    }

    return 'STABLE';
  }

  private computeMetricDeltas(
    currentMetrics:
      | StrategistResponse['entity_analysis'][number]['main_metrics']
      | null,
    previousMetrics:
      | StrategistResponse['entity_analysis'][number]['main_metrics']
      | null,
  ) {
    return {
      spend: (currentMetrics?.spend ?? 0) - (previousMetrics?.spend ?? 0),
      ctr: this.subtractNullable(currentMetrics?.ctr, previousMetrics?.ctr),
      cpc: this.subtractNullable(currentMetrics?.cpc, previousMetrics?.cpc),
      roas: this.subtractNullable(currentMetrics?.roas, previousMetrics?.roas),
      results: this.subtractNullable(
        currentMetrics?.results,
        previousMetrics?.results,
      ),
    };
  }

  private subtractNullable(
    current: number | null | undefined,
    previous: number | null | undefined,
  ) {
    if (current == null && previous == null) {
      return null;
    }

    return (current ?? 0) - (previous ?? 0);
  }

  private validateOutput(
    payload: unknown,
    context: AiComparisonPreparedContext,
  ): { ok: true; value: AiComparisonResponse } | { ok: false; error: string } {
    if (!comparisonValidator(payload)) {
      return {
        ok: false,
        error: ajv.errorsText(comparisonValidator.errors),
      };
    }

    const validEntityIds = new Set(context.entities.map((entity) => entity.entity_id));

    for (const item of payload.entity_differences) {
      if (!validEntityIds.has(item.entity_id)) {
        return {
          ok: false,
          error: `La comparacion incluyo una entidad fuera del diff canonico: ${item.entity_id}`,
        };
      }
    }

    return {
      ok: true,
      value: payload,
    };
  }

  private normalizeOutput(
    output: AiComparisonResponse,
    context: AiComparisonPreparedContext,
    matchType: 'EXACT_MATCH' | 'CONTEXT_SIMILAR',
  ): AiComparisonResponse {
    const diffLookup = new Map(
      context.entities.map((entity) => [entity.entity_id, entity]),
    );

    return {
      ...output,
      comparison_basis: {
        current_analysis_id: context.comparison_basis.current_analysis_id,
        previous_analysis_id: context.comparison_basis.previous_analysis_id,
        match_type: matchType,
        context_hash: context.comparison_basis.context_hash,
      },
      entity_differences: output.entity_differences.map((item) => {
        const source = diffLookup.get(item.entity_id);
        if (!source) {
          return item;
        }

        return {
          ...item,
          entity_name: source.entity_name,
          level: source.level,
          previous_classification: source.previous_classification,
          current_classification: source.current_classification,
          change_type: source.change_type,
          metric_deltas: source.metric_deltas,
        };
      }),
    };
  }

  private resolveMatchType(
    current: StrategistComparisonAnalysis,
    previous: StrategistComparisonAnalysis,
    requestedContextHash?: string,
  ): 'EXACT_MATCH' | 'CONTEXT_SIMILAR' {
    const expectedContextHash = requestedContextHash ?? current.context_hash;
    if (expectedContextHash && previous.context_hash === expectedContextHash) {
      return 'EXACT_MATCH';
    }

    return 'CONTEXT_SIMILAR';
  }
}
