import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { listTemplates, getTemplate } from '../services/templates.js';
import { importMotionPackage } from '../services/templateImport.js';
import { getCatalog } from '../services/templateCatalog.js';
import { badRequest, notFound } from '../core/errors.js';
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
    output: {
      type: ['object', 'null'],
      additionalProperties: true,
      properties: {
        width: { type: ['number', 'null'] },
        height: { type: ['number', 'null'] },
        layout: { type: ['string', 'null'] },
      },
    },
    permissions: { type: ['object', 'null'] },
    extensions: { type: ['object', 'null'] },
    parameters: {
      type: 'object',
      additionalProperties: true,
      properties: {
        file: { type: ['string', 'null'] },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              name: { type: 'string' },
              type: { type: ['string', 'null'] },
              required: { type: 'boolean' },
              enum: { type: ['array', 'null'], items: { type: 'string' } },
              constValue: { type: ['string', 'null'] },
              defaultValue: { type: ['string', 'number', 'boolean', 'array', 'object', 'null'] },
              range: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              nested: { type: ['integer', 'null'] },
            },
          },
        },
      },
    },
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

const importResult: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    name: { type: 'string' },
    version: { type: ['string', 'null'] },
    localPath: { type: 'string' },
    fileCount: { type: 'integer' },
    bytes: { type: 'integer' },
    packageSha256: { type: 'string' },
    integrity: { type: 'string', enum: ['verified', 'absent'] },
    verifiedFiles: { type: 'integer' },
    sourceFilename: { type: 'string' },
    importedAt: { type: 'string' },
  },
};

const catalogItem: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    templateId: { type: 'integer' },
    repositoryId: { type: ['string', 'null'] },
    name: { type: 'string' },
    nameEn: { type: ['string', 'null'] },
    summary: { type: ['string', 'null'] },
    orientation: { type: 'string', enum: ['landscape', 'portrait'] },
    ratio: { type: ['string', 'null'] },
    width: { type: ['integer', 'null'] },
    height: { type: ['integer', 'null'] },
    fps: { type: ['number', 'null'] },
    version: { type: ['string', 'null'] },
    group: { type: ['string', 'null'] },
    poster: { type: ['string', 'null'] },
    demo: { type: ['string', 'null'] },
    website: { type: ['string', 'null'] },
    repository: { type: ['string', 'null'] },
    downloadType: { type: ['string', 'null'] },
    downloadUrl: { type: ['string', 'null'] },
    availability: { type: ['string', 'null'] },
    materials: { type: ['string', 'null'] },
    openSource: { type: ['boolean', 'null'] },
  },
};

export function registerTemplates(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/templates`, {
    schema: {
      tags: ['templates'],
      summary: '模板卡片列表',
      response: { 200: listEnvelope(templateSummary), ...errorStatuses },
    },
  }, () => list(listTemplates()));

  app.get(`${prefix}/templates/catalog`, {
    schema: {
      tags: ['templates'],
      summary: '模板中心公开清单（motiontemplates/all catalog，镜像拉取并本地缓存）',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          refresh: { type: 'boolean', description: '跳过缓存强制拉取' },
        },
      },
      response: { 200: listEnvelope(catalogItem), ...errorStatuses },
    },
  }, async (request) => {
    const { refresh } = request.query as { refresh?: boolean };
    const result = await getCatalog(Boolean(refresh));
    return list(result.items, {
      fetchedAt: result.fetchedAt,
      source: result.source,
      stale: result.stale,
      error: result.error,
    });
  });

  app.post(`${prefix}/templates/import`, {
    schema: {
      tags: ['templates'],
      summary: '导入 .motion 模板包（multipart 字段 file）',
      consumes: ['multipart/form-data'],
      response: { 200: envelope(importResult), ...errorStatuses },
    },
  }, async (request) => {
    let part;
    try {
      part = await request.file();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/too large/i.test(message)) throw badRequest('文件超过单包体积上限');
      throw badRequest(`读取上传文件失败：${message || '未知原因'}`);
    }
    if (!part) throw badRequest('缺少上传文件字段 file');

    const filename = part.filename || 'upload.motion';
    const tmp = path.join(
      os.tmpdir(),
      `motion-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    try {
      await pipeline(part.file, fs.createWriteStream(tmp));
      const result = await importMotionPackage(tmp, filename);
      return ok(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/too large/i.test(message) || (err as { code?: string })?.code === 'FST_REQ_FILE_TOO_LARGE') {
        throw badRequest('文件超过单包体积上限');
      }
      throw err;
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

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
