import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';
import { config } from '../config.js';
import { mediaType, type MediaType } from '../infra/probe.js';
import { listJobs } from './jobs.js';

// 观测台服务：不触发任何创作动作，只做磁盘与任务的只读盘点。
// 两块能力：全局资产清单（项目素材 + 配音样例）、最近动态（项目/产物/素材/任务变更）。

const PROJECTS_DIR = path.join(ROOT, 'studio', 'projects');
const SAMPLES_DIR = path.join(ROOT, 'studio', 'tts', 'samples');
const SKIP = new Set(['.DS_Store', 'Thumbs.db']);

export interface GlobalAsset {
  name: string;
  type: MediaType;
  rel: string;
  url: string | null;
  source: 'project' | 'tts-sample';
  projectId: string | null;
  projectName: string | null;
  size: number;
  updatedAt: number;
}

export interface ActivityItem {
  id: string;
  kind: 'project' | 'artifact' | 'asset' | 'job';
  title: string;
  detail: string;
  rel: string | null;
  status: string | null;
  at: number;
}

interface Stat {
  mtime: number;
  size: number;
}

function statSafe(abs: string): Stat | null {
  try {
    if (!fs.existsSync(abs)) return null;
    const st = fs.statSync(abs);
    if (!st.isFile()) return null;
    return { mtime: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

function relOf(abs: string): string {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function assetUrl(rel: string): string {
  return `${config.apiPrefix}/assets?path=${encodeURIComponent(rel)}`;
}

interface ProjectMeta {
  id: string;
  name: string;
  status: string;
  artifactRel: string | null;
  scriptRel: string | null;
}

function readProjectMeta(dir: string): ProjectMeta | null {
  const file = path.join(PROJECTS_DIR, dir, 'project.json');
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ProjectMeta>;
    return {
      id: String(raw.id ?? dir),
      name: String(raw.name ?? dir),
      status: String(raw.status ?? 'draft'),
      artifactRel: raw.artifactRel ?? null,
      scriptRel: raw.scriptRel ?? null,
    };
  } catch {
    return null;
  }
}

function listDirFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !SKIP.has(d.name))
    .map((d) => d.name);
}

/** 全局素材盘点：项目 input/assets、项目配音 voice.mp3、配音页样例。 */
export function listAllAssets(): GlobalAsset[] {
  const assets: GlobalAsset[] = [];

  // 项目素材 + 项目配音
  if (fs.existsSync(PROJECTS_DIR)) {
    for (const dir of fs.readdirSync(PROJECTS_DIR)) {
      const meta = readProjectMeta(dir);
      if (!meta) continue;
      const assetDir = path.join(PROJECTS_DIR, dir, 'input', 'assets');
      for (const name of listDirFiles(assetDir)) {
        const abs = path.join(assetDir, name);
        const st = statSafe(abs);
        if (!st) continue;
        const rel = relOf(abs);
        assets.push({
          name,
          type: mediaType(name),
          rel,
          url: assetUrl(rel),
          source: 'project',
          projectId: meta.id,
          projectName: meta.name,
          size: st.size,
          updatedAt: st.mtime,
        });
      }
      const voice = path.join(PROJECTS_DIR, dir, 'input', 'voice.mp3');
      const vstat = statSafe(voice);
      if (vstat) {
        const rel = relOf(voice);
        assets.push({
          name: 'voice.mp3',
          type: 'audio',
          rel,
          url: assetUrl(rel),
          source: 'project',
          projectId: meta.id,
          projectName: meta.name,
          size: vstat.size,
          updatedAt: vstat.mtime,
        });
      }
    }
  }

  // 配音样例
  for (const name of listDirFiles(SAMPLES_DIR)) {
    if (!name.toLowerCase().endsWith('.mp3')) continue;
    const abs = path.join(SAMPLES_DIR, name);
    const st = statSafe(abs);
    if (!st) continue;
    const rel = relOf(abs);
    assets.push({
      name,
      type: 'audio',
      rel,
      url: assetUrl(rel),
      source: 'tts-sample',
      projectId: null,
      projectName: null,
      size: st.size,
      updatedAt: st.mtime,
    });
  }

  return assets.sort((a, b) => b.updatedAt - a.updatedAt);
}

const STATUS_TEXT: Record<string, string> = {
  draft: '草稿',
  quoted: '已报价',
  running: '生成中',
  failed: '失败',
  done: '已成片',
};

/** 最近动态：项目配置、成片产物、素材变更、后台任务，按时间倒序取前 limit 条。 */
export function listRecentActivity(limit = 30): ActivityItem[] {
  const items: ActivityItem[] = [];

  if (fs.existsSync(PROJECTS_DIR)) {
    for (const dir of fs.readdirSync(PROJECTS_DIR)) {
      const meta = readProjectMeta(dir);
      if (!meta) continue;
      const projectJson = path.join(PROJECTS_DIR, dir, 'project.json');
      const pstat = statSafe(projectJson);
      if (pstat) {
        items.push({
          id: `project:${meta.id}`,
          kind: 'project',
          title: meta.name,
          detail: `项目配置变更 · ${STATUS_TEXT[meta.status] ?? meta.status}`,
          rel: relOf(projectJson),
          status: meta.status,
          at: pstat.mtime,
        });
      }

      if (meta.artifactRel) {
        const abs = path.join(ROOT, meta.artifactRel);
        const ast = statSafe(abs);
        if (ast) {
          items.push({
            id: `artifact:${meta.id}`,
            kind: 'artifact',
            title: meta.name,
            detail: '成片产物已更新',
            rel: meta.artifactRel,
            status: meta.status,
            at: ast.mtime,
          });
        }
      }

      const assetDir = path.join(PROJECTS_DIR, dir, 'input', 'assets');
      let latest: { name: string; mtime: number } | null = null;
      for (const name of listDirFiles(assetDir)) {
        const st = statSafe(path.join(assetDir, name));
        if (st && (!latest || st.mtime > latest.mtime)) latest = { name, mtime: st.mtime };
      }
      if (latest) {
        items.push({
          id: `asset:${meta.id}`,
          kind: 'asset',
          title: meta.name,
          detail: `素材变更 · ${latest.name}`,
          rel: relOf(path.join(assetDir, latest.name)),
          status: null,
          at: latest.mtime,
        });
      }
    }
  }

  for (const job of listJobs()) {
    items.push({
      id: `job:${job.id}`,
      kind: 'job',
      title: `任务 ${job.id.slice(0, 10)}`,
      detail: `${job.command} · ${job.status}`,
      rel: null,
      status: job.status,
      at: job.finishedAt ?? job.startedAt ?? job.createdAt,
    });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}
