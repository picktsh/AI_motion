import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 源码布局（src/infra）与编译产物布局（dist/infra）到工程根的层级不同，
// 同时尝试 __dirname 多层回溯与当前工作目录，以存在 studio/ 目录作为命中依据。
function resolveRoot(): string {
  const candidates = [
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../../../../'),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'studio'))) return candidate;
  }
  return path.resolve(__dirname, '../../..');
}

export const ROOT = resolveRoot();

// 允许通过 /api/v1/assets 回显的白名单目录（相对工程根）。
// studio/public、studio/templates 为规划预留目录，落地后自然生效；
// templates-cache 是第三方模板解压缓存，不通过资产回显路由对外暴露。
export const WHITELIST_DIRS: string[] = [
  'studio/template',
  'studio/tts/samples',
  'studio/tts/segments',
  'studio/videos',
  'studio/public',
  'studio/templates',
];

// 解析白名单内的相对路径；越界返回 null。存在性由调用方 stat 判断，区分 403 与 404。
export function resolveSafe(rel: string): string | null {
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
export function findBin(name: string): string | null {
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
