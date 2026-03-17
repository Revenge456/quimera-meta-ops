import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import { AdsStrategistService } from '../../ai-strategist/application/ads-strategist.service';
import type {
  StrategistClassification,
  StrategistResponse,
} from '../../ai-strategist/domain/ads-strategist.types';
import { AiLlmService } from '../../ai-strategist/application/ai-llm.service';
import { SystemLogService } from '../../logging/application/system-log.service';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { CommercialAdvisorRepository } from '../data/commercial-advisor.repository';
import type {
  CommercialAdvisorPreparedContext,
  CommercialAdvisorResponse,
} from '../domain/commercial-advisor.types';
import {
  COMMERCIAL_ADVISOR_OUTPUT_SCHEMA,
  buildCommercialAdvisorPrompt,
  buildCommercialAdvisorSystemPrompt,
} from '../prompts/commercial-advisor-prompts';

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});
addFormats(ajv);
const commercialAdvisorValidator = ajv.compile(
  COMMERCIAL_ADVISOR_OUTPUT_SCHEMA,
) as ValidateFunction<CommercialAdvisorResponse>;

@Injectable()
export class CommercialAdvisorService {
  constructor(
    private readonly repository: CommercialAdvisorRepository,
    private readonly adsStrategistService: AdsStrategistService,
    private readonly aiLlmService: AiLlmService,
    private readonly systemLogService: SystemLogService,
  ) {}

  async generate(
    actor: AuthUser,
    params: {
      clientId: string;
      level: 'campaign' | 'ad_set' | 'ad';
      dateFrom: string;
      dateTo: string;
      strategistAnalysisId?: string;
      contextHash?: string;
      filters?: {
        status?: string;
        adAccountId?: string;
        campaignId?: string;
        adSetId?: string;
        search?: string;
      };
    },
  ): Promise<CommercialAdvisorResponse> {
    const execution = await this.generateWithHistory(actor, params);
    return execution.output;
  }

