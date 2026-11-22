import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { resolveAsset } from '../infra/assets.js';
import { errorStatuses, type JsonSchema } from '../core/schemas.js';

const fileStream: JsonSchema = {
  type: 'string',
  format: 'binary',
  description: '原始文件流（图片 / 音频 / 视频 / 文本 / JSON），不走 JSON 包络',
};

type AssetQuery = { path?: string };

export function registerAssets(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/assets`, {
    schema: {
      tags: ['assets'],
      summary: '回显白名单目录内的静态资产文件',
      querystring: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: '相对工程根的白名单路径' },
        },
      },
      response: { 200: fileStream, ...errorStatuses },
    },
  }, (request, reply) => {
    const { abs, stat, type } = resolveAsset((request.query as AssetQuery).path || '');
    reply.header('Content-Type', type);
    reply.header('Content-Length', stat.size);
    reply.header('Cache-Control', 'no-store');
    return reply.send(fs.createReadStream(abs));
  });
}
