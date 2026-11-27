import type { FastifyInstance } from 'fastify';
import { collectRuntime, type RuntimeReport } from '../services/runtime.js';
import { ok } from '../core/response.js';
import { envelope, errorStatuses, type JsonSchema } from '../core/schemas.js';

// 运行配置只读视图：监听地址、鉴权状态、白名单目录与任务限额。
// About / 环境页只渲染这一份数据，配置来源与缺省值跟随后端 config。

const runtimeItem: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['key', 'label', 'value', 'source', 'origin', 'fallback'],
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    value: { type: 'string', description: '当前生效值（密钥只给长度）' },
    source: { type: 'string', enum: ['env', 'file', 'default'], description: '当前值来源' },
    origin: { type: ['string', 'null'], description: '对应环境变量名或配置字段' },
    fallback: { type: ['string', 'null'], description: '内置缺省值' },
    note: { type: ['string', 'null'] },
  },
};

const report: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['service', 'version', 'protocol', 'origin', 'loopbackOnly', 'configFile', 'auth', 'items', 'paths', 'textLimits', 'jobs'],
  properties: {
    service: { type: 'string' },
    version: { type: 'string' },
    protocol: { type: 'string', description: '接口协议版本，前端运行时比对' },
    origin: { type: 'string' },
    loopbackOnly: { type: 'boolean' },
    configFile: { type: ['string', 'null'], description: '读取到的本地配置文件路径' },
    auth: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: { type: 'boolean' },
        keyCount: { type: 'integer' },
        keyLength: { type: ['integer', 'null'], description: '仅单把密钥时给长度，多把时为 null' },
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
