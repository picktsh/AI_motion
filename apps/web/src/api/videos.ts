import { getJson, getList, postForm } from './client';
import { endpoints } from './endpoints';
import { normalizeAssetUrls } from '../composables/useServerConfig';
import type { VideoSummary, VideoDetail } from '../shared/types';

/** 视频条目列表。 */
export async function listVideos(): Promise<VideoSummary[]> {
  const items = await getList<VideoSummary>(endpoints.videos.list);
  return normalizeAssetUrls(items);
}

/** 视频条目详情：工程信息、引用素材、字幕、分段、产物探测结果。 */
export async function getVideoDetail(id: string): Promise<VideoDetail> {
  const detail = await getJson<VideoDetail>(endpoints.videos.detail(id));
  return normalizeAssetUrls(detail);
}

/** 上传作品封面/图片素材；返回落盘后的素材引用（覆盖同名时自动加序号）。 */
export async function uploadVideoAsset(
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ name: string; type: string; rel: string; url: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  return postForm(endpoints.videos.assets(id), form, onProgress);
}
