import type { FastifyInstance } from 'fastify';
import { chat, listProviders, saveProvider } from '../services/ai.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses } from '../core/schemas.js';

export function registerAi(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/ai/providers`, {
    schema: {
      tags: ['ai'],
      summary: 'AI 提供商列表（Key 只回掩码）',
      response: { 200: envelope({ type: 'object', additionalProperties: true }), ...errorStatuses },
    },
  }, () => ok({ items: listProviders() }));

  app.put(`${prefix}/ai/providers/:id`, {
    schema: {
      tags: ['ai'],
      summary: '保存提供商 baseUrl / 模型 / Key（只落本地 config/ai.json）',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          baseUrl: { type: 'string' },
          model: { type: 'string' },
          apiKey: { type: 'string' },
        },
      },
      response: { 200: envelope({ type: 'object', additionalProperties: true }), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as { id: string };
    return ok(saveProvider(id, (request.body ?? {}) as Record<string, unknown>));
  });

  app.post(`${prefix}/ai/chat`, {
    schema: {
      tags: ['ai'],
      summary: 'OpenAI 兼容 chat 代理（消耗用户本人额度）',
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          providerId: { type: 'string' },
          messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['providerId', 'messages'],
      },
      response: { 200: envelope({ type: 'object', additionalProperties: true }), ...errorStatuses },
    },
  }, async (request) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    return ok(await chat(String(body.providerId), body));
  });
}
