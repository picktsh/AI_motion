import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';

// 模板中心公开清单来自 motiontemplates/all 仓库的 catalog.json（172 条模板条目）。
// 该文件在 raw.githubusercontent.com 上直连经常超时，这里按镜像优先级依次尝试，结果落本地缓存；
// 拉取失败时回退上次缓存，保证离线也能浏览。
const CACHE_DIR = path.join(ROOT, 'studio', 'templates-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'catalog.json');
const TTL_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 45_000;

const SOURCES = [
  'https://gcore.jsdelivr.net/gh/motiontemplates/all@main/catalog.json',
  'https://fastly.jsdelivr.net/gh/motiontemplates/all@main/catalog.json',
  'https://cdn.jsdelivr.net/gh/motiontemplates/all@main/catalog.json',
  'https://raw.githubusercontent.com/motiontemplates/all/refs/heads/main/catalog.json',
  'https://raw.githubusercontent.com/motiontemplates/all/main/catalog.json',
];

export interface CatalogItem {
  templateId: number;
  repositoryId: string | null;
  name: string;
  nameEn: string | null;
  summary: string | null;
  summaryEn: string | null;
  orientation: 'landscape' | 'portrait' | string;
  ratio: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  version: string | null;
  group: string | null;
  poster: string | null;
  demo: string | null;
  website: string | null;
  repository: string | null;
  downloadType: string | null;
  downloadUrl: string | null;
  availability: string | null;
  materials: string | null;
  openSource: boolean | null;
}

export interface CatalogResult {
  items: CatalogItem[];
  fetchedAt: string;
  source: string | null;
  stale: boolean;
  error: string | null;
}

interface RawItem {
  templateId?: number;
  repositoryId?: string;
  repository?: string | null;
  website?: string;
  version?: string;
  title?: { zh?: string; en?: string };
  summary?: { zh?: string; en?: string };
  group?: string;
  width?: number;
  height?: number;
  fps?: number;
  ratio?: string;
  orientation?: string;
  openSource?: boolean;
  download?: { type?: string; url?: string; urls?: { zh?: string; en?: string }; availability?: string };
  preview?: string;
  poster?: string;
  demo?: string;
  materials?: { zh?: string; en?: string };
}

/** GitHub raw 在部分网络下不可达，把图片/预览地址改写到 jsDelivr 镜像。 */
function mirrorRaw(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  if (!m) return url;
  const [, owner, repo, ref, filePath] = m;
  return `https://gcore.jsdelivr.net/gh/${owner}/${repo}@${ref}/${filePath}`;
}

function normalize(raw: RawItem): CatalogItem | null {
  if (typeof raw.templateId !== 'number') return null;
  const title = raw.title?.zh || raw.title?.en || `#${raw.templateId}`;
  return {
    templateId: raw.templateId,
    repositoryId: raw.repositoryId ?? null,
    name: title,
    nameEn: raw.title?.en ?? null,
    summary: raw.summary?.zh ?? null,
    summaryEn: raw.summary?.en ?? null,
    orientation: raw.orientation === 'portrait' ? 'portrait' : 'landscape',
    ratio: raw.ratio ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    fps: raw.fps ?? null,
    version: raw.version ?? null,
    group: raw.group ?? null,
    poster: mirrorRaw(raw.poster) ?? mirrorRaw(raw.preview),
    demo: raw.demo ?? null,
    website: raw.website ?? null,
    repository: raw.repository ?? null,
    downloadType: raw.download?.type ?? null,
    downloadUrl: raw.download?.urls?.zh ?? raw.download?.url ?? null,
    availability: raw.download?.availability ?? null,
    materials: raw.materials?.zh ?? null,
    openSource: raw.openSource ?? null,
  };
}

interface CachePayload {
  fetchedAt: string;
  source: string | null;
  items: CatalogItem[];
}

function readCache(): CachePayload | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CachePayload;
    if (!Array.isArray(raw.items) || !raw.fetchedAt) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(payload: CachePayload): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(payload)}\n`, 'utf8');
}

async function fetchFrom(url: string): Promise<{ items: CatalogItem[] }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { templates?: RawItem[]; items?: RawItem[] };
  const rawItems = body.templates ?? body.items ?? [];
  const items = rawItems.map(normalize).filter((x): x is CatalogItem => x !== null);
  if (!items.length) throw new Error('清单为空');
  return { items };
}

let inflight: Promise<CatalogResult> | null = null;

/** 取模板中心公开清单；refresh=false 时命中 12 小时缓存直接返回。 */
export async function getCatalog(refresh = false): Promise<CatalogResult> {
  const cached = readCache();
  if (!refresh && cached && Date.now() - Date.parse(cached.fetchedAt) < TTL_MS) {
    return { ...cached, stale: false, error: null };
  }
  if (inflight) return inflight;

  inflight = (async (): Promise<CatalogResult> => {
    let lastError: string | null = null;
    for (const url of SOURCES) {
      try {
        const { items } = await fetchFrom(url);
        const payload: CachePayload = {
          fetchedAt: new Date().toISOString(),
          source: url,
          items,
        };
        writeCache(payload);
        return { ...payload, stale: false, error: null };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    if (cached) return { ...cached, stale: true, error: lastError };
    return {
      items: [],
      fetchedAt: new Date().toISOString(),
      source: null,
      stale: true,
      error: lastError ?? '清单拉取失败',
    };
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
