import type { paths } from './api';

type Success<T> = T extends { data: infer D } ? D : never;
type JobListResponse = paths['/jobs']['get']['responses'][200]['content']['application/json'];
type JobResponse = paths['/jobs/{id}']['get']['responses'][200]['content']['application/json'];
type JobLogsResponse = paths['/jobs/{id}/logs']['get']['responses'][200]['content']['application/json'];

/** 从后端 OpenAPI 文档生成的任务接口契约。 */
export type ApiJob = Success<JobListResponse> extends { items: (infer Item)[] } ? Item : never;
export type ApiJobLogs = Success<JobLogsResponse>;
export type ApiCommand = NonNullable<ApiJob['command']>;
export type ApiJobStatus = NonNullable<ApiJob['status']>;
export type ApiJobSnapshot = ApiJob;

/** 校验任务详情响应仍由生成的 OpenAPI 契约覆盖。 */
export type ApiJobDetail = Success<JobResponse>;