  async generateWithHistory(
    actor: AuthUser,
    params: {
      clientId: string;
      level: 'campaign' | 'ad_set' | 'ad';
      dateFrom: string;
      dateTo: string;
      strategistAnalysisId?: string;
      contextHash?: string;
      filters?: {
        status?: string;
        adAccountId?: string;
        campaignId?: string;
        adSetId?: string;
        search?: string;
      };
    },
  ): Promise<{
    advisoryId: string;
    strategistAnalysisId: string;
    output: CommercialAdvisorResponse;
  }> {
    if (!['admin', 'commercial_manager'].includes(actor.role)) {
      throw new ForbiddenException();
    }

    const strategistExecution = params.strategistAnalysisId
      ? await this.resolveExistingStrategist(actor, params)
      : params.contextHash
        ? await this.resolveStrategistByContextHash(actor, params)
        : await this.resolveFreshStrategist(actor, params);

    const client = await this.repository.findAccessibleClient(
      actor,
      strategistExecution.clientId,
    );
    const strategistOutput = strategistExecution.output;

    if (strategistOutput.entity_analysis.length === 0) {
      const output: CommercialAdvisorResponse = {
        executive_summary:
          'No hay suficiente material dentro del rango elegido para construir una narrativa comercial solida.',
        performance_explanation:
          'La lectura actual no ofrece suficiente evidencia para defender una historia comercial fuerte frente al cliente.',
        decision_justifications: [],
        objection_handling: {
          performance:
            'Antes de responder objeciones de rendimiento conviene ampliar el rango o completar la carga de datos.',
          budget:
            'No es recomendable empujar presupuesto adicional sin evidencia suficiente del periodo.',
        },
        additional_commercial_opportunity:
          'Primero consolidar medicion y claridad del periodo antes de proponer una expansion comercial.',
        next_phase_recommendation:
          'Ampliar el rango analizado o completar la informacion del cliente antes de la siguiente conversacion.',
        agency_positioning_narrative:
          'La agencia protege la toma de decisiones evitando promesas cuando la evidencia aun no es robusta.',
        client_talking_points: [
          'Hoy la prioridad es asegurar lectura fiable antes de abrir una conversacion comercial ambiciosa.',
        ],
        client_ready_summary: `Todavia no hay suficiente evidencia para construir un advisory comercial fuerte para ${client.nombre}.`,
      };

      const persisted = await this.repository.createAdvisorHistory({
        actor,
        clientId: client.id,
        strategistAnalysisId: strategistExecution.analysisId,
        level: strategistExecution.level,
        dateFrom: strategistExecution.dateFrom,
        dateTo: strategistExecution.dateTo,
        filters: strategistExecution.filters,
        strategistOutput,
        output,
      });

      return {
        advisoryId: persisted.id,
        strategistAnalysisId: strategistExecution.analysisId,
        output,
      };
    }

    const context = this.buildContext(
      client,
      strategistExecution.dateFrom,
      strategistExecution.dateTo,
      strategistExecution.level,
      strategistOutput,
    );

    await this.systemLogService.log({
      level: 'info',
      module: 'commercial-advisor',
      eventName: 'advisory_started',
      message: 'Inicio de advisory comercial',
      metadata: {
        clientId: client.id,
        level: strategistExecution.level,
        dateFrom: strategistExecution.dateFrom,
        dateTo: strategistExecution.dateTo,
        entities: strategistOutput.entity_analysis.length,
        strategistAnalysisId: strategistExecution.analysisId,
      },
    });

    const systemPrompt = buildCommercialAdvisorSystemPrompt();
    const userPrompt = buildCommercialAdvisorPrompt(context);
    let lastErrorMessage = 'Salida invalida del LLM';

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const rawOutput = await this.aiLlmService.generateStructuredJson({
        systemPrompt,
        userPrompt,
        schemaName: 'commercial_advisor_output',
        schema: COMMERCIAL_ADVISOR_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
      });

      const validation = this.validateOutput(rawOutput, strategistOutput);
      if (validation.ok) {
        const normalized = this.normalizeOutput(validation.value, strategistOutput);
        const persisted = await this.repository.createAdvisorHistory({
          actor,
          clientId: client.id,
          strategistAnalysisId: strategistExecution.analysisId,
          level: strategistExecution.level,
          dateFrom: strategistExecution.dateFrom,
          dateTo: strategistExecution.dateTo,
          filters: strategistExecution.filters,
          strategistOutput,
          output: normalized,
        });

        await this.systemLogService.log({
          level: 'info',
          module: 'commercial-advisor',
          eventName: 'advisory_succeeded',
          message: 'Advisory comercial completado',
          metadata: {
            clientId: client.id,
            level: strategistExecution.level,
            attempt,
            advisoryId: persisted.id,
            strategistAnalysisId: strategistExecution.analysisId,
          },
        });

        return {
          advisoryId: persisted.id,
          strategistAnalysisId: strategistExecution.analysisId,
          output: normalized,
        };
      }

      lastErrorMessage = validation.error;

      await this.systemLogService.log({
        level: 'warn',
        module: 'commercial-advisor',
        eventName: 'advisory_invalid_retry',
        message: 'La salida comercial no cumplio contrato y se reintentara',
        metadata: {
          clientId: client.id,
          level: strategistExecution.level,
          attempt,
          error: validation.error,
        },
      });
    }

    await this.systemLogService.log({
      level: 'error',
      module: 'commercial-advisor',
      eventName: 'advisory_failed',
      message: 'El advisory comercial fallo por salida invalida del LLM',
      metadata: {
        clientId: client.id,
        level: strategistExecution.level,
        error: lastErrorMessage,
      },
    });

