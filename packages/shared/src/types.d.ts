// 前后端共享的契约类型（仅类型声明；运行时结构以后端 JSON Schema 为准）。

/** 统一错误体。 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** 统一响应包络：单资源 data 为本体，列表 data 内含 items 与 meta。 */
export interface Envelope<T> {
  ok: boolean;
  data?: T;
  meta?: { total?: number };
  error?: ApiError;
}

/** 媒体流探测条目。 */
export interface ProbeStream {
  type: string;
  codec: string;
  width: number | null;
  height: number | null;
  channels: number | null;
  sampleRate: number | null;
}

/** ffprobe 探测结果。 */
export interface ProbeResult {
  ok: boolean;
  duration?: number | null;
  size?: number | null;
  bitRate?: number | null;
  streams: ProbeStream[];
  reason?: string;
}

/** 命令台任务状态机。 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** 命令台白名单命令名。 */
export type CommandName =
  | 'plan'
  | 'prepare'
  | 'preview'
  | 'render'
  | 'tts:voice'
  | 'tts:samples';

/** 任务日志行。 */
export interface JobLogLine {
  seq: number;
  stream: 'stdout' | 'stderr';
  time: number;
  text: string;
}

/** 任务产物引用。 */
export interface JobArtifact {
  rel: string;
  url: string;
}

/** 任务快照（提交/查询返回，不含全量日志）。 */
export interface JobSnapshot {
  id: string;
  command: CommandName;
  params: Record<string, unknown>;
  status: JobStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  error: { code: string; message: string; details?: unknown } | null;
  result: unknown;
  artifact: JobArtifact | null;
  logLineCount: number;
}

/** 任务日志增量响应。 */
export interface JobLogResult {
  lines: JobLogLine[];
  nextOffset: number;
  total: number;
}
