import { getJson, getList, postJson } from './client';
import { endpoints } from './endpoints';
import { resolveAssetUrl } from '../composables/useServerConfig';
import type { CommandName, JobSnapshot, JobLogResult } from '../shared/types';

function resolveJob(job: JobSnapshot): JobSnapshot {
  return job.artifact
    ? { ...job, artifact: { ...job.artifact, url: resolveAssetUrl(job.artifact.url) ?? job.artifact.url } }
    : job;
}

/** 任务列表（按创建时间倒序）。 */
export async function listJobs(): Promise<JobSnapshot[]> {
  const items = await getList<JobSnapshot>(endpoints.jobs.list);
  return items.map(resolveJob);
}

/** 任务快照。 */
export async function getJob(id: string): Promise<JobSnapshot> {
  const job = await getJson<JobSnapshot>(endpoints.jobs.detail(id));
  return resolveJob(job);
}

/** 增量拉取日志：offset 为已读到的最后行号。 */
export function getJobLogs(id: string, offset: number): Promise<JobLogResult> {
  const query = `?offset=${offset}`;
  return getJson<JobLogResult>(`${endpoints.jobs.logs(id)}${query}`);
}

/** 提交一条命令台任务。 */
export function submitJob(command: CommandName, params: Record<string, unknown>): Promise<JobSnapshot> {
  return postJson<JobSnapshot>(endpoints.jobs.list, { command, params });
}

/** 取消任务。 */
export function cancelJob(id: string): Promise<JobSnapshot> {
  return postJson<JobSnapshot>(endpoints.jobs.cancel(id), {});
}
