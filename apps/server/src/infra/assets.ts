import fs from 'node:fs';
import path from 'node:path';
import { resolveSafe } from './paths.js';
import { badRequest, forbidden, notFound } from '../core/errors.js';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

export interface ResolvedAsset {
  abs: string;
  stat: fs.Stats;
  type: string;
}

// 解析白名单内的资产文件；越界、目录、不存在分别抛规范错误。
// 返回绝对路径、stat 与 Content-Type，响应发送由路由层负责。
export function resolveAsset(rel: string): ResolvedAsset {
  const abs = resolveSafe(rel);
  if (!abs) throw forbidden('路径不在允许范围内');

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw notFound('文件不存在');
  }
  if (stat.isDirectory()) throw badRequest('路径是目录');

  const type = CONTENT_TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  return { abs, stat, type };
}
