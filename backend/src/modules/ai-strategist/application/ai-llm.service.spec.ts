import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AiLlmService } from './ai-llm.service';

describe('AiLlmService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('usa Claude y extrae JSON estructurado desde tool_use', async () => {
    const service = new AiLlmService({
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          AI_LLM_PROVIDER: 'claude',
          ANTHROPIC_API_KEY: 'claude-key',
          ANTHROPIC_MODEL: 'claude-sonnet-4-5',
          ANTHROPIC_VERSION: '2023-06-01',
          AI_LLM_TIMEOUT_MS: '45000',
        };

        return values[key];
      }),
    } as unknown as ConfigService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'tool_use',
            input: {
              answer: 'ok',
            },
          },
        ],
      }),
    }) as typeof fetch;

    await expect(
      service.generateStructuredJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'structured_output',
        schema: {
          type: 'object',
        },
      }),
    ).resolves.toEqual({
      answer: 'ok',
    });
  });

  it('falla si Claude no tiene api key', async () => {
    const service = new AiLlmService({
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          AI_LLM_PROVIDER: 'claude',
        };

        return values[key];
      }),
    } as unknown as ConfigService);

    await expect(
      service.generateStructuredJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'structured_output',
        schema: {
          type: 'object',
        },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('mantiene OpenAI como alternativa', async () => {
    const service = new AiLlmService({
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          AI_LLM_PROVIDER: 'openai',
          OPENAI_API_KEY: 'openai-key',
          OPENAI_MODEL: 'gpt-4.1-mini',
          AI_LLM_TIMEOUT_MS: '45000',
        };

        return values[key];
      }),
    } as unknown as ConfigService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: '{"answer":"ok"}',
      }),
    }) as typeof fetch;

    await expect(
      service.generateStructuredJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'structured_output',
        schema: {
          type: 'object',
        },
      }),
    ).resolves.toEqual({
      answer: 'ok',
    });
  });

  it('lanza error si Claude responde sin estructura utilizable', async () => {
    const service = new AiLlmService({
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          AI_LLM_PROVIDER: 'claude',
          ANTHROPIC_API_KEY: 'claude-key',
          ANTHROPIC_MODEL: 'claude-sonnet-4-5',
          ANTHROPIC_VERSION: '2023-06-01',
          AI_LLM_TIMEOUT_MS: '45000',
        };

        return values[key];
      }),
    } as unknown as ConfigService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'not-json',
          },
        ],
      }),
    }) as typeof fetch;

    await expect(
      service.generateStructuredJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        schemaName: 'structured_output',
        schema: {
          type: 'object',
        },
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
