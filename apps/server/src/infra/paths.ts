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

// 本地可执行目录（ffmpeg/ffprobe/uv 等稳定大二进制）；归 server 私有 apps/server/vendor/，不入库。
// 子进程 PATH 需前置该目录，否则 Python/渲染脚本内部按名字调用时解析不到。
export const BIN_DIR = path.join(ROOT, 'apps', 'server', 'vendor');

// 允许通过 /api/v1/assets 回显的白名单目录（相对工程根）。
// studio/public、studio/templates 为规划预留目录，落地后自然生效；
// templates-cache 是第三方模板解压缓存，不通过资产回显路由对外暴露。
export const WHITELIST_DIRS: string[] = [
  'studio/tts/samples',
  'studio/tts/segments',
  'studio/videos',
  'studio/public',
  'studio/templates',
  'studio/projects',
  'studio/assets',
];

// 解析白名单内的相对路径；越界返回 null。存在性由调用方 stat 判断，区分 403 与 404。
export function resolveSafe(rel: string): string | null {
  if (!rel || path.isAbsolute(rel) || rel.includes('\0')) return null;
  const normalized = path.normalize(rel);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return null;
  const abs = path.resolve(ROOT, normalized);
  const inScope = WHITELIST_DIRS.some((d) => {
    const base = path.resolve(ROOT, d);
    if (abs !== base && !abs.startsWith(base + path.sep)) return false;
    // Existing paths must also remain inside after symlink resolution.
    try {
      const real = fs.realpathSync(abs);
      const realBase = fs.realpathSync(base);
      return real === realBase || real.startsWith(realBase + path.sep);
    } catch {
      // For new destinations, validate the nearest existing ancestor.
      let ancestor = path.dirname(abs);
      while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) ancestor = path.dirname(ancestor);
      try {
        const realAncestor = fs.realpathSync(ancestor);
        const realBase = fs.realpathSync(base);
        return realAncestor === realBase || realAncestor.startsWith(realBase + path.sep);
      } catch { return false; }
    }
  });
  return inScope ? abs : null;
}

// 在 apps/server/vendor/ 或 PATH 中查找可执行文件
export function findBin(name: string): string | null {
  const local = path.join(BIN_DIR, name);
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

// 文件浏览与写操作的目录口径：
// 浏览只读覆盖全部白名单；写操作（新建/改名/移动/删除/文本覆写）只放行下面的可写根。
// templates、videos、templates-cache 属只读产物或第三方包，不开放面板写动作。
export const WRITABLE_DIRS: string[] = [
  'studio/projects',
  'studio/public',
  'studio/assets',
  'studio/tts/samples',
];

// 通用文本读写接口允许的扩展名；二进制与脚本产物不在此列。
export const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.js', '.mjs', '.ts', '.yaml', '.yml', '.csv', '.log', '.vtt',
]);

export const MAX_READ_BYTES = 512 * 1024;
export const MAX_WRITE_BYTES = 256 * 1024;

// 目录监听根；与素材归类口径（input/output）保持一致，新增可复用目录时在此登记。
export const WATCH_ROOTS: string[] = [
  'studio/projects',
  'studio/templates',
  'studio/tts',
  'studio/public',
  'studio/assets',
];

// 监听时忽略的目录名片段与产物前缀；渲染中间实例、依赖缓存、系统文件不进变更流。
export const WATCH_IGNORE: RegExp[] = [
  /(^|[\/\\])node_modules([\/\\]|$)/,
  /(^|[\/\\])\.git([\/\\]|$)/,
  /(^|[\/\\])\.venv([\/\\]|$)/,
  /(^|[\/\\])__pycache__([\/\\]|$)/,
  /(^|[\/\\])templates-cache([\/\\]|$)/,
  /(^|[\/\\])vendor([\/\\]|$)/,
  /(^|[\/\\])instance-[^\/\\]*([\/\\]|$)/,
  /\.pyc$/,
  /\.DS_Store$/,
  /(^|[\/\\])dist([\/\\]|$)/,
];

/** 判定相对路径是否落在可写根内（复用 resolveSafe 的越界与符号链接校验）。 */
export function resolveWritable(rel: string): string | null {
  if (!rel || path.isAbsolute(rel) || rel.includes('\0')) return null;
  const normalized = path.normalize(rel);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) return null;
  const abs = path.resolve(ROOT, normalized);
  const inScope = WRITABLE_DIRS.some((d) => {
    const base = path.resolve(ROOT, d);
    if (abs !== base && !abs.startsWith(base + path.sep)) return false;
    try {
      const real = fs.realpathSync(abs);
      const realBase = fs.realpathSync(base);
      return real === realBase || real.startsWith(realBase + path.sep);
    } catch {
      let ancestor = path.dirname(abs);
      while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) ancestor = path.dirname(ancestor);
      try {
        const realAncestor = fs.realpathSync(ancestor);
        const realBase = fs.realpathSync(base);
        return realAncestor === realBase || realAncestor.startsWith(realBase + path.sep);
      } catch {
        return false;
      }
    }
  });
  return inScope ? abs : null;
}
