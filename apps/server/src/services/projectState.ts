import { badRequest } from '../core/errors.js';
import type { Project } from './projectRepository.js';

const TRANSITIONS: Record<Project['status'], readonly Project['status'][]> = {
  draft: ['quoted', 'running', 'failed'],
  quoted: ['quoted', 'running', 'failed'],
  running: ['done', 'failed'],
  failed: ['quoted', 'running', 'failed'],
  done: ['quoted', 'running', 'done'],
};

/** 校验并执行项目状态迁移。 */
export function transitionProject(project: Project, next: Project['status']): void {
  if (!TRANSITIONS[project.status].includes(next)) {
    throw badRequest(`不允许项目状态从 ${project.status} 转为 ${next}`);
  }
  project.status = next;
}
