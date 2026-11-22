// 统一成功响应包络。
// 单资源：{ ok: true, data }
// 列表：{ ok: true, data: { items, meta: { total } } }

export function ok(data, meta) {
  const body = { ok: true, data };
  if (meta && Object.keys(meta).length > 0) body.meta = meta;
  return body;
}

export function list(items, meta) {
  return ok({ items, meta: { total: items.length, ...meta } });
}
