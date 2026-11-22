import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// 允许通过 /api/v1/assets 回显的白名单目录（相对工程根）
export const WHITELIST_DIRS = [
  'studio/template',
  'studio/tts/samples',
  'studio/tts/segments',
  'studio/videos',
  'studio/public',
  'studio/templates-cache',
  'studio/templates',
];

// 解析白名单内的相对路径；越界返回 null。存在性由调用方 stat 判断，区分 403 与 404。
export function resolveSafe(rel) {
  const cleaned = path.normalize(rel || '').replace(/^(\.\.[/\\])+/, '');
  if (!cleaned || cleaned.startsWith(path.sep) || cleaned.split(/[/\\]/).includes('..')) return null;
  const abs = path.join(ROOT, cleaned);
  const inScope = WHITELIST_DIRS.some((d) => {
    const base = path.join(ROOT, d);
    return abs === base || abs.startsWith(base + path.sep);
  });
  return inScope ? abs : null;
}

// 在 studio/bin/ 或 PATH 中查找可执行文件
export function findBin(name) {
  const local = path.join(ROOT, 'studio', 'bin', name);
  if (fs.existsSync(local)) return local;
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}
