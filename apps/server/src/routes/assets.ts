import fs from 'node:fs';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { resolveAsset } from '../infra/assets.js';
import { errorStatuses, type JsonSchema } from '../core/schemas.js';

const fileStream: JsonSchema = {
  type: 'string',
  format: 'binary',
  description: '原始文件流（图片 / 音频 / 视频 / 文本 / JSON），不走 JSON 包络',
};

type AssetQuery = { path?: string };

interface ByteRange {
  start: number;
  end: number;
}

/**
 * 解析 `Range: bytes=start-end`。
 * 返回 undefined 表示无 Range 头（全量 200）；null 表示非法/越界 Range（416）。
 */
function parseRange(header: string | undefined, size: number): ByteRange | null | undefined {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  let start: number;
  let end: number;
  if (match[1] === '' && match[2] === '') return null;

  if (match[1] === '') {
    // 后缀区间：bytes=-N，表示末尾 N 字节
    const suffix = Number(match[2]);
    if (!suffix || suffix < 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

function sendAsset(
  reply: FastifyReply,
  abs: string,
  size: number,
  type: string,
  rangeHeader: string | undefined,
): void {
  reply.header('Content-Type', type);
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Cache-Control', 'no-store');

  const range = parseRange(rangeHeader, size);
  if (range === null) {
    reply.header('Content-Range', `bytes */${size}`);
    reply.code(416).send();
    return;
  }
  if (!range) {
    reply.header('Content-Length', size);
    reply.send(fs.createReadStream(abs));
    return;
  }

  reply.code(206);
  reply.header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  reply.header('Content-Length', range.end - range.start + 1);
  reply.send(fs.createReadStream(abs, { start: range.start, end: range.end }));
}

export function registerAssets(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/assets`, {
    schema: {
      tags: ['assets'],
      summary: '回显白名单目录内的静态资产文件，支持 Range 分片以便音视频拖动进度',
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
    sendAsset(reply, abs, stat.size, type, request.headers.range);
  });
}
