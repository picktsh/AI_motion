import { collectEnvironment } from '../env.mjs';
import { ok } from '../response.mjs';
import { envelope, errorStatuses } from '../schemas.mjs';

const envItem = {
  type: 'object',
  additionalProperties: true,
  properties: {
    key: { type: 'string', description: '依赖标识' },
    label: { type: 'string', description: '展示名' },
    ok: { type: 'boolean', description: '是否就位' },
    version: { type: ['string', 'null'], description: '检测到的版本' },
    path: { type: ['string', 'null'], description: '可执行文件或目录路径' },
    hint: { type: ['string', 'null'], description: '缺失时的补装提示' },
  },
};

const envReport = {
  type: 'object',
  additionalProperties: true,
  properties: {
    items: { type: 'array', items: envItem },
    summary: {
      type: 'object',
      additionalProperties: true,
      properties: {
        ok: { type: 'integer', description: '就位项数' },
        total: { type: 'integer', description: '总项数' },
      },
    },
  },
};

export function registerEnvironment(app, prefix) {
  app.get(`${prefix}/environment`, {
    schema: {
      tags: ['environment'],
      summary: '本地依赖、媒体工具与工程目录就位情况',
      response: { 200: envelope(envReport), ...errorStatuses },
    },
  }, async () => ok(await collectEnvironment()));
}
