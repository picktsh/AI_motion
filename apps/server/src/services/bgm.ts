import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';
import { badRequest, notFound } from '../core/errors.js';
import { projectDir, readProject } from './projectRepository.js';

// BGM 公共库：studio/assets 下按音频扩展名扫描，不递归出白名单。
// 选用时复制进项目 input/assets 并回写 user.json media.music，适配器要求显式 license。
const LIB_ROOT = path.join(ROOT, 'studio/assets/bgm');
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus']);

export interface BgmItem {
  name: string;
  rel: string;
  size: number;
  url: string;
  license: string | null;
}

function scan(dir: string, prefix: string, out: BgmItem[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(abs, `${prefix}${entry.name}/`, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;
    let license: string | null = null;
    const meta = path.join(dir, `${entry.name}.license.json`);
    if (fs.existsSync(meta)) {
      try {
        license = String((JSON.parse(fs.readFileSync(meta, 'utf8')) as { license?: unknown }).license ?? '') || null;
      } catch {
        license = null;
      }
    }
    const rel = `studio/assets/bgm/${prefix}${entry.name}`;
    out.push({
      name: entry.name,
      rel,
      size: fs.statSync(abs).size,
      url: `/api/v1/assets?path=${encodeURIComponent(rel)}`,
      license,
    });
  }
}

export function listBgm(): BgmItem[] {
  const items: BgmItem[] = [];
  scan(LIB_ROOT, '', items);
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function absoluteInside(rel: string): string {
  if (!rel.startsWith('studio/assets/bgm/')) throw badRequest('只能选公共库 studio/assets/bgm 下的音频');
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(LIB_ROOT)) throw badRequest('路径越界');
  if (!fs.existsSync(abs)) throw notFound('音频文件不存在');
  if (!AUDIO_EXT.has(path.extname(abs).toLowerCase())) throw badRequest('不是支持的音频格式');
  return abs;
}

export interface BindResult {
  projectId: string;
  music: { mode: string; file?: string; license?: string };
  assetRel: string | null;
}

export function bindProjectBgm(projectId: string, input: Record<string, unknown>): BindResult {
  const project = readProject(projectId);
  if (!project) throw notFound('项目不存在');
  const dir = projectDir(projectId);
  const userFile = path.join(dir, 'input', 'user.json');
  if (!fs.existsSync(userFile)) throw badRequest('这个项目没有 user.json，不是本机渲染项目');
  const user = JSON.parse(fs.readFileSync(userFile, 'utf8')) as Record<string, unknown> & {
    media?: Record<string, unknown>;
  };
  user.media = (user.media ?? {}) as Record<string, unknown>;
  const media = user.media as Record<string, unknown>;

  if (String(input.mode) === 'none') {
    media.music = { mode: 'none' };
    fs.writeFileSync(userFile, `${JSON.stringify(user, null, 2)}\n`, 'utf8');
    return { projectId, music: { mode: 'none' }, assetRel: null };
  }

  const rel = String(input.rel ?? '').trim();
  if (!rel) throw badRequest('缺少 rel');
  const source = absoluteInside(rel);
  const target = `bgm-${path.basename(source)}`;
  const assetsDir = path.join(dir, 'input', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.copyFileSync(source, path.join(assetsDir, target));

  const license = String(input.license ?? '').trim() || '公共库取用 · 授权待核对';
  media.music = { mode: 'file', file: `assets/${target}`, license };
  fs.writeFileSync(userFile, `${JSON.stringify(user, null, 2)}\n`, 'utf8');
  return {
    projectId,
    music: media.music as BindResult['music'],
    assetRel: `studio/projects/${projectId}/input/assets/${target}`,
  };
}
