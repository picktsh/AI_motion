import type { FastifyInstance } from 'fastify';
import { readPublish, writePublish } from '../services/publish.js';
import { notFound } from '../core/errors.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses, idParam, type JsonSchema } from '../core/schemas.js';

const publishCovers: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    horizontal: { type: ['string', 'null'] },
    vertical: { type: ['string', 'null'] },
  },
};

const publishConfig: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    title: { type: ['string', 'null'] },
    body: { type: ['string', 'null'] },
    hashtags: { type: ['array', 'null'], items: { type: 'string' } },
    covers: { type: ['object', 'null'], additionalProperties: true, properties: publishCovers.properties },
    notes: { type: ['string', 'null'] },
    platform: { type: ['string', 'null'] },
  },
};

const publishResult: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    config: publishConfig,
    source: {
      type: 'object',
      additionalProperties: true,
      properties: {
        rel: { type: ['string', 'null'] },
        exists: { type: 'boolean' },
      },
    },
  },
};

type IdParams = { id: string };

export function registerPublish(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/videos/:id/publish`, {
    schema: {
      tags: ['videos'],
      summary: '读取作品发布配置（双候选）',
      params: idParam,
      response: { 200: envelope(publishResult), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    const result = readPublish(id);
    if (!result) throw notFound('条目不存在');
    return ok(result);
  });

  app.put(`${prefix}/videos/:id/publish`, {
    schema: {
      tags: ['videos'],
      summary: '保存作品发布配置（白名单字段收敛后落盘 publish.json）',
      params: idParam,
      body: publishConfig,
      response: { 200: envelope(publishResult), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    const result = writePublish(id, request.body);
    if (!result) throw notFound('条目不存在');
    return ok(result);
  });
}
