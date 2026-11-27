import type { FastifyInstance } from 'fastify';
import { bindProjectBgm, listBgm } from '../services/bgm.js';
import { ok, list } from '../core/response.js';
import { envelope, listEnvelope, errorStatuses, idParam, type JsonSchema } from '../core/schemas.js';

const bgmItem: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    rel: { type: 'string' },
    size: { type: 'integer' },
    url: { type: 'string' },
    license: { type: ['string', 'null'] },
  },
};

export function registerBgm(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/bgm`, {
    schema: {
      tags: ['bgm'],
      summary: 'BGM 公共库扫描（studio/assets/bgm）',
      response: { 200: listEnvelope(bgmItem), ...errorStatuses },
    },
  }, () => list(listBgm()));

  app.post(`${prefix}/projects/:id/bgm`, {
    schema: {
      tags: ['bgm'],
      summary: '选用 BGM：复制进项目 input/assets 并回写 user.json media.music',
      params: idParam,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', enum: ['file', 'none'] },
          rel: { type: 'string' },
          license: { type: 'string' },
        },
      },
      response: { 200: envelope({ type: 'object', additionalProperties: true }), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as { id: string };
    return ok(bindProjectBgm(id, request.body as Record<string, unknown>));
  });
}
