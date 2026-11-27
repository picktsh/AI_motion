import type { FastifyInstance } from 'fastify';
import { searchAll } from '../services/search.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses } from '../core/schemas.js';

export function registerSearch(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/search`, {
    schema: {
      tags: ['search'],
      summary: '全局检索：项目 / 模板 / 素材',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string', description: '关键词' },
        },
      },
      response: { 200: envelope({ type: 'object', additionalProperties: true }), ...errorStatuses },
    },
  }, (request) => {
    const { q } = request.query as { q?: string };
    return ok(searchAll(q ?? ''));
  });
}
