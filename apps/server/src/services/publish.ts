import fs from 'node:fs';
import path from 'node:path';
import { ROOT, resolveSafe } from '../infra/paths.js';
import { forbidden } from '../core/errors.js';

// 发布配置（publish.json）读写：与渲染输入 user.json 解耦。
// 读取依次尝试新结构 studio/videos/<id>/input/publish.json 与旧结构 studio/videos/input/publish-<id>.json；
// 写回优先更新已存在的候选，否则落到对应结构的新候选。所有路径限定 studio/videos 白名单。

export interface PublishCovers {
  horizontal?: string;
  vertical?: string;
}

export interface PublishConfig {
  title?: string;
  body?: string;
  hashtags?: string[];
  covers?: PublishCovers;
  notes?: string;
  platform?: string;
}

export interface PublishResult {
  config: PublishConfig;
  source: { rel: string | null; exists: boolean };
}

interface EntryLocation {
  id: string;
  inputDir: string;
  userFile: string;
  candidates: string[];
}

function readJson(abs: string): PublishConfig | null {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as PublishConfig | null;
  } catch {
    return null;
  }
}

// 与 videos 服务的条目发现规则对齐：旧结构 input/*.json，新结构 <id>/input/user.json。
function resolveEntry(id: string): EntryLocation | null {
  const videosRoot = path.join(ROOT, 'studio', 'videos');

  const newInputDir = path.join(videosRoot, id, 'input');
  const newUser = path.join(newInputDir, 'user.json');
  if (fs.existsSync(newUser)) {
    return {
      id,
      inputDir: newInputDir,
      userFile: newUser,
      candidates: [path.join(newInputDir, 'publish.json')],
    };
  }

  const legacyInputDir = path.join(videosRoot, 'input');
  const legacyUser = path.join(legacyInputDir, `${id}.json`);
  if (fs.existsSync(legacyUser)) {
    return {
      id,
      inputDir: legacyInputDir,
      userFile: legacyUser,
      candidates: [path.join(legacyInputDir, `publish-${id}.json`)],
    };
  }
  return null;
}

function relOf(abs: string): string {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t ? t : undefined;
}

function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const s = typeof item === 'string' ? item.trim() : '';
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out.length ? out : undefined;
}

function covers(value: unknown): PublishCovers | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const horizontal = str(v.horizontal);
  const vertical = str(v.vertical);
  if (!horizontal && !vertical) return undefined;
  return { ...(horizontal ? { horizontal } : {}), ...(vertical ? { vertical } : {}) };
}

// 只保留白名单字段并收敛类型；未知键不进入落盘结构。
export function sanitizePublish(input: unknown): PublishConfig {
  if (!input || typeof input !== 'object') return {};
  const v = input as Record<string, unknown>;
  const config: PublishConfig = {};
  const title = str(v.title);
  const body = str(v.body);
  const notes = str(v.notes);
  const platform = str(v.platform);
  const hashtags = strList(v.hashtags);
  const pubCovers = covers(v.covers);
  if (title) config.title = title;
  if (body) config.body = body;
  if (notes) config.notes = notes;
  if (platform) config.platform = platform;
  if (hashtags) config.hashtags = hashtags;
  if (pubCovers) config.covers = pubCovers;
  return config;
}

export function readPublish(id: string): PublishResult | null {
  const entry = resolveEntry(id);
  if (!entry) return null;

  for (const candidate of entry.candidates) {
    if (fs.existsSync(candidate)) {
      const config = readJson(candidate) ?? {};
      return { config, source: { rel: relOf(candidate), exists: true } };
    }
  }
  return { config: {}, source: { rel: relOf(entry.candidates[0]), exists: false } };
}

export function writePublish(id: string, input: unknown): PublishResult | null {
  const entry = resolveEntry(id);
  if (!entry) return null;

  const config = sanitizePublish(input);
  // 已存在候选优先更新；否则落到第一个候选（对应结构的新位置）。
  const existing = entry.candidates.find((c) => fs.existsSync(c));
  const target = existing ?? entry.candidates[0];

  const safe = resolveSafe(relOf(target));
  if (!safe) throw forbidden('发布配置路径越出白名单目录');

  fs.mkdirSync(path.dirname(safe), { recursive: true });
  fs.writeFileSync(safe, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  return { config, source: { rel: relOf(safe), exists: true } };
}
