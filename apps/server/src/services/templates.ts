import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';

interface MotionTemplate {
  id?: string;
  name?: string;
  version?: string;
  [key: string]: unknown;
}

interface MotionRuntime {
  profile?: string | null;
  entry?: string | null;
  [key: string]: unknown;
}

interface MotionMeta {
  template?: MotionTemplate;
  runtime?: MotionRuntime;
  license?: { file?: string | null };
  permissions?: Record<string, unknown> | null;
  output?: unknown;
  extensions?: Record<string, unknown> | null;
}

interface Discovered {
  dir: string;
  origin: string;
  slug: string;
  tplDir: string;
  motion: MotionMeta | null;
}

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  origin: string;
  localPath: string;
  runtime: { profile: string | null; entry: string | null };
  license: string | null;
  network: boolean | null;
  inPlace: boolean;
}

export interface FileNode {
  name: string;
  type: 'dir' | 'file';
  size: number | null;
  children: FileNode[];
}

export interface TemplateDetail {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  origin: string;
  localPath: string;
  runtime: MotionRuntime;
  lock: Record<string, unknown> | null;
  license: { file: string | null; present: boolean };
  output: unknown;
  permissions: Record<string, unknown> | null;
  extensions: Record<string, unknown> | null;
  fileTree: FileNode[];
}

function readJson(abs: string): MotionMeta | null {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as MotionMeta | null;
  } catch {
    return null;
  }
}

function listDirs(base: string): string[] {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function discover(): Discovered[] {
  const found: Discovered[] = [];
  // 旧路径 studio/template/ 本身就是一个模板目录，不再向下扫子目录
  const legacy = path.join(ROOT, 'studio', 'template');
  const legacyMotion = readJson(path.join(legacy, 'motion.json'));
  if (legacyMotion) {
    found.push({
      dir: 'studio/template',
      origin: 'local',
      slug: legacyMotion.template?.id || 'template',
      tplDir: legacy,
      motion: legacyMotion,
    });
  }
  // 规划结构：studio/templates/ 与 studio/templates-cache/ 下每个子目录是一个模板
  for (const dir of ['studio/templates', 'studio/templates-cache']) {
    const base = path.join(ROOT, dir);
    for (const name of listDirs(base)) {
      const tplDir = path.join(base, name);
      const motion = readJson(path.join(tplDir, 'motion.json'));
      if (motion) {
        found.push({ dir, origin: dir.includes('templates-cache') ? 'cache' : 'local', slug: name, tplDir, motion });
      }
    }
  }
  return found;
}

export function listTemplates(): TemplateSummary[] {
  return discover().map(({ origin, slug, tplDir, motion }) => {
    const t = motion?.template ?? {};
    const runtime = motion?.runtime ?? {};
    const license = motion?.license?.file ?? null;
    return {
      id: t.id || slug,
      slug,
      name: t.name || slug,
      version: t.version ?? null,
      origin,
      localPath: path.relative(ROOT, tplDir),
      runtime: { profile: runtime.profile ?? null, entry: runtime.entry ?? null },
      license,
      network: (motion?.permissions?.network as boolean | null) ?? null,
      inPlace: fs.existsSync(tplDir),
    };
  });
}

function fileTree(dir: string, depth = 0, maxDepth = 3): FileNode[] {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !['node_modules', '.git', '__pycache__'].includes(d.name))
    .map((d) => {
      const abs = path.join(dir, d.name);
      return {
        name: d.name,
        type: d.isDirectory() ? 'dir' : 'file',
        size: d.isFile() ? fs.statSync(abs).size : null,
        children: d.isDirectory() ? fileTree(abs, depth + 1, maxDepth) : [],
      };
    });
}

export function getTemplate(id: string): TemplateDetail | null {
  const hit = discover().find(({ motion, slug }) => (motion?.template?.id || slug) === id);
  if (!hit) return null;
  const { tplDir, motion, origin } = hit;
  const lock = readJson(path.join(tplDir, 'motion.lock.json')) as Record<string, unknown> | null;
  const t = motion?.template ?? {};
  const runtime = motion?.runtime ?? {};
  const licenseFile = motion?.license?.file ?? null;
  const licenseAbs = licenseFile ? path.join(tplDir, licenseFile) : null;
  return {
    id: t.id || hit.slug,
    slug: hit.slug,
    name: t.name || hit.slug,
    version: t.version ?? null,
    origin,
    localPath: path.relative(ROOT, tplDir),
    runtime,
    lock,
    license: { file: licenseFile, present: licenseAbs ? fs.existsSync(licenseAbs) : false },
    output: motion?.output ?? null,
    permissions: motion?.permissions ?? null,
    extensions: motion?.extensions ?? null,
    fileTree: fileTree(tplDir),
  };
}
