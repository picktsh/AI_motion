import type { FastifyInstance } from 'fastify';
import { listWorks } from '../services/works.js';
import { list } from '../core/response.js';
import { listEnvelope, errorStatuses, type JsonSchema } from '../core/schemas.js';

const workItem: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    templateName: { type: 'string' },
    createdAt: { type: 'string' },
    duration: { type: 'number' },
    artifactRel: { type: 'string' },
    videoUrl: { type: ['string', 'null'] },
    status: { type: 'string' },
    publishReady: { type: 'boolean' },
    publish: { type: ['object', 'null'], additionalProperties: true },
    cover: { type: 'object', additionalProperties: true },
  },
};

export function registerWorks(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/works`, {
    schema: {
      tags: ['works'],
      summary: '作品清单：已出成片项目，含发布配置与封面状态',
      response: { 200: listEnvelope(workItem), ...errorStatuses },
    },
  }, () => list(listWorks()));
}
