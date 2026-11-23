import type { ApiCommand, ApiJobLogs, ApiJobSnapshot, ApiJobStatus } from '../../generated/contracts';

export type CommandName = ApiCommand;
export type JobStatus = ApiJobStatus;
export type JobSnapshot = ApiJobSnapshot;
export type JobLogResult = ApiJobLogs;
export type JobArtifact = NonNullable<JobSnapshot['artifact']>;
export type JobLogLine = JobLogResult['lines'][number];
