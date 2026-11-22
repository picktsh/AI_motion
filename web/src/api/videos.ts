import { getJson, getList } from './client';
import { endpoints } from './endpoints';
import type { VideoSummary, VideoDetail } from '../types';

/** 视频条目列表。 */
export function listVideos(): Promise<VideoSummary[]> {
  return getList<VideoSummary>(endpoints.videos.list);
}

/** 视频条目详情：工程信息、引用素材、字幕、分段、产物探测结果。 */
export function getVideoDetail(id: string): Promise<VideoDetail> {
  return getJson<VideoDetail>(endpoints.videos.detail(id));
}
