import type { FastifyInstance } from 'fastify';
import { listTemplates, getTemplate } from '../services/templates.js';
import { notFound } from '../core/errors.js';
import { ok, list } from '../core/response.js';
import { envelope, listEnvelope, errorStatuses, idParam, type JsonSchema } from '../core/schemas.js';

const templateSummary: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    name: { type: 'string' },
    version: { type: ['string', 'null'] },
    origin: { type: 'string', description: 'local / cache' },
    localPath: { type: 'string', description: '相对工程根的目录路径' },
    runtime: {
      type: 'object',
      additionalProperties: true,
      properties: {
        profile: { type: ['string', 'null'] },
        entry: { type: ['string', 'null'] },
      },
    },
    license: { type: ['string', 'null'] },
    network: { type: ['boolean', 'null'] },
    inPlace: { type: 'boolean' },
  },
};

const fileNode: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: ['dir', 'file'] },
    size: { type: ['integer', 'null'] },
    children: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
};

const templateDetail: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    name: { type: 'string' },
    version: { type: ['string', 'null'] },
    origin: { type: 'string' },
    localPath: { type: 'string' },
    runtime: { type: 'object', additionalProperties: true },
    lock: { type: ['object', 'null'] },
    license: {
      type: 'object',
      additionalProperties: true,
      properties: {
        file: { type: ['string', 'null'] },
        present: { type: 'boolean' },
      },
    },
    output: { type: ['object', 'null'] },
    permissions: { type: ['object', 'null'] },
    extensions: { type: ['object', 'null'] },
    fileTree: { type: 'array', items: fileNode },
  },
};

const redirectResult: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    redirectUrl: { type: ['string', 'null'], description: '原站页面地址，无可用地址为 null' },
  },
};

type IdParams = { id: string };

export function registerTemplates(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/templates`, {
    schema: {
      tags: ['templates'],
      summary: '模板卡片列表',
      response: { 200: listEnvelope(templateSummary), ...errorStatuses },
    },
  }, () => list(listTemplates()));

  app.get(`${prefix}/templates/:id`, {
    schema: {
      tags: ['templates'],
      summary: '模板详情：清单、许可、运行时与文件树',
      params: idParam,
      response: { 200: envelope(templateDetail), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    const tpl = getTemplate(id);
    if (!tpl) throw notFound('模板不存在');
    return ok(tpl);
  });

  app.get(`${prefix}/templates/:id/redirect`, {
    schema: {
      tags: ['templates'],
      summary: '模板原站跳转地址',
      params: idParam,
      response: { 200: envelope(redirectResult), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    const tpl = getTemplate(id);
    if (!tpl) throw notFound('模板不存在');
    const ext = tpl.extensions as Record<string, { repository?: string } | undefined> | null;
    const source = ext?.['motiongit.com:open-source']?.repository ?? null;
    return ok({ id: tpl.id, redirectUrl: source });
  });
}