    throw new BadGatewayException(
      `El Commercial Advisor no devolvio una estructura valida tras reintento: ${lastErrorMessage}`,
    );
  }

  private async resolveFreshStrategist(
    actor: AuthUser,
    params: {
      clientId: string;
      level: 'campaign' | 'ad_set' | 'ad';
      dateFrom: string;
      dateTo: string;
      filters?: {
        status?: string;
        adAccountId?: string;
        campaignId?: string;
        adSetId?: string;
        search?: string;
      };
    },
  ) {
    const strategistExecution = await this.adsStrategistService.analyzeAndPersist(
      actor,
      params,
    );

    return {
      analysisId: strategistExecution.analysisId,
      clientId: params.clientId,
      level: params.level,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      filters: params.filters,
      output: strategistExecution.output,
    };
  }

  private async resolveExistingStrategist(
    actor: AuthUser,
    params: {
      clientId: string;
      level: 'campaign' | 'ad_set' | 'ad';
      dateFrom: string;
      dateTo: string;
      strategistAnalysisId?: string;
      contextHash?: string;
      filters?: {
        status?: string;
        adAccountId?: string;
        campaignId?: string;
        adSetId?: string;
        search?: string;
      };
    },
  ) {
    const stored = await this.adsStrategistService.getHistoryById(
      actor,
      params.strategistAnalysisId!,
    );

    if (stored.client.id !== params.clientId) {
      throw new BadRequestException(
        'El strategist seleccionado no corresponde al cliente indicado',
      );
    }

    return {
      analysisId: stored.id,
      clientId: stored.client.id,
      level: stored.level,
      dateFrom: stored.date_from,
      dateTo: stored.date_to,
      filters: stored.filters,
      output: stored.output,
    };
  }

  private async resolveStrategistByContextHash(
    actor: AuthUser,
    params: {
      clientId: string;
      level: 'campaign' | 'ad_set' | 'ad';
      dateFrom: string;
      dateTo: string;
      strategistAnalysisId?: string;
      contextHash?: string;
      filters?: {
        status?: string;
        adAccountId?: string;
        campaignId?: string;
        adSetId?: string;
        search?: string;
      };
    },
  ) {
    const stored = await this.adsStrategistService.getLatestHistoryByContextHash(actor, {
      clientId: params.clientId,
      contextHash: params.contextHash!,
    });

    return {
      analysisId: stored.id,
      clientId: stored.client.id,
      level: stored.level,
      dateFrom: stored.date_from,
      dateTo: stored.date_to,
      filters: stored.filters,
      output: stored.output,
    };
  }

  listHistory(
    actor: AuthUser,
    filters: {
      clientId?: string;
      level?: 'campaign' | 'ad_set' | 'ad';
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

  private buildContext(
    client: {
      id: string;
      nombre: string;
      empresa: string;
    },
    dateFrom: string,
    dateTo: string,
    level: 'campaign' | 'ad_set' | 'ad',
    strategistOutput: StrategistResponse,
  ): CommercialAdvisorPreparedContext {
    const classificationsSummary: Record<StrategistClassification, number> = {
      ESCALAR: 0,
      MANTENER: 0,
      OPTIMIZAR: 0,
      PAUSAR: 0,
    };

    for (const entity of strategistOutput.entity_analysis) {
      classificationsSummary[entity.classification] += 1;
    }

    const topEntities = [...strategistOutput.entity_analysis]
      .sort((left, right) => right.main_metrics.spend - left.main_metrics.spend)
      .slice(0, 10);

    return {
      client,
      period: {
        date_from: dateFrom,
        date_to: dateTo,
      },
      level,
      strategist_summary: {
        executive_summary: strategistOutput.executive_summary,
        client_summary: strategistOutput.client_summary,
        key_findings: strategistOutput.key_findings,
        global_recommendations: strategistOutput.global_recommendations,
        risks_detected: strategistOutput.risks_detected,
        next_tests: strategistOutput.next_tests,
      },
      classifications_summary: classificationsSummary,
      top_entities: topEntities,
    };
  }

  private validateOutput(
    payload: unknown,
    strategistOutput: StrategistResponse,
  ): { ok: true; value: CommercialAdvisorResponse } | { ok: false; error: string } {
    if (!commercialAdvisorValidator(payload)) {
      return {
        ok: false,
        error: ajv.errorsText(commercialAdvisorValidator.errors),
      };
    }

    const strategistIds = new Set(
      strategistOutput.entity_analysis.map((entity) => entity.entity_id),
    );

    for (const item of payload.decision_justifications) {
      if (!strategistIds.has(item.entity_id)) {
        return {
          ok: false,
          error: `La salida comercial incluyo una entidad fuera del analisis: ${item.entity_id}`,
        };
      }
    }

    return {
      ok: true,
      value: payload,
    };
  }

  private normalizeOutput(
    output: CommercialAdvisorResponse,
    strategistOutput: StrategistResponse,
  ): CommercialAdvisorResponse {
    const entityLookup = new Map(
      strategistOutput.entity_analysis.map((entity) => [entity.entity_id, entity]),
    );

    return {
      ...output,
      decision_justifications: output.decision_justifications.map((item) => {
        const source = entityLookup.get(item.entity_id);
        if (!source) {
          return item;
        }

        return {
          ...item,
          entity_name: source.entity_name,
          classification: source.classification,
        };
      }),
    };
  }
}
