import type { FastifyInstance } from 'fastify';
import { readRoadmap } from '../services/about.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses } from '../core/schemas.js';

export function registerAbout(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/about/roadmap`, {
    schema: {
      tags: ['about'],
      summary: '阶段路线图（解析 docs/roadmap.md，文档即单一来源）',
      response: { 200: envelope({ type: 'object', additionalProperties: true }), ...errorStatuses },
    },
  }, () => ok(readRoadmap()));
}
