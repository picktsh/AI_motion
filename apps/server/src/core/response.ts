// 统一成功响应包络。
// 单资源：{ ok: true, data }
// 列表：{ ok: true, data: { items, meta: { total } } }

export interface ListMeta {
  total: number;
  [key: string]: unknown;
}

export function ok<T>(data: T, meta?: Record<string, unknown>): { ok: true; data: T; meta?: Record<string, unknown> } {
  const body: { ok: true; data: T; meta?: Record<string, unknown> } = { ok: true, data };
  if (meta && Object.keys(meta).length > 0) body.meta = meta;
  return body;
}

export function list<T>(items: T[], meta?: Record<string, unknown>) {
  return ok<{ items: T[]; meta: ListMeta }>(
    { items, meta: { total: items.length, ...meta } },
  );
}
