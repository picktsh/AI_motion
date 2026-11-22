import fs from 'node:fs';
import { resolveAsset } from '../assets.mjs';
import { errorStatuses } from '../schemas.mjs';

const fileStream = {
  type: 'string',
  format: 'binary',
  description: '原始文件流（图片 / 音频 / 视频 / 文本 / JSON），不走 JSON 包络',
};

export function registerAssets(app, prefix) {
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
    const { abs, stat, type } = resolveAsset(request.query.path || '');
    reply.header('Content-Type', type);
    reply.header('Content-Length', stat.size);
    reply.header('Cache-Control', 'no-store');
    return reply.send(fs.createReadStream(abs));
  });
}
