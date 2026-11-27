import { listAllAssets } from './observatory.js';
import { listProjects } from './projects.js';
import { listTemplates } from './templates.js';

// 全局检索：只检索本地台账与磁盘清单，不做模糊语义扩展，命中即给可跳转路径。
export type SearchKind = 'project' | 'template' | 'asset';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  /** 面板内跳转路径（项目/模板用） */
  route: string | null;
  /** 资源直链（素材用） */
  url: string | null;
}

export interface SearchResult {
  query: string;
  total: number;
  hits: SearchHit[];
}

const LIMIT = 40;

function hit(haystack: Array<string | null | undefined>, q: string): boolean {
  return haystack.some((s) => (s ?? '').toLowerCase().includes(q));
}

export function searchAll(rawQuery: string): SearchResult {
  const q = rawQuery.trim().toLowerCase();
  const hits: SearchHit[] = [];
  if (!q) return { query: '', total: 0, hits };

  for (const p of listProjects()) {
    if (hits.length >= LIMIT) break;
    if (!hit([p.id, p.name, p.templateName, p.scriptText, p.keywords.join(' ')], q)) continue;
    hits.push({
      kind: 'project',
      id: p.id,
      title: p.name,
      subtitle: `${p.id} · ${p.templateName} · ${p.status}`,
      route: `/projects/${encodeURIComponent(p.id)}`,
      url: null,
    });
  }

  for (const t of listTemplates()) {
    if (hits.length >= LIMIT) break;
    if (!hit([t.id, t.name, t.slug, t.version, t.runtime?.profile], q)) continue;
    hits.push({
      kind: 'template',
      id: t.id,
      title: t.name,
      subtitle: `${t.id} · ${t.origin === 'local' ? '本地' : '缓存'}`,
      route: '/templates',
      url: null,
    });
  }

  for (const a of listAllAssets()) {
    if (hits.length >= LIMIT) break;
    if (!hit([a.name, a.rel, a.projectName], q)) continue;
    hits.push({
      kind: 'asset',
      id: a.rel,
      title: a.name,
      subtitle: `${a.scope === 'public' ? '公共' : '项目私有'} · ${a.rel}`,
      route: '/assets',
      url: a.url,
    });
  }

  return { query: rawQuery.trim(), total: hits.length, hits };
}
