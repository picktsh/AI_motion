import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses, type JsonSchema } from '../core/schemas.js';

const healthData: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    status: { type: 'string', example: 'ok' },
    service: { type: 'string', description: '服务名' },
    time: { type: 'integer', description: 'Unix 毫秒时间戳' },
  },
};

export function registerHealth(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/health`, {
    schema: {
      tags: ['health'],
      summary: '服务健康状态',
      response: { 200: envelope(healthData), ...errorStatuses },
    },
  }, () =>
    ok({ status: 'ok', service: config.service, time: Date.now() }));
}
