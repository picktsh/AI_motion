import type { FastifyInstance, FastifyReply } from 'fastify';
import type { OutgoingHttpHeaders } from 'node:http';
import {
  listDir,
  readText,
  writeText,
  createDir,
  createFile,
  renameEntry,
  moveEntry,
  removeEntry,
} from '../services/files.js';
import { subscribe, type ChangeEvent } from '../services/watcher.js';
import { ok } from '../core/response.js';

// 文件浏览与文件级操作接口；只读清单与文本读取走白名单目录，写操作走可写根。
// 事件流 /events 为 SSE 单向推送：前端按域订阅，只重拉对应接口。

function queryPath(request: { query: unknown }): string {
  return String((request.query as { path?: string } | undefined)?.path ?? '').trim();
}

export function registerFiles(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/files/tree`, async (request) => ok(listDir(queryPath(request))));

  app.get(`${prefix}/files/text`, async (request) => ok(readText(queryPath(request))));

  app.put<{ Body: { path: string; content: string; expectedSha?: string } }>(
    `${prefix}/files/text`,
    async (request) => {
      const { path: rel, content, expectedSha } = request.body ?? {};
      return ok(writeText(String(rel ?? ''), String(content ?? ''), expectedSha));
    },
  );

  app.post<{ Body: { path: string } }>(`${prefix}/files/dir`, async (request) => {
    return ok(createDir(String(request.body?.path ?? '')));
  });

  app.post<{ Body: { path: string } }>(`${prefix}/files/file`, async (request) => {
    return ok(createFile(String(request.body?.path ?? '')));
  });

  app.post<{ Body: { path: string; name: string } }>(`${prefix}/files/rename`, async (request) => {
    return ok(renameEntry(String(request.body?.path ?? ''), String(request.body?.name ?? '')));
  });

  app.post<{ Body: { path: string; destDir: string } }>(`${prefix}/files/move`, async (request) => {
    return ok(moveEntry(String(request.body?.path ?? ''), String(request.body?.destDir ?? '')));
  });

  app.delete(`${prefix}/files`, async (request) => ok(removeEntry(queryPath(request))));

  app.get(`${prefix}/events`, async (request, reply: FastifyReply) => {
    // 手写 writeHead 会绕过 Fastify 的响应头收集，CORS 头要先从 reply 取出来一并写入，
    // 否则跨端口 SSE 会被浏览器按 CORS 拦掉（/jobs/stream 曾报 No 'Access-Control-Allow-Origin'）。
    const baseHeaders: OutgoingHttpHeaders = {};
    for (const [k, v] of Object.entries(reply.getHeaders())) {
      if (v !== undefined) baseHeaders[k] = v;
    }
    reply.raw.writeHead(200, {
      ...baseHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const unsub = subscribe((event: ChangeEvent) => {
      reply.raw.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
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
}
