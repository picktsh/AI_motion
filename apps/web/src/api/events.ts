import { baseUrl, authHeaders } from '../composables/useServerConfig';
import { endpoints } from './endpoints';

export type ChangeDomain = 'project' | 'artifact' | 'asset' | 'template';
export type ChangeKind = 'add' | 'change' | 'unlink';

export interface ChangeEvent {
  domain: ChangeDomain;
  kind: ChangeKind;
  rel: string;
  at: number;
}

// SSE 单向订阅：fetch + ReadableStream 读取事件流（EventSource 无法携带鉴权头）。
// 连接异常时按退避重连；页面卸载或显式关闭时不再重连。

type Handler = (event: ChangeEvent) => void;

const listeners = new Map<ChangeDomain, Set<Handler>>();
let controller: AbortController | null = null;
let closed = false;
let reconnectTimer: number | undefined;
let attempts = 0;

export function onDomain(domain: ChangeDomain, handler: Handler): () => void {
  if (!listeners.has(domain)) listeners.set(domain, new Set());
  listeners.get(domain)!.add(handler);
  ensureConnected();
  return () => listeners.get(domain)?.delete(handler);
}

function dispatch(event: ChangeEvent): void {
  listeners.get(event.domain)?.forEach((handler) => handler(event));
}

function scheduleReconnect(): void {
  if (closed) return;
  attempts += 1;
  const delay = Math.min(30_000, 1_000 * attempts);
  reconnectTimer = window.setTimeout(connect, delay);
}

async function connect(): Promise<void> {
  if (closed || controller) return;
  controller = new AbortController();
  const signal = controller.signal;
  try {
    const res = await fetch(`${baseUrl()}${endpoints.events}`, {
      headers: { Accept: 'text/event-stream', ...authHeaders() },
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`事件流响应异常 ${res.status}`);
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
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        try {
          dispatch(JSON.parse(dataLine.slice(5).trim()) as ChangeEvent);
        } catch {
          /* 跳过无法解析的心跳或坏帧 */
        }
      }
    }
  } catch {
    /* 连接中断：关流后按退避重连 */
  } finally {
    controller = null;
    if (!signal.aborted) scheduleReconnect();
  }
}

function ensureConnected(): void {
  closed = false;
  void connect();
}

/** 显式关闭：登出或全局卸载时调用，停止重连。 */
export function closeEvents(): void {
  closed = true;
  window.clearTimeout(reconnectTimer);
  controller?.abort();
  controller = null;
}
