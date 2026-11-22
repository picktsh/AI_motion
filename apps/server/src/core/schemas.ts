// 复用的 JSON Schema 片段：既用于路由入参校验，也供 @fastify/swagger 生成 OpenAPI 文档。
// 注意：响应 schema 必须保留 additionalProperties: true，否则 Fastify 序列化时会丢弃未列字段。

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  additionalProperties?: boolean;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: readonly unknown[];
  example?: unknown;
  items?: JsonSchema;
  minimum?: number;
  nullable?: boolean;
  format?: string;
}

export const errorResponse: JsonSchema = {
  type: 'object',
  description: '统一错误包络',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', enum: [false], description: '恒为 false' },
    error: {
      type: 'object',
      additionalProperties: true,
      properties: {
        code: { type: 'string', description: '机器可读错误码' },
        message: { type: 'string', description: '可读错误信息' },
        details: { type: 'object', additionalProperties: true, nullable: true },
      },
      required: ['code', 'message'],
    },
  },
  required: ['ok', 'error'],
};

/** 单资源成功包络：{ ok: true, data }。 */
export function envelope(dataSchema: JsonSchema): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean', enum: [true], description: '恒为 true' },
      data: dataSchema,
    },
    required: ['ok', 'data'],
  };
}

/** 列表成功包络：{ ok: true, data: { items, meta: { total } } }。 */
export function listEnvelope(itemSchema: JsonSchema): JsonSchema {
  return envelope({
    type: 'object',
    additionalProperties: false,
    properties: {
      items: { type: 'array', items: itemSchema },
      meta: {
        type: 'object',
        additionalProperties: false,
        properties: { total: { type: 'integer', minimum: 0, description: '条目总数' } },
        required: ['total'],
      },
    },
    required: ['items', 'meta'],
  });
}

/** 各错误状态共用同一错误体结构。 */
export const errorStatuses: Record<number, JsonSchema> = {
  400: errorResponse,
  403: errorResponse,
  404: errorResponse,
  405: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

export const idParam: JsonSchema = {
  type: 'object',
  properties: { id: { type: 'string', description: '条目标识' } },
  required: ['id'],
};
