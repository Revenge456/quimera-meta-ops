import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import { SystemLogService } from '../../logging/application/system-log.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AdsStrategistAnalyzer } from '../domain/ads-strategist-analyzer';
import type {
  StrategistFilters,
  StrategistLevel,
  StrategistPreparedContext,
  StrategistResponse,
} from '../domain/ads-strategist.types';
import {
  ADS_STRATEGIST_OUTPUT_SCHEMA,
  buildAdsStrategistAnalysisPrompt,
  buildAdsStrategistSystemPrompt,
} from '../prompts/ads-strategist-prompts';
import { AiLlmService } from './ai-llm.service';
import { AdsStrategistRepository } from '../data/ads-strategist.repository';

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});
addFormats(ajv);
const strategistOutputValidator = ajv.compile(
  ADS_STRATEGIST_OUTPUT_SCHEMA,
) as ValidateFunction<StrategistResponse>;

@Injectable()
export class AdsStrategistService {
  constructor(
    private readonly repository: AdsStrategistRepository,
    private readonly analyzer: AdsStrategistAnalyzer,
    private readonly aiLlmService: AiLlmService,
    private readonly systemLogService: SystemLogService,
    private readonly configService: ConfigService,
  ) {}

  async analyze(
    actor: AuthUser,
    params: {
      clientId: string;
      level: StrategistLevel;
      dateFrom: string;
      dateTo: string;
      filters?: StrategistFilters;
    },
  ): Promise<StrategistResponse> {
    const execution = await this.analyzeAndPersist(actor, params);
    return execution.output;
  }

  async analyzeAndPersist(
    actor: AuthUser,
    params: {
      clientId: string;
      level: StrategistLevel;
      dateFrom: string;
      dateTo: string;
      filters?: StrategistFilters;
    },
  ): Promise<{ analysisId: string; output: StrategistResponse }> {
    if (!['admin', 'commercial_manager'].includes(actor.role)) {
      throw new ForbiddenException();
    }

    const client = await this.repository.findAccessibleClient(actor, params.clientId);
    const entities = await this.repository.listEntities({
      actor,
      clientId: params.clientId,
      level: params.level,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      filters: params.filters,
    });

    const context = this.analyzer.buildContext({
      client,
      level: params.level,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      entities,
      maxEntities: Number(
        this.configService.get<string>('AI_STRATEGIST_MAX_ENTITIES') ?? '25',
      ),
    });

    if (context.entities.length === 0) {
      const output: StrategistResponse = {
        executive_summary:
          'No se encontraron entidades dentro del alcance y rango solicitado para emitir un criterio estrategico.',
        key_findings: [
          'El analisis no tiene entidades compatibles con el filtro aplicado.',
        ],
        entity_analysis: [],
        global_recommendations: [
          'Revisar filtros, cliente seleccionado o ampliar el rango del analisis.',
        ],
        risks_detected: [],
        next_tests: ['Validar que el cliente tenga catalogo e insights cargados.'],
        client_summary: `No hubo entidades del nivel ${params.level} para ${client.nombre}.`,
      };

      const persisted = await this.repository.createAnalysisHistory({
        actor,
        clientId: client.id,
        level: params.level,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        filters: params.filters,
        context,
        output,
      });

      return {
        analysisId: persisted.id,
        output,
      };
    }

    await this.systemLogService.log({
      level: 'info',
      module: 'ai-strategist',
      eventName: 'analysis_started',
      message: 'Inicio de analisis estrategico',
      metadata: {
        clientId: client.id,
        level: params.level,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        entitiesAnalyzed: context.entities.length,
      },
    });

    const systemPrompt = buildAdsStrategistSystemPrompt();
    const userPrompt = buildAdsStrategistAnalysisPrompt(context);

    let lastErrorMessage = 'Respuesta invalida del LLM';

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const rawOutput = await this.aiLlmService.generateStructuredJson({
        systemPrompt,
        userPrompt,
        schemaName: 'ads_strategist_analysis',
        schema: ADS_STRATEGIST_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
      });

      const validation = this.validateOutput(rawOutput, context);
      if (validation.ok) {
        const normalized = this.normalizeOutput(validation.value, context);
        const persisted = await this.repository.createAnalysisHistory({
          actor,
          clientId: client.id,
          level: params.level,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          filters: params.filters,
          context,
          output: normalized,
        });

        await this.systemLogService.log({
          level: 'info',
          module: 'ai-strategist',
          eventName: 'analysis_succeeded',
          message: 'Analisis estrategico completado',
          metadata: {
            clientId: client.id,
            level: params.level,
            entitiesAnalyzed: context.entities.length,
            attempt,
            analysisId: persisted.id,
          },
        });

        return {
          analysisId: persisted.id,
          output: normalized,
        };
      }

      lastErrorMessage = validation.error;

      await this.systemLogService.log({
        level: 'warn',
        module: 'ai-strategist',
        eventName: 'analysis_invalid_retry',
        message: 'La respuesta del LLM no cumplio el contrato y se reintentara',
        metadata: {
          clientId: client.id,
          level: params.level,
          attempt,
          error: validation.error,
        },
      });
    }

