import { getJson, putJson } from './client';
import { endpoints } from './endpoints';
import type { PublishConfig } from '../shared/types';

export interface PublishSource {
  rel: string | null;
  exists: boolean;
}

export interface PublishResult {
  config: PublishConfig;
  source: PublishSource;
}

/** 读取作品发布配置（双候选）；条目不存在时由后端返回 404。 */
export function getPublish(id: string): Promise<PublishResult> {
  return getJson<PublishResult>(endpoints.videos.publish(id));
}

/** 保存作品发布配置；后端收敛白名单字段后落盘 publish.json。 */
export function savePublish(id: string, config: PublishConfig): Promise<PublishResult> {
  return putJson<PublishResult>(endpoints.videos.publish(id), config);
}
