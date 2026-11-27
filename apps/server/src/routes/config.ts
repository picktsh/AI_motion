import type { FastifyInstance } from 'fastify';
import { collectRuntime, type RuntimeReport } from '../services/runtime.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses, type JsonSchema } from '../core/schemas.js';

// 运行配置只读视图：监听地址、鉴权状态、白名单目录与任务限额。
// About / 环境页只渲染这一份数据，配置来源与缺省值跟随后端 config。

const runtimeItem: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['key', 'label', 'value', 'source', 'env', 'fallback'],
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    value: { type: 'string', description: '当前生效值（密钥只给长度）' },
    source: { type: 'string', enum: ['env', 'default'], description: '当前值来源' },
    env: { type: ['string', 'null'], description: '对应环境变量名' },
    fallback: { type: ['string', 'null'], description: '内置缺省值' },
    note: { type: ['string', 'null'] },
  },
};

const report: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['service', 'version', 'origin', 'loopbackOnly', 'auth', 'items', 'paths', 'textLimits', 'jobs'],
  properties: {
    service: { type: 'string' },
    version: { type: 'string' },
    origin: { type: 'string' },
    loopbackOnly: { type: 'boolean' },
    auth: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: { type: 'boolean' },
        keyLength: { type: ['integer', 'null'] },
        header: { type: 'string' },
        note: { type: 'string' },
      },
    },
    items: { type: 'array', items: runtimeItem },
    paths: {
      type: 'object',
      additionalProperties: true,
      properties: {
        root: { type: 'string' },
        read: { type: 'array', items: { type: 'string' } },
        write: { type: 'array', items: { type: 'string' } },
        watch: { type: 'array', items: { type: 'string' } },
      },
    },
    textLimits: {
      type: 'object',
      additionalProperties: true,
      properties: {
        readBytes: { type: 'integer' },
        writeBytes: { type: 'integer' },
        extensions: { type: 'array', items: { type: 'string' } },
      },
    },
    jobs: { type: 'object', additionalProperties: true },
  },
};

export function registerRuntime(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/config`, {
    schema: {
      tags: ['environment'],
      summary: '运行配置只读视图（监听、鉴权、白名单与任务限额）',
      response: { 200: envelope(report), ...errorStatuses },
    },
  }, async () => ok<RuntimeReport>(collectRuntime()));
}
