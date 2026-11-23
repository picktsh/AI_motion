import { config } from '../config.js';
import { ROOT } from '../infra/paths.js';
import { collectEnvironment } from './environment.js';
import { listTemplates, getTemplate } from './templates.js';
import { listProjects } from './projects.js';
import { listAllAssets, listRecentActivity } from './observatory.js';
import { listSamples } from './tts.js';

// 聚合快照：给外部 AI 一次性回吐「服务入口 + 环境 + 模板槽位 + 项目台账 + 素材/音色盘点」。
// 只读、不展开整份 schema 与文件树；模板参数只留一层槽位摘要，避免快照体量失控。

interface ContextTemplate {
  id: string;
  name: string;
  version: string | null;
  runner: 'adapter' | 'cloud';
  origin: string;
  localPath: string;
  paidCloud: boolean;
  network: boolean | null;
  runtime: { profile: string | null; entry: string | null };
  parameters: { file: string | null; fields: Array<Record<string, unknown>> } | null;
}

interface ContextProject {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  templateVersion: string | null;
  templateDir: string;
  status: string;
  duration: number;
  keywords: string[];
  createdAt: string;
  artifactRel: string | null;
}

function summarizeFields(tplId: string): ContextTemplate['parameters'] {
  const detail = getTemplate(tplId);
  if (!detail) return null;
  return {
    file: detail.parameters.file,
    fields: detail.parameters.fields.map((f) => ({
      name: f.name,
      type: f.type,
      required: f.required,
      enum: f.enum,
      defaultValue: f.defaultValue,
      range: f.range,
      description: f.description,
    })),
  };
}

export async function collectContext() {
  const [env, tpls, projects, assets, activity, voices] = await Promise.all([
    collectEnvironment(),
    listTemplates(),
    listProjects(),
    listAllAssets(),
    listRecentActivity(20),
    listSamples(),
  ]);

  const templates: ContextTemplate[] = tpls.map((t) => ({
    id: t.id,
    name: t.name,
    version: t.version,
    runner: t.paidCloud ? 'cloud' : 'adapter',
    origin: t.origin,
    localPath: t.localPath,
    paidCloud: t.paidCloud,
    network: t.network,
    runtime: t.runtime,
    parameters: summarizeFields(t.id),
  }));

  const ctxProjects: ContextProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    templateId: p.templateId,
    templateName: p.templateName,
    templateVersion: p.templateVersion,
    templateDir: p.templateDir,
    status: p.status,
    duration: p.duration,
    keywords: p.keywords,
    createdAt: p.createdAt,
    artifactRel: p.artifactRel,
  }));

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const a of assets) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    bySource[a.source] = (bySource[a.source] ?? 0) + 1;
  }

  return {
    service: {
      name: config.service,
      host: config.host,
      port: config.port,
      apiPrefix: config.apiPrefix,
      /** 是否已强制访问密钥；未配置时本地回环不校验。 */
      accessRequired: Boolean(config.accessKey),
      /** 配了密钥后请求需要带的头名。 */
      authHeader: 'x-access-key',
    },
    workspace: {
      root: ROOT,
      dirs: {
        templates: 'studio/templates',
        projects: 'studio/projects',
        ttsSamples: 'studio/tts/samples',
      },
      conventions:
        '模板包落在 studio/templates/<id>/；每个项目落在 studio/projects/<标题-时间戳>/，文稿在 input/script.txt，投放素材在 input/assets/，成片在 output/。项目台账记在该目录 project.json。',
    },
    environment: env,
    templates,
    projects: ctxProjects,
    assets: {
      total: assets.length,
      byType,
      bySource,
      items: assets.map((a) => ({
        name: a.name,
        type: a.type,
        rel: a.rel,
        source: a.source,
        projectId: a.projectId,
      })),
    },
    voices: voices.map((v) => ({
      file: v.file ?? null,
      voice: v.voice ?? null,
      label: v.label ?? null,
      style: v.style ?? null,
      duration_s: v.duration_s ?? null,
    })),
    activity,
  };
}