    await this.systemLogService.log({
      level: 'error',
      module: 'ai-strategist',
      eventName: 'analysis_failed',
      message: 'El analisis estrategico fallo por salida invalida del LLM',
      metadata: {
        clientId: client.id,
        level: params.level,
        error: lastErrorMessage,
      },
    });

    throw new BadGatewayException(
      `El LLM no devolvio una estructura valida tras reintento: ${lastErrorMessage}`,
    );
  }

  listHistory(
    actor: AuthUser,
    filters: {
      clientId?: string;
      level?: StrategistLevel;
      dateFrom?: string;
      dateTo?: string;
      generatedFrom?: string;
      generatedTo?: string;
      contextHash?: string;
      page?: number | string;
      pageSize?: number | string;
    },
  ) {
    return this.repository.listHistory(actor, filters);
  }

  getHistoryById(actor: AuthUser, id: string) {
    return this.repository.getHistoryById(actor, id);
  }

  getLatestHistoryByContextHash(
    actor: AuthUser,
    params: {
      clientId: string;
      contextHash: string;
    },
  ) {
    return this.repository.getLatestHistoryByContextHash(actor, params);
  }

  private validateOutput(
    payload: unknown,
    context: StrategistPreparedContext,
  ): { ok: true; value: StrategistResponse } | { ok: false; error: string } {
    if (!strategistOutputValidator(payload)) {
      return {
        ok: false,
        error: ajv.errorsText(strategistOutputValidator.errors),
      };
    }

    const entityIds = new Set(context.entities.map((entity) => entity.entity_id));
    const receivedIds = new Set(payload.entity_analysis.map((item) => item.entity_id));

    if (payload.entity_analysis.length !== context.entities.length) {
      return {
        ok: false,
        error: 'La cantidad de entidades analizadas no coincide con el input entregado',
      };
    }

    if (receivedIds.size !== entityIds.size) {
      return {
        ok: false,
        error: 'La respuesta del LLM repite entidades o deja fuera entidades esperadas',
      };
    }

    for (const item of payload.entity_analysis) {
      const sourceEntity = context.entities.find(
        (entity) => entity.entity_id === item.entity_id,
      );

      if (!sourceEntity) {
        return {
          ok: false,
          error: `La respuesta del LLM incluyo una entidad fuera del alcance: ${item.entity_id}`,
        };
      }

      if (item.level !== sourceEntity.level) {
        return {
          ok: false,
          error: `La respuesta del LLM devolvio un nivel inconsistente para ${item.entity_id}`,
        };
      }
    }

    return {
      ok: true,
      value: payload,
    };
  }

  private normalizeOutput(
    output: StrategistResponse,
    context: StrategistPreparedContext,
  ): StrategistResponse {
    const entityLookup = new Map(
      context.entities.map((entity) => [entity.entity_id, entity]),
    );

    return {
      ...output,
      entity_analysis: output.entity_analysis.map((item) => {
        const sourceEntity = entityLookup.get(item.entity_id);
        if (!sourceEntity) {
          return item;
        }

        return {
          ...item,
          entity_name: sourceEntity.entity_name,
          level: sourceEntity.level,
          main_metrics: {
            spend: sourceEntity.main_metrics.spend,
            impressions: sourceEntity.main_metrics.impressions,
            clicks: sourceEntity.main_metrics.clicks,
            ctr: sourceEntity.main_metrics.ctr,
            cpc: sourceEntity.main_metrics.cpc,
            cpm: sourceEntity.main_metrics.cpm,
            roas: sourceEntity.main_metrics.roas,
            results: sourceEntity.main_metrics.results,
            result_type: sourceEntity.main_metrics.resultType,
          },
        };
      }),
    };
  }
}
