import { baseUrl, authHeaders, resolveAssetUrl } from '../composables/useServerConfig';
import { endpoints } from './endpoints';
import type { JobLogLine, JobSnapshot } from '../shared/types';

// 任务事件流：SSE 单向订阅任务状态与批量日志（EventSource 无法携带鉴权头，改用 fetch 流）。
// 断流按退避重连；重连成功后回调 onReady，由页面重拉任务表与增量日志补齐缺口。

export type JobStreamEvent =
  | { type: 'job'; job: JobSnapshot }
  | { type: 'log'; jobId: string; lines: JobLogLine[] };

interface StreamHandlers {
  /** 每次（重）连成功后触发，参数为连接瞬间的任务表快照。 */
  onReady?: (jobs: JobSnapshot[]) => void;
  onEvent: (event: JobStreamEvent) => void;
}

function resolveJob(job: JobSnapshot): JobSnapshot {
  return job.artifact
    ? { ...job, artifact: { ...job.artifact, url: resolveAssetUrl(job.artifact.url) ?? job.artifact.url } }
    : job;
}

/** 打开任务事件流；返回关闭函数（停止重连）。 */
export function openJobStream(handlers: StreamHandlers): () => void {
  let controller: AbortController | null = null;
  let closed = false;
  let reconnectTimer: number | undefined;
  let attempts = 0;

  async function connect(): Promise<void> {
    if (closed || controller) return;
    const ctrl = new AbortController();
    controller = ctrl;
    try {
      const res = await fetch(`${baseUrl()}${endpoints.jobs.stream}`, {
        headers: { Accept: 'text/event-stream', ...authHeaders() },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`任务事件流响应异常 ${res.status}`);
      attempts = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const eventName = chunk.split('\n').find((l) => l.startsWith('event:'))?.slice(6).trim();
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!eventName || !dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim()) as unknown;
            if (eventName === 'ready') {
              const jobs = (payload as { jobs?: JobSnapshot[] }).jobs ?? [];
              handlers.onReady?.(jobs.map(resolveJob));
            } else if (eventName === 'job') {
              const event = payload as { job: JobSnapshot };
              handlers.onEvent({ type: 'job', job: resolveJob(event.job) });
            } else if (eventName === 'log') {
              handlers.onEvent(payload as JobStreamEvent);
            }
          } catch {
            /* 跳过心跳与坏帧 */
          }
        }
      }
    } catch {
      /* 连接中断：关流后按退避重连 */
    } finally {
      if (controller === ctrl) controller = null;
      if (!closed && !ctrl.signal.aborted) {
        attempts += 1;
        reconnectTimer = window.setTimeout(connect, Math.min(30_000, 1_000 * attempts));
      }
    }
  }

  void connect();

  return () => {
    closed = true;
    window.clearTimeout(reconnectTimer);
    controller?.abort();
    controller = null;
  };
}
