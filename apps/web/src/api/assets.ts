import { assetUrl as buildAssetUrl } from './client';
import { endpoints } from './endpoints';

/** 资产可访问相对地址，用于媒体标签的 src。 */
export function assetUrl(rel: string): string {
  return buildAssetUrl(endpoints.assets.byPath(rel));
}

/** 直取静态 JSON 资产（不走接口包络，例如 publish.json）；读取失败返回 null。 */
export async function fetchJsonAsset(rel: string): Promise<unknown> {
  const res = await fetch(assetUrl(rel));
  if (!res.ok) return null;
  return res.json();
}
