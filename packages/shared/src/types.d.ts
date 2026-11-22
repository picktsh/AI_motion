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
