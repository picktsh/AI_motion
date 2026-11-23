import type { FastifyInstance } from 'fastify';
import {
  createProject,
  getProject,
  listProjects,
  preparePublish,
  projectCredits,
  readPublish,
  writePublish,
  projectFiles,
  quoteProject,
  readLog,
  runProject,
  readStudioConfig,
  updateStudioConfig,
  listProjectAssets,
  saveProjectAsset,
  saveProjectCover,
  updateProjectText,
} from '../services/projects.js';
import { badRequest, notFound } from '../core/errors.js';
import { ok, list } from '../core/response.js';
import { envelope, listEnvelope, errorStatuses, idParam } from '../core/schemas.js';

export function registerProjects(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/projects`, async () => list(listProjects()));

  app.get<{ Params: { id: string } }>(
    `${prefix}/projects/:id`,
    { schema: { params: idParam, response: { ...errorStatuses } } },
    async (request) => {
      const project = getProject(request.params.id);
      if (!project) throw notFound('项目不存在');
      return ok(project);
    },
  );

  app.post<{ Body: Record<string, unknown> }>(`${prefix}/projects`, async (request) => {
    const body = request.body ?? {};
    return ok(createProject(body));
  });

  app.post<{ Params: { id: string }; Body: { maxCredits?: number } }>(
    `${prefix}/projects/:id/quote`,
    async (request) => {
      const maxCredits = Number(request.body?.maxCredits ?? 0);
      return ok(await quoteProject(request.params.id, maxCredits));
    },
  );

  app.post<{ Params: { id: string }; Body: { maxCredits?: number } }>(
    `${prefix}/projects/:id/run`,
    async (request) => {
      const maxCredits = Number(request.body?.maxCredits ?? 0);
      return ok(runProject(request.params.id, maxCredits));
    },
  );

  app.post<{ Params: { id: string } }>(`${prefix}/projects/:id/prepare-publish`, async (request) =>
    ok(await preparePublish(request.params.id)),
  );

  app.get<{ Params: { id: string } }>(`${prefix}/projects/:id/credits`, async (request) =>
    ok(await projectCredits(request.params.id)),
  );

  app.get<{ Params: { id: string } }>(`${prefix}/projects/:id/publish`, async (request) =>
    ok(readPublish(request.params.id)),
  );

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    `${prefix}/projects/:id/publish`,
    async (request) => ok(writePublish(request.params.id, request.body ?? {})),
  );

  app.get<{ Params: { id: string } }>(`${prefix}/projects/:id/files`, async (request) =>
    ok(projectFiles(request.params.id)),
  );

  app.get<{ Params: { id: string }; Querystring: { offset?: string } }>(
    `${prefix}/projects/:id/log`,
    async (request) => ok(readLog(request.params.id, Number(request.query.offset ?? 0))),
  );

  app.get<{ Params: { id: string } }>(`${prefix}/projects/:id/config`, async (request) =>
    ok(readStudioConfig(request.params.id)),
  );

  app.put<{ Params: { id: string }; Body: { voicePreference?: string | null } }>(
    `${prefix}/projects/:id/config`,
    async (request) => ok(updateStudioConfig(request.params.id, request.body ?? {})),
  );

  app.put<{ Params: { id: string }; Body: { name?: string; script?: string } }>(
    `${prefix}/projects/:id/text`,
    async (request) => ok(updateProjectText(request.params.id, request.body ?? {})),
  );

  app.get<{ Params: { id: string } }>(`${prefix}/projects/:id/assets`, async (request) =>
    list(listProjectAssets(request.params.id)),
  );

  app.post<{ Params: { id: string } }>(`${prefix}/projects/:id/assets`, {
    schema: {
      tags: ['projects'],
      summary: '上传项目素材（图片/音频/视频，multipart 字段 file，落 input/assets）',
      consumes: ['multipart/form-data'],
      params: idParam,
    },
  }, async (request) => {
    let part;
    try {
      part = await request.file();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      throw badRequest(`读取上传文件失败：${message || '未知原因'}`);
    }
    if (!part) throw badRequest('缺少上传文件字段 file');
    const saved = await saveProjectAsset(request.params.id, part.filename || 'asset', part.file);
    return ok(saved);
  });

  app.post<{ Params: { id: string }; Querystring: { slot?: string } }>(
    `${prefix}/projects/:id/cover`,
    {
      schema: {
        tags: ['projects'],
        summary: '上传项目封面（multipart 字段 file，slot=horizontal/vertical，落 output）',
        consumes: ['multipart/form-data'],
        params: idParam,
      },
    }, async (request) => {
      const slot = request.query.slot === 'vertical' ? 'vertical' : 'horizontal';
      let part;
      try {
        part = await request.file();
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        throw badRequest(`读取上传文件失败：${message || '未知原因'}`);
      }
      if (!part) throw badRequest('缺少上传文件字段 file');
      const saved = await saveProjectCover(request.params.id, slot, part.file);
      return ok(saved);
    },
  );
}
