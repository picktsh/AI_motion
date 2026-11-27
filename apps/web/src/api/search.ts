import { getJson } from './client';
import { endpoints } from './endpoints';

export type SearchKind = 'project' | 'template' | 'asset';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  route: string | null;
  url: string | null;
}

export interface SearchResult {
  query: string;
  total: number;
  hits: SearchHit[];
}

/** 全局检索：项目、模板与素材，结果只给本地台账命中。 */
export function searchAll(q: string): Promise<SearchResult> {
  return getJson<SearchResult>(`${endpoints.search.q}?q=${encodeURIComponent(q)}`);
}
