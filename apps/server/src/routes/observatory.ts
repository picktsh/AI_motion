import type { FastifyInstance } from 'fastify';
import { listAllAssets, listRecentActivity } from '../services/observatory.js';
import { collectContext } from '../services/context.js';
import { ok, list } from '../core/response.js';
import { envelope, errorStatuses, type JsonSchema } from '../core/schemas.js';

const contextSnapshot: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  description: '服务入口、环境、模板槽位、项目台账与素材音色的一次性聚合快照（只读）',
};

// 观测台只读接口：全局资产盘点、最近文件/任务动态、聚合上下文快照。不提供任何写动作。
export function registerObservatory(app: FastifyInstance, prefix: string): void {
  // 归属过滤：scope=project|public 只回对应归属；省略返回全部。
  app.get<{ Querystring: { scope?: string } }>(`${prefix}/observatory/assets`, async (request) => {
    const scope = request.query.scope;
    const all = listAllAssets();
    const items = scope === 'project' || scope === 'public' ? all.filter((a) => a.scope === scope) : all;
    return list(items, { total: items.length });
  });

  app.get<{ Querystring: { limit?: string } }>(`${prefix}/observatory/activity`, async (request) => {
    const limit = Number(request.query.limit ?? 30);
    return ok(listRecentActivity(Number.isFinite(limit) ? limit : 30));
  });

  app.get(`${prefix}/observatory/context`, {
    schema: {
      tags: ['observatory'],
      summary: '聚合上下文快照：供外部 AI 一次性读取环境、模板槽位、项目台账与素材盘点',
      response: { 200: envelope(contextSnapshot), ...errorStatuses },
    },
  }, async () => ok(await collectContext()));
}
