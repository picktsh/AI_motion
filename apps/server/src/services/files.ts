import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ROOT,
  WHITELIST_DIRS,
  resolveSafe,
  resolveWritable,
  TEXT_EXTS,
  MAX_READ_BYTES,
  MAX_WRITE_BYTES,
} from '../infra/paths.js';
import { badRequest, conflict, forbidden, notFound } from '../core/errors.js';

// 面板文件浏览与文件级操作：目录清单、文本读写、新建 / 改名 / 移动 / 删除。
// 所有路径都是相对工程根；只读走 resolveSafe，写操作走 resolveWritable，越界一律 403。

const SKIP = new Set(['.DS_Store', 'Thumbs.db']);

export interface FileEntry {
  name: string;
  type: 'dir' | 'file';
  ext: string;
  size: number;
  mtime: number;
  rel: string;
}

export interface TextFile {
  rel: string;
  content: string;
  size: number;
  sha256: string;
  ext: string;
  isJson: boolean;
}

function relOf(abs: string): string {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/** 文件名校验：拒绝路径分隔符、回退目录与控制字符；允许中英文、数字、常见符号。 */
function validName(name: string): boolean {
  if (!name || name === '.' || name === '..') return false;
  if (/[\/\\]/.test(name)) return false;
  if (/[\0\r\n\t]/.test(name)) return false;
  return true;
}

function resolveBrowse(rel: string): string {
  const abs = resolveSafe(rel);
  if (!abs) throw forbidden('路径不在允许的目录范围内');
  return abs;
}

function resolveWrite(rel: string): string {
  const abs = resolveWritable(rel);
  if (!abs) throw forbidden('该路径不允许面板写入');
  return abs;
}

/* ---------- 目录清单 ---------- */

/** 根目录：只列白名单覆盖到的顶层 studio 子目录，不暴露工程根其它内容。 */
function listRoot(): FileEntry[] {
  const top = [...new Set(WHITELIST_DIRS.map((d) => d.split('/').slice(0, 2).join('/')))];
  const items: FileEntry[] = [];
  for (const rel of top) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const st = fs.statSync(abs);
    items.push({ name: path.basename(abs), type: 'dir', ext: '', size: 0, mtime: st.mtimeMs, rel });
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export function listDir(rel: string): { parent: string; path: string; items: FileEntry[] } {
  if (!rel) return { parent: '', path: '', items: listRoot() };
  const abs = resolveBrowse(rel);
  if (!fs.existsSync(abs)) throw notFound('目录不存在');
  const st = fs.statSync(abs);
  if (!st.isDirectory()) throw badRequest('目标不是目录');

  const items: FileEntry[] = fs.readdirSync(abs, { withFileTypes: true })
    .filter((d) => !SKIP.has(d.name))
    .map((d) => {
      const childAbs = path.join(abs, d.name);
      let size = 0;
      let mtime = 0;
      try {
        const cst = fs.statSync(childAbs);
        size = cst.size;
        mtime = cst.mtimeMs;
      } catch {
        /* 条目消失时保留清单条目，大小置空 */
      }
      const type: FileEntry['type'] = d.isDirectory() ? 'dir' : 'file';
      return { name: d.name, type, ext: type === 'file' ? extOf(d.name) : '', size, mtime, rel: relOf(childAbs) };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

  const parentRel = rel ? path.posix.dirname(rel.split('/').filter(Boolean).join('/')) : '';
  return { parent: parentRel, path: rel, items };
}

/* ---------- 文本读写 ---------- */

function sha256Of(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function readText(rel: string): TextFile {
  const abs = resolveBrowse(rel);
  if (!fs.existsSync(abs)) throw notFound('文件不存在');
  const st = fs.statSync(abs);
  if (st.isDirectory()) throw badRequest('目标是目录，请在清单中浏览');
  const ext = extOf(rel);
  if (!TEXT_EXTS.has(ext)) throw badRequest('二进制文件不支持文本读取');
  if (st.size > MAX_READ_BYTES) throw badRequest(`文件超过 ${MAX_READ_BYTES / 1024}KB，不支持面板读取`);
  const content = fs.readFileSync(abs, 'utf8');
  return { rel, content, size: st.size, sha256: sha256Of(content), ext, isJson: ext === '.json' };
}

/** 写入前按类型校验：JSON 必须能 parse；纯文本按原文覆盖，不 trim、不改换行。 */
function validateContent(ext: string, content: string): void {
  if (ext === '.json') {
    try {
      JSON.parse(content);
    } catch (err) {
      throw badRequest(`JSON 格式不正确：${err instanceof Error ? err.message : '解析失败'}`);
    }
  }
}

export function writeText(rel: string, content: string, expectedSha?: string): TextFile {
  const abs = resolveWrite(rel);
  const ext = extOf(rel);
  if (!TEXT_EXTS.has(ext)) throw badRequest('该扩展名不允许通过文本接口写入');
  if (content.length > MAX_WRITE_BYTES) throw badRequest(`内容超过 ${MAX_WRITE_BYTES / 1024}KB 上限`);
  validateContent(ext, content);

  if (fs.existsSync(abs)) {
    const existing = fs.readFileSync(abs, 'utf8');
    if (expectedSha && sha256Of(existing) !== expectedSha) {
      throw conflict('文件已被外部修改，请刷新后再保存');
    }
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // 临时文件 + rename 保证原子落盘，避免中断留下半截文件。
  const temp = `${abs}.${process.pid}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, abs);
  return { rel, content, size: Buffer.byteLength(content, 'utf8'), sha256: sha256Of(content), ext, isJson: ext === '.json' };
}

/* ---------- 引用核对：被项目素材登记引用的文件不允许直接删 ---------- */

function referencedByAsset(abs: string): string[] {
  const rel = relOf(abs);
  // 只核对项目 input/assets 下的文件；其余中间产物由项目台账自行管理。
  const m = rel.match(/^studio\/projects\/([^/]+)\/input\/assets\//);
  if (!m) return [];
  const configAbs = path.join(ROOT, 'studio', 'projects', m[1], 'input', 'studio-config.json');
  if (!fs.existsSync(configAbs)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(configAbs, 'utf8')) as { assets?: { rel?: string }[] };
    return (raw.assets ?? []).filter((a) => a.rel === rel).map((a) => a.rel ?? rel);
  } catch {
    return [];
  }
}

/* ---------- 新建 / 改名 / 移动 / 删除 ---------- */

export function createDir(rel: string): FileEntry {
  const abs = resolveWrite(rel);
  if (fs.existsSync(abs)) throw conflict('同名条目已存在');
  fs.mkdirSync(abs, { recursive: true });
  const st = fs.statSync(abs);
  return { name: path.basename(abs), type: 'dir', ext: '', size: 0, mtime: st.mtimeMs, rel: relOf(abs) };
}

export function createFile(rel: string): FileEntry {
  const abs = resolveWrite(rel);
  const ext = extOf(rel);
  if (!TEXT_EXTS.has(ext)) throw badRequest('新建空文件仅支持文本类扩展名');
  if (fs.existsSync(abs)) throw conflict('同名条目已存在');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '', 'utf8');
  const st = fs.statSync(abs);
  return { name: path.basename(abs), type: 'file', ext, size: 0, mtime: st.mtimeMs, rel: relOf(abs) };
}

export function renameEntry(rel: string, name: string): FileEntry {
  if (!validName(name)) throw badRequest('文件名不合法：不能包含路径分隔符或回退目录');
  const abs = resolveWrite(rel);
  if (!fs.existsSync(abs)) throw notFound('条目不存在');
  const dest = path.join(path.dirname(abs), name);
  if (fs.existsSync(dest)) throw conflict('目标名称已存在');
  fs.renameSync(abs, dest);
  const st = fs.statSync(dest);
  return {
    name,
    type: st.isDirectory() ? 'dir' : 'file',
    ext: st.isDirectory() ? '' : extOf(name),
    size: st.size,
    mtime: st.mtimeMs,
    rel: relOf(dest),
  };
}

export function moveEntry(rel: string, destDirRel: string): FileEntry {
  const abs = resolveWrite(rel);
  if (!fs.existsSync(abs)) throw notFound('条目不存在');
  const destDir = resolveWritable(destDirRel);
  if (!destDir) throw forbidden('目标目录不在允许的写范围内');
  if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) throw badRequest('目标目录不存在');
  const dest = path.join(destDir, path.basename(abs));
  if (dest.startsWith(abs + path.sep)) throw badRequest('不能把目录移动到自身内部');
  if (fs.existsSync(dest)) throw conflict('目标位置同名条目已存在');
  fs.renameSync(abs, dest);
  const st = fs.statSync(dest);
  return {
    name: path.basename(dest),
    type: st.isDirectory() ? 'dir' : 'file',
    ext: st.isDirectory() ? '' : extOf(dest),
    size: st.size,
    mtime: st.mtimeMs,
    rel: relOf(dest),
  };
}

export function removeEntry(rel: string): { rel: string; type: 'dir' | 'file' } {
  const abs = resolveWrite(rel);
  if (!fs.existsSync(abs)) throw notFound('条目不存在');
  const st = fs.statSync(abs);
  const refs = referencedByAsset(abs);
  if (refs.length > 0) {
    throw conflict('该素材仍登记在 studio-config.json 中，请先解除引用再删除', { references: refs });
  }
  if (st.isDirectory()) {
    const entries = fs.readdirSync(abs);
    if (entries.length > 0) throw badRequest('目录非空，只能删除空目录；请先清空内部文件');
    fs.rmdirSync(abs);
    return { rel, type: 'dir' };
  }
  fs.unlinkSync(abs);
  return { rel, type: 'file' };
}
