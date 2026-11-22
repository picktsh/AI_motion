import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { Envelope } from '@ai-motion/shared/types';

const API_PREFIX = import.meta.env.VITE_SERVER_API;
const serverOrigin = import.meta.env.VITE_SERVER_ORIGIN;

const http: AxiosInstance = axios.create({
  baseURL: API_PREFIX,
  headers: { Accept: 'application/json' },
  timeout: 15_000,
});

function unreachableMessage(): string {
  return `无法连接本地后端服务 ${serverOrigin}，请确认后端已启动`;
}

/** 把 axios 异常归一为带可读 message 的 Error；堆栈与内部细节不外抛给页面。 */
function normalizeError(err: unknown): Error {
  const axErr = err as AxiosError<Envelope<never>>;

  // 没有响应：直连被拒、网络不可达或超时，fetch/XHR 层直接抛错。
  if (!axErr.response) {
    return new Error(unreachableMessage());
  }

  const status = axErr.response.status;
  const body = axErr.response.data;
  const isEnvelope = body != null && typeof body === 'object' && 'ok' in body;

  // 500 且非 JSON：代理/网关层错误，说明后端没起来。
  if (status >= 500 && !isEnvelope) {
    return new Error(unreachableMessage());
  }

  const message = isEnvelope ? body.error?.message : undefined;
  if (message) return new Error(message);
  return new Error(`请求失败 ${status}${axErr.response.statusText ? ` ${axErr.response.statusText}` : ''}`);
}

function unwrap<T>(body: Envelope<T> | undefined): T {
  if (!body || body.ok === false || body.data === undefined) {
    throw new Error('响应格式不符合规范');
  }
  return body.data;
}

async function request<T>(path: string): Promise<T> {
  try {
    const res = await http.get<Envelope<T>>(path);
    return unwrap(res.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

/** 提交 POST 请求并解包 data；错误归一与 GET 一致。 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await http.post<Envelope<T>>(path, body);
    return unwrap(res.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

/** 取单资源或报告：data 即资源本体。 */
export function getJson<T>(path: string): Promise<T> {
  return request<T>(path);
}

/** 取列表：自动解包 data.items，返回数组。 */
export async function getList<T>(path: string): Promise<T[]> {
  const data = await request<{ items: T[]; meta?: { total: number } }>(path);
  return data.items;
}

/** 拼出可直接用于 img/audio/video 或直取静态文件的相对地址。 */
export function assetUrl(relPath: string): string {
  return `${API_PREFIX}${relPath}`;
}
