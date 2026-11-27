import { listProjects, readPublish } from './projects.js';
import type { Project, ProjectPublish } from './projects.js';

// 作品 = 已出成片的项目。独立清单接口只回作品字段与发布状态，
// 不复用旧 studio/videos 条目，避免制作中项目混入作品边界。
export interface WorkItem extends Project {
  publish: ProjectPublish | null;
  publishReady: boolean;
  cover: { horizontal: string | null; vertical: string | null };
}

export function listWorks(): WorkItem[] {
  return listProjects()
    .filter((p) => Boolean(p.artifactRel))
    .map((p) => {
      const publish = readPublish(p.id);
      return {
        ...p,
        publish,
        publishReady: Boolean(publish?.title && publish?.body),
        cover: publish?.covers ?? { horizontal: null, vertical: null },
      };
    });
}
