import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiLlmService {
  constructor(private readonly configService: ConfigService) {}

  async generateStructuredJson(params: {
    systemPrompt: string;
    userPrompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
    maxOutputTokens?: number;
  }): Promise<unknown> {
    const provider = this.configService.get<string>('AI_LLM_PROVIDER') ?? 'openai';

    switch (provider) {
      case 'claude':
        return this.generateWithClaude(params);
      case 'openai':
        return this.generateWithOpenAi(params);
      default:
        throw new ServiceUnavailableException(
          `Proveedor de LLM no soportado: ${provider}`,
        );
    }
  }

  private async generateWithOpenAi(params: {
    systemPrompt: string;
    userPrompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
    maxOutputTokens?: number;
  }) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('OPENAI_API_KEY no configurada');
    }

    const model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
    const timeoutMs = Number(
      this.configService.get<string>('AI_LLM_TIMEOUT_MS') ?? '45000',
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: params.systemPrompt,
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: params.userPrompt,
                },
              ],
            },
          ],
          max_output_tokens: params.maxOutputTokens ?? 2400,
          text: {
            format: {
              type: 'json_schema',
              name: params.schemaName,
              strict: true,
              schema: params.schema,
            },
          },
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new BadGatewayException(
          `OpenAI devolvio un error: ${JSON.stringify(payload)}`,
        );
      }

      const text = this.extractText(payload);
      try {
        return JSON.parse(text);
      } catch {
        throw new BadGatewayException('La respuesta del LLM no fue JSON valido');
      }
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        error instanceof Error
          ? `Fallo al consultar el LLM: ${error.message}`
          : 'Fallo desconocido al consultar el LLM',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async generateWithClaude(params: {
    systemPrompt: string;
    userPrompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
    maxOutputTokens?: number;
  }) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY no configurada');
    }

    const model =
      this.configService.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5';
    const anthropicVersion =
      this.configService.get<string>('ANTHROPIC_VERSION') ?? '2023-06-01';
    const timeoutMs = Number(
      this.configService.get<string>('AI_LLM_TIMEOUT_MS') ?? '45000',
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': anthropicVersion,
        },
        body: JSON.stringify({
          model,
          system: params.systemPrompt,
          max_tokens: params.maxOutputTokens ?? 2400,
          messages: [
            {
              role: 'user',
              content: params.userPrompt,
            },
          ],
          tools: [
            {
              name: params.schemaName,
              description:
                'Return the final answer as structured JSON that strictly matches the provided schema.',
              input_schema: params.schema,
              strict: true,
            },
          ],
          tool_choice: {
            type: 'tool',
            name: params.schemaName,
          },
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new BadGatewayException(
          `Claude devolvio un error: ${JSON.stringify(payload)}`,
        );
      }

      return this.extractClaudeStructuredJson(payload);
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        error instanceof Error
          ? `Fallo al consultar Claude: ${error.message}`
          : 'Fallo desconocido al consultar Claude',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractClaudeStructuredJson(payload: Record<string, unknown>) {
    const content = Array.isArray(payload.content)
      ? (payload.content as unknown[])
      : [];

    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const typedBlock = block as {
        type?: unknown;
        input?: unknown;
        text?: unknown;
      };

      if (typedBlock.type === 'tool_use' && typedBlock.input) {
        return typedBlock.input;
      }

      if (typedBlock.type === 'text' && typeof typedBlock.text === 'string') {
        try {
          return JSON.parse(typedBlock.text);
        } catch {
          continue;
        }
      }
    }

    throw new BadGatewayException(
      'Claude no devolvio un bloque tool_use o JSON utilizable',
    );
  }

  private extractText(payload: Record<string, unknown>) {
    const outputText = payload.output_text;
    if (typeof outputText === 'string' && outputText.length > 0) {
      return outputText;
    }

    const output = Array.isArray(payload.output) ? payload.output : [];
    for (const item of output) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const content = Array.isArray((item as { content?: unknown[] }).content)
        ? ((item as { content?: unknown[] }).content ?? [])
        : [];

      for (const part of content) {
        if (!part || typeof part !== 'object') {
          continue;
        }

        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string' && text.length > 0) {
          return text;
        }
      }
    }

    throw new BadGatewayException('El LLM no devolvio contenido utilizable');
  }
}
