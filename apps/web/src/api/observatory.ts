import { getJson, getList } from './client';
import { endpoints } from './endpoints';
import { resolveAssetUrl } from '../composables/useServerConfig';

export type AssetScope = 'project' | 'public';
export type AssetSource = 'project' | 'public' | 'tts-sample';
export type AssetMediaType = 'image' | 'audio' | 'video' | 'file';

export interface GlobalAsset {
  name: string;
  type: AssetMediaType;
  rel: string;
  url: string | null;
  scope: AssetScope;
  source: AssetSource;
  projectId: string | null;
  projectName: string | null;
  size: number;
  updatedAt: number;
}

export type ActivityKind = 'project' | 'artifact' | 'asset' | 'job';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  rel: string | null;
  status: string | null;
  at: number;
}

export async function listAllAssets(scope?: AssetScope): Promise<GlobalAsset[]> {
  const query = scope ? `?scope=${scope}` : '';
  const items = await getList<GlobalAsset>(`${endpoints.observatory.assets}${query}`);
  return items.map((a) => ({ ...a, url: resolveAssetUrl(a.url) }));
}

export function listRecentActivity(limit = 30): Promise<ActivityItem[]> {
  return getJson<ActivityItem[]>(`${endpoints.observatory.activity}?limit=${limit}`);
}
