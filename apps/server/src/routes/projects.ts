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
}
