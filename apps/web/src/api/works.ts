import { getList } from './client';
import { endpoints } from './endpoints';
import type { Project, ProjectPublish } from './projects';

/** 作品 = 已出成片的项目；发布配置与封面状态随清单一次回带。 */
export interface WorkItem extends Project {
  publish: ProjectPublish | null;
  publishReady: boolean;
  cover: { horizontal: string | null; vertical: string | null };
}

export function listWorks(): Promise<WorkItem[]> {
  return getList<WorkItem>(endpoints.works.list);
}
