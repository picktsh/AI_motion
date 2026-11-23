import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { Envelope } from '@ai-motion/shared/types';
import { useServerConfig } from '../composables/useServerConfig';

const { baseUrl, apiUrl, authHeaders, state } = useServerConfig();

const http: AxiosInstance = axios.create({
  baseURL: baseUrl(),
  headers: { Accept: 'application/json' },
  timeout: 15_000,
});

// 每次请求前同步最新配置（看门页/环境页改地址后无需重建实例），并带上访问密钥。
http.interceptors.request.use((config) => {
  config.baseURL = baseUrl();
  Object.assign(config.headers, authHeaders());
  return config;
});

function unreachableMessage(): string {
  return `无法连接后端服务 ${state.origin}，请确认后端已启动且地址正确`;
}

/** 归一后的错误：保留后端错误体的 details（如缺失依赖清单），供页面二次展示。 */
export interface NormalizedError extends Error {
  details?: unknown;
}

/** 把 axios 异常归一为带可读 message 的 Error；堆栈与内部细节不外抛给页面。 */
function normalizeError(err: unknown): NormalizedError {
  const axErr = err as AxiosError<Envelope<never>>;

  // 没有响应：直连被拒、网络不可达或超时，fetch/XHR 层直接抛错。
  if (!axErr.response) {
    return new Error(unreachableMessage()) as NormalizedError;
  }

  const status = axErr.response.status;
  const body = axErr.response.data;
  const isEnvelope = body != null && typeof body === 'object' && 'ok' in body;

  // 500 且非 JSON：代理/网关层错误，说明后端没起来。
  if (status >= 500 && !isEnvelope) {
    return new Error(unreachableMessage()) as NormalizedError;
  }

  const message = isEnvelope ? body.error?.message : undefined;
  const details = isEnvelope ? body.error?.details : undefined;
  const e = new Error(
    message ?? `请求失败 ${status}${axErr.response.statusText ? ` ${axErr.response.statusText}` : ''}`,
  ) as NormalizedError;
  if (details != null) e.details = details;
  return e;
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

/** 提交 multipart 表单（文件上传）；timeout 放开，可回报上传百分比。 */
export async function postForm<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  try {
    const res = await http.post<Envelope<T>>(path, form, {
      timeout: 0,
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      },
    });
    return unwrap(res.data);
  } catch (err) {
    throw normalizeError(err);
  }
}

/** 提交 PUT 请求并解包 data；错误归一与 GET 一致。 */
export async function putJson<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await http.put<Envelope<T>>(path, body);
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

/** 拼出可直接用于 img/audio/video 或直取静态文件的绝对地址。 */
export function assetUrl(relPath: string): string {
  return apiUrl(relPath);
}
