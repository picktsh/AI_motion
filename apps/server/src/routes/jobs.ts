import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  submitJob,
  getJob,
  listJobs,
  getJobLogs,
  cancelJob,
  subscribeJobs,
} from '../services/jobs.js';
import { commandNames } from '../services/commands.js';
import { notFound } from '../core/errors.js';
import { ok, list } from '../core/response.js';
import { envelope, listEnvelope, errorStatuses, idParam, type JsonSchema } from '../core/schemas.js';

// 命令台任务接口：控制面走 REST（提交/取消/列表/详情/增量日志）。
// 任务状态与日志缓冲在服务层内存态，与传输方式解耦；后续叠加 SSE 推送时，
// 只需在服务层状态迁移与日志入队处挂订阅回调，任务表与本路由结构不变。

const artifact: JsonSchema = {
  type: ['object', 'null'],
  additionalProperties: true,
  required: ['rel', 'url'],
  properties: {
    rel: { type: 'string', description: '相对工程根的产物路径' },
    url: { type: 'string', description: '经资产回显路由访问的地址' },
  },
};

const jobSnapshot: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'command', 'params', 'status', 'createdAt', 'startedAt', 'finishedAt', 'exitCode', 'error', 'result', 'artifact', 'logLineCount'],
  properties: {
    id: { type: 'string' },
    command: { type: 'string', enum: commandNames() },
    params: { type: 'object', additionalProperties: true, description: '提交时的命令参数' },
    status: {
      type: 'string',
      enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
    },
    createdAt: { type: 'integer', description: '入队时间戳（ms）' },
    startedAt: { type: ['integer', 'null'], description: '开始执行时间戳（ms）' },
    finishedAt: { type: ['integer', 'null'], description: '结束时间戳（ms）' },
    exitCode: { type: ['integer', 'null'], description: '子进程退出码' },
    error: {
      type: ['object', 'null'],
      additionalProperties: true,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object', additionalProperties: true, nullable: true },
      },
    },
    result: {
      type: ['object', 'string', 'null'],
      additionalProperties: true,
      description: '成功时的标准输出解析结果（JSON 对象或尾部文本）',
    },
    artifact,
    logLineCount: { type: 'integer', minimum: 0, description: '已保留日志行数' },
  },
};

const logLine: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['seq', 'stream', 'time', 'text'],
  properties: {
    seq: { type: 'integer', description: '单调递增行号' },
    stream: { type: 'string', enum: ['stdout', 'stderr'] },
    time: { type: 'integer', description: '落库时间戳（ms）' },
    text: { type: 'string' },
  },
};

const logResult: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['lines', 'nextOffset', 'total'],
  properties: {
    lines: { type: 'array', items: logLine },
    nextOffset: { type: 'integer', description: '下次拉取应传的 offset' },
    total: { type: 'integer', description: '当前保留日志总行数' },
  },
};

const submitBody: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['command'],
  properties: {
    command: { type: 'string', enum: commandNames(), description: '白名单命令名' },
    params: { type: 'object', additionalProperties: true, description: '命令参数' },
  },
};

const logsQuery: JsonSchema = {
  type: 'object',
  properties: {
    offset: { type: 'integer', minimum: 0, description: '已读到的最后行号，省略从 0 开始' },
  },
};

type IdParams = { id: string };
type SubmitBody = { command: string; params?: Record<string, unknown> };
type LogsQuery = { offset?: number };

export function registerJobs(app: FastifyInstance, prefix: string): void {
  app.post(`${prefix}/jobs`, {
    schema: {
      tags: ['jobs'],
      summary: '提交一条命令台任务',
      body: submitBody,
      response: { 200: envelope(jobSnapshot), ...errorStatuses },
    },
  }, (request) => {
    const body = request.body as SubmitBody;
    return ok(submitJob(body.command, body.params ?? {}));
  });

  app.get(`${prefix}/jobs`, {
    schema: {
      tags: ['jobs'],
      summary: '任务列表（按创建时间倒序，保留最近一批）',
      response: { 200: listEnvelope(jobSnapshot), ...errorStatuses },
    },
  }, () => list(listJobs()));

  // SSE 事件流：连接即回一份当前任务表，随后推送 job（状态迁移）与 log（批量日志）事件。
  // 前端断线重连后按 ready 事件重拉列表与增量日志补齐缺口，任务模型仍走 REST。
  app.get(`${prefix}/jobs/stream`, async (request, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ jobs: listJobs() })}\n\n`);

    const unsub = subscribeJobs((event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 15_000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsub();
    });
    return reply;
  });

  app.get(`${prefix}/jobs/:id`, {
    schema: {
      tags: ['jobs'],
      summary: '任务快照',
      params: idParam,
      response: { 200: envelope(jobSnapshot), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    const job = getJob(id);
    if (!job) throw notFound('任务不存在');
    return ok(job);
  });

  app.get(`${prefix}/jobs/:id/logs`, {
    schema: {
      tags: ['jobs'],
      summary: '增量拉取任务日志（按 offset）',
      params: idParam,
      querystring: logsQuery,
      response: { 200: envelope(logResult), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    const { offset } = request.query as LogsQuery;
    const next = typeof offset === 'number' && Number.isInteger(offset) ? offset : 0;
    return ok(getJobLogs(id, next));
  });

  app.post(`${prefix}/jobs/:id/cancel`, {
    schema: {
      tags: ['jobs'],
      summary: '取消任务：排队中直接取消，运行中终止子进程组',
      params: idParam,
      response: { 200: envelope(jobSnapshot), ...errorStatuses },
    },
  }, (request) => {
    const { id } = request.params as IdParams;
    return ok(cancelJob(id));
  });
}
