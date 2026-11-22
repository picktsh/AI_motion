import { config } from '../config.mjs';
import { ok } from '../response.mjs';
import { envelope, errorStatuses } from '../schemas.mjs';

const healthData = {
  type: 'object',
  additionalProperties: true,
  properties: {
    status: { type: 'string', example: 'ok' },
    service: { type: 'string', description: '服务名' },
    time: { type: 'integer', description: 'Unix 毫秒时间戳' },
  },
};

export function registerHealth(app, prefix) {
  app.get(`${prefix}/health`, {
    schema: {
      tags: ['health'],
      summary: '服务健康状态',
      response: { 200: envelope(healthData), ...errorStatuses },
    },
  }, () =>
    ok({ status: 'ok', service: config.service, time: Date.now() })
  );
}
