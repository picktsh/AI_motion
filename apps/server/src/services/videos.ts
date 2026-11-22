import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';
import { probeMedia, mediaType, type MediaType } from '../infra/probe.js';
import { config } from '../config.js';
import type { ProbeResult } from '@ai-motion/shared/types';

interface VideoMeta {
  title?: string;
  duration?: number;
  layout?: string;
  scenes?: unknown[];
  captions?: unknown[];
  media?: Record<string, { file?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface DiscoveredVideo {
  id: string;
  inputDir: string;
  rootDir: string;
  inputFile: string;
}

export interface PreviewRef {
  name: string;
  type: string;
  rel: string;
  url: string;
}

export interface VideoSummary {
  id: string;
  title: string;
  duration: number | null;
  layout: string | null;
  sceneCount: number;
  captionCount: number;
  videoCount: number;
  instanceCount: number;
  preview: PreviewRef | null;
}

export interface MediaRef {
  role: string;
  file: string;
  type: MediaType;
  exists: boolean;
  url: string | null;
}

export interface ExtraAsset {
  name: string;
  type: MediaType;
  rel: string;
  url: string;
}

export interface Artifact {
  name: string;
  type: MediaType;
  rel: string;
  url: string;
  probe: ProbeResult | null;
}

export interface VideoDetail {
  id: string;
  inputFile: string;
  meta: VideoMeta;
  mediaRefs: MediaRef[];
  extraAssets: ExtraAsset[];
  artifacts: Artifact[];
  instanceDirs: string[];
}

function readJson(abs: string): VideoMeta | null {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as VideoMeta | null;
  } catch {
    return null;
  }
}

// 发现条目：一期扫 studio/videos/input/*.json；规划结构迁到 studio/videos/<id>/input/user.json
function discover(): DiscoveredVideo[] {
  const items: DiscoveredVideo[] = [];
  const legacyInput = path.join(ROOT, 'studio', 'videos', 'input');
  if (fs.existsSync(legacyInput)) {
    for (const f of fs.readdirSync(legacyInput).filter((n) => n.endsWith('.json'))) {
      items.push({
        id: f.replace(/\.json$/, ''),
        inputDir: legacyInput,
        rootDir: path.join(ROOT, 'studio', 'videos'),
        inputFile: path.join(legacyInput, f),
      });
    }
  }
  const videosRoot = path.join(ROOT, 'studio', 'videos');
  if (fs.existsSync(videosRoot)) {
    for (const name of fs.readdirSync(videosRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const inputDir = path.join(videosRoot, name.name, 'input');
      const inputFile = path.join(inputDir, 'user.json');
      if (fs.existsSync(inputFile)) {
        items.push({ id: name.name, inputDir, rootDir: path.join(videosRoot, name.name), inputFile });
      }
    }
  }
  return items;
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !['.DS_Store', 'Thumbs.db'].includes(d.name))
    .map((d) => d.name);
}

function assetUrl(abs: string): string {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  return `${config.apiPrefix}/assets?path=${encodeURIComponent(rel)}`;
}

function collectArtifacts(rootDir: string): { artifacts: Artifact[]; instanceDirs: string[] } {
  const artifacts: Artifact[] = [];
  for (const name of listFiles(rootDir)) {
    const abs = path.join(rootDir, name);
    artifacts.push({ name, type: mediaType(name), rel: path.relative(ROOT, abs), url: assetUrl(abs), probe: null });
  }
  // instance 子目录只列名，不深扫中间帧
  const instanceDirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('instance'))
    .map((d) => d.name);
  return { artifacts, instanceDirs };
}

export async function listVideos(): Promise<VideoSummary[]> {
  return discover().map((item) => {
    const meta = readJson(item.inputFile) ?? {};
    const { artifacts, instanceDirs } = collectArtifacts(item.rootDir);
    const videoCount = artifacts.filter((a) => a.type === 'video').length;
    const preview = artifacts.find((a) => a.type === 'image' && /preview|frame/i.test(a.name)) ?? null;
    return {
      id: item.id,
      title: meta.title || item.id,
      duration: meta.duration ?? null,
      layout: meta.layout || null,
      sceneCount: (meta.scenes || []).length,
      captionCount: (meta.captions || []).length,
      videoCount,
      instanceCount: instanceDirs.length,
      preview,
    };
  });
}

export async function getVideo(id: string): Promise<VideoDetail | null> {
  const item = discover().find((i) => i.id === id);
  if (!item) return null;
  const meta = readJson(item.inputFile) ?? {};

  // 引用素材：按 media 配置解析到 input 目录
  const mediaRefs: MediaRef[] = [];
  const media = meta.media ?? {};
  for (const [role, cfg] of Object.entries(media)) {
    if (cfg && cfg.file) {
      const abs = path.join(item.inputDir, cfg.file);
      const exists = fs.existsSync(abs);
      mediaRefs.push({ role, file: cfg.file, type: mediaType(cfg.file), exists, url: exists ? assetUrl(abs) : null });
    }
  }
  // input 目录其余素材
  const extra: ExtraAsset[] = listFiles(item.inputDir)
    .filter((n) => !n.endsWith('.json'))
    .map((n) => ({
      name: n,
      type: mediaType(n),
      rel: path.relative(ROOT, path.join(item.inputDir, n)),
      url: assetUrl(path.join(item.inputDir, n)),
    }));

  const { artifacts, instanceDirs } = collectArtifacts(item.rootDir);
  for (const a of artifacts) {
    const abs = path.join(ROOT, a.rel);
    a.probe = ['video', 'audio'].includes(a.type) ? await probeMedia(abs) : null;
  }

  return {
    id: item.id,
    inputFile: path.relative(ROOT, item.inputFile),
    meta,
    mediaRefs,
    extraAssets: extra,
    artifacts,
    instanceDirs,
  };
}
