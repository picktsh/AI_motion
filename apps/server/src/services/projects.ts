import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, findBin } from '../infra/paths.js';
import { config } from '../config.js';
import { badRequest, notFound } from '../core/errors.js';
import { submitJob, getJob } from './jobs.js';

// 创作项目：模板 + 文稿 → 报价 → 异步生成（任务服务）→ 作品页发布配置。
// 模板一律来自官网导入，落在 studio/templates/<id>；运行入口跟随模板自身：
// 带 assistant/motion.mjs 的走官方云端（积分），带 adapter.py 的走本机渲染。

export interface Project {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  runner: 'adapter' | 'cloud';
  archiveRel: string;
  scriptRel: string;
  status: 'draft' | 'quoted' | 'running' | 'failed' | 'done';
  createdAt: string;
  duration: number;
  keywords: string[];
  quote: Record<string, unknown> | null;
  artifactRel: string | null;
  videoUrl: string | null;
  logRel: string | null;
  jobId: string | null;
  error: string | null;
  runMaxCredits: number;
}

interface TemplateRef {
  id: string;
  name: string;
  archiveRel: string | null;
  dir: string;
  runner: 'adapter' | 'cloud';
}

function assetUrl(rel: string): string {
  return `${config.apiPrefix}/assets?path=${encodeURIComponent(rel)}`;
}

function projectDir(id: string): string {
  return path.join(ROOT, 'studio', 'projects', id);
}

function writeProject(p: Project): void {
  fs.writeFileSync(path.join(projectDir(p.id), 'project.json'), `${JSON.stringify(p, null, 2)}\n`, 'utf8');
}

function readProject(id: string): Project | null {
  if (!/^[\w一-龥.@-]+$/.test(id)) return null;
  const file = path.join(projectDir(id), 'project.json');
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Project & { kind?: string };
    // 旧版项目字段兼容：kind → runner，补齐任务字段。
    if (!raw.runner) raw.runner = raw.kind === 'personal' ? 'cloud' : 'adapter';
    delete raw.kind;
    raw.jobId ??= null;
    raw.error ??= null;
    raw.runMaxCredits ??= 0;
    return raw;
  } catch {
    return null;
  }
}

function hydrate(p: Project): Project {
  // 服务重启后 running 状态可能悬空：任务不在内存里就按失败回落，允许重跑。
  if (p.status === 'running' && (!p.jobId || !getJob(p.jobId))) {
    p.status = 'failed';
    p.error = p.error ?? '服务重启导致任务中断，请重新生成';
    writeProject(p);
  }
  return {
    ...p,
    videoUrl: p.artifactRel && fs.existsSync(path.join(ROOT, p.artifactRel)) ? assetUrl(p.artifactRel) : null,
  };
}

function findTemplateRef(templateId: string): TemplateRef | null {
  const root = path.join(ROOT, 'studio', 'templates');
  if (!fs.existsSync(root)) return null;
  for (const name of fs.readdirSync(root)) {
    if (name.startsWith('.')) continue;
    const dir = path.join(root, name);
    const motionPath = path.join(dir, 'motion.json');
    if (!fs.existsSync(motionPath)) continue;
    const motion = JSON.parse(fs.readFileSync(motionPath, 'utf8')) as Record<string, unknown>;
    const tmeta = (motion.template ?? {}) as Record<string, unknown>;
    const metaPath = path.join(dir, '.import-meta.json');
    const meta = fs.existsSync(metaPath)
      ? (JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    const slug = String(meta.slug ?? tmeta.id ?? name);
    const canonical = slug.includes('@') ? slug : `${slug}@${String(meta.version ?? tmeta.version ?? '')}`;
    if (canonical !== templateId && name !== templateId && String(tmeta.id ?? '') !== templateId) continue;
    const cloud = fs.existsSync(path.join(dir, 'assistant', 'motion.mjs'));
    if (cloud) {
      const archiveRel = String(meta.archiveRel ?? '');
      if (!archiveRel || !fs.existsSync(path.join(ROOT, archiveRel))) return null;
      return { id: templateId, name: String(meta.name ?? tmeta.name ?? slug), archiveRel, dir, runner: 'cloud' };
    }
    if (!fs.existsSync(path.join(dir, 'adapter.py'))) return null;
    return { id: templateId, name: String(tmeta.name ?? meta.name ?? name), archiveRel: null, dir, runner: 'adapter' };
  }
  return null;
}

export function listProjects(): Project[] {
  const root = path.join(ROOT, 'studio', 'projects');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readProject(d.name))
    .filter((p): p is Project => Boolean(p))
    .map(hydrate)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProject(id: string): Project | null {
  const p = readProject(id);
  return p ? hydrate(p) : null;
}

function safeId(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `${base || 'project'}-${stamp}`;
}

/** 本机渲染模板的本期输入：以包内 text-only 示例为底，替换标题与文案。 */
function writeAdapterInput(tplDir: string, outFile: string, title: string, script: string): number {
  const example = path.join(tplDir, 'examples', 'text-only.json');
  const base: Record<string, unknown> = fs.existsSync(example)
    ? (JSON.parse(fs.readFileSync(example, 'utf8')) as Record<string, unknown>)
    : {
        mode: 'user-media', language: 'zh', layout: 'landscape', duration: 8,
        scenes: [{ id: 'B1', title: '开场' }],
        media: { presenter: { mode: 'none' }, voice: { mode: 'none' }, music: { mode: 'none' } },
        captions: [],
      };
  const lines = script.split(/[。！？!?\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 2);
  base.title = title.slice(0, 30);
  base.basic = {
    keyword: title.slice(0, 12),
    explanation: (lines.length ? lines : [title.slice(0, 12)]).join('\n'),
  };
  fs.writeFileSync(outFile, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  return Number(base.duration) || 8;
}

export function createProject(input: Record<string, unknown>): Project {
  const templateId = String(input.templateId ?? '').trim();
  const title = String(input.title ?? '').trim();
  const script = String(input.script ?? '').trim();
  if (!templateId) throw badRequest('缺少 templateId');
  if (!title) throw badRequest('先填一个作品标题');
  if (!script) throw badRequest('先填口播文稿');
  const tpl = findTemplateRef(templateId);
  if (!tpl) throw notFound('模板不可用：缺少运行入口或原始包，请重新下载导入');

  const id = safeId(title);
  const dir = projectDir(id);
  fs.mkdirSync(path.join(dir, 'input'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
  const scriptRel = `studio/projects/${id}/input/script.txt`;
  fs.writeFileSync(path.join(dir, 'input', 'script.txt'), `${script}\n`, 'utf8');

  let nativeDuration: number | null = null;
  if (tpl.runner === 'adapter') {
    nativeDuration = writeAdapterInput(tpl.dir, path.join(dir, 'input', 'user.json'), title, script);
  }
  const requested = Number(input.duration);

  const project: Project = {
    id,
    name: title,
    templateId,
    templateName: tpl.name,
    runner: tpl.runner,
    archiveRel: tpl.archiveRel ?? '',
    scriptRel,
    status: tpl.runner === 'adapter' ? 'quoted' : 'draft',
    createdAt: new Date().toISOString(),
    duration: nativeDuration ?? (Number.isFinite(requested) && requested > 0 ? requested : 30),
    keywords: String(input.keywords ?? '')
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    quote: tpl.runner === 'adapter' ? { route: 'local-adapter', total: 0, note: '本机渲染，不调用官方云端' } : null,
    artifactRel: null,
    videoUrl: null,
    logRel: null,
    jobId: null,
    error: null,
    runMaxCredits: 0,
  };
  writeProject(project);
  return hydrate(project);
}

function runNode(
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const node = findBin('node') || 'node';
    const proc = spawn(node, args, { cwd, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      stderr += '\n[超时] 命令超过时限已终止';
    }, timeoutMs);
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr }); });
  });
}

function parseJson(stdout: string): Record<string, unknown> | null {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 报价：本机模板直接 0 积分；云端包取免费 quote-only，不提交生成。 */
export async function quoteProject(id: string, maxCredits = 0): Promise<Project> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const tpl = findTemplateRef(project.templateId);
  if (!tpl) throw notFound('模板不可用，请重新下载导入');
  if (tpl.runner === 'adapter') {
    project.quote = { route: 'local-adapter', total: 0, note: '本机渲染，不调用官方云端，不消耗积分' };
    project.status = 'quoted';
    writeProject(project);
    return hydrate(project);
  }

  const dir = projectDir(project.id);
  const instance = path.join(dir, 'instance-quote');
  const assets = path.join(dir, 'input', 'assets');
  fs.mkdirSync(assets, { recursive: true });
  if (!fs.existsSync(path.join(instance, 'motiongit-source.json'))) {
    fs.rmSync(instance, { recursive: true, force: true });
    const init = await runNode(
      [path.join(tpl.dir, 'assistant', 'motion.mjs'), 'new', path.join(ROOT, tpl.archiveRel ?? ''), instance],
      tpl.dir,
      60_000,
    );
    if (init.code !== 0) throw badRequest(`初始化实例失败：${init.stderr.trim().slice(0, 240)}`);
  }

  const { code, stdout, stderr } = await runNode(
    [
      path.join(tpl.dir, 'assistant', 'motion.mjs'), 'api', path.join(ROOT, tpl.archiveRel ?? ''), 'expert',
      '--script', path.join(ROOT, project.scriptRel),
      '--max-credits', String(maxCredits),
      '--assets', assets, '--instance', instance, '--quote-only',
    ],
    tpl.dir,
    120_000,
  );
  const json = parseJson(stdout);
  if (code !== 0 || !json) {
    throw badRequest(`报价失败：${(stderr || stdout).trim().slice(0, 300) || '未知原因'}`);
  }
  project.quote = json;
  project.status = 'quoted';
  writeProject(project);
  return hydrate(project);
}

/** 正式生成：提交异步任务，立即返回；进度由任务服务与 project.json 回写。 */
export function runProject(id: string, maxCredits: number): Project {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const tpl = findTemplateRef(project.templateId);
  if (!tpl) throw notFound('模板不可用，请重新下载导入');
  if (project.status === 'running' && project.jobId && getJob(project.jobId)) {
    throw badRequest('这个项目正在生成中，请等当前任务结束');
  }
  if (!Number.isFinite(maxCredits) || maxCredits < 0) throw badRequest('授权额度不合法');

  project.status = 'running';
  project.error = null;
  project.runMaxCredits = tpl.runner === 'cloud' ? maxCredits : 0;
  project.logRel = `studio/projects/${project.id}/run.log`;
  const job = submitJob('project:run', { projectId: project.id });
  project.jobId = job.id;
  writeProject(project);
  return hydrate(project);
}

/** 官方 Key 余额（只读）；本机模板不查。 */
export async function projectCredits(id: string): Promise<Record<string, unknown>> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const tpl = findTemplateRef(project.templateId);
  if (!tpl) throw notFound('模板不可用');
  if (tpl.runner === 'adapter') {
    return { credits_remaining: null, paid_cloud: false, note: '本机渲染，不查官方额度' };
  }
  const { code, stdout, stderr } = await runNode(
    [path.join(tpl.dir, 'assistant', 'motion.mjs'), 'api', path.join(ROOT, tpl.archiveRel ?? ''), 'usage'],
    tpl.dir,
    60_000,
  );
  const json = parseJson(stdout);
  if (code !== 0 || !json) throw badRequest(`额度查询失败：${(stderr || stdout).trim().slice(0, 200)}`);
  return json;
}

export interface ProjectPublish {
  title: string;
  body: string;
  hashtags: string[];
  covers: { horizontal: string | null; vertical: string | null };
  visibility: string;
  allowSave: boolean;
  publishAt: string;
}

function writePublishText(outDir: string, p: ProjectPublish): void {
  const txt = `${p.title}\n\n${p.body}\n\n${p.hashtags.map((t) => `#${t}`).join(' ')}\n`;
  fs.writeFileSync(path.join(outDir, 'publish.txt'), txt, 'utf8');
}

export function readPublish(id: string): ProjectPublish | null {
  const file = path.join(projectDir(id), 'output', 'publish.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectPublish;
  } catch {
    return null;
  }
}

export function writePublish(id: string, input: Partial<ProjectPublish>): ProjectPublish {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const current = readPublish(id) ?? {
    title: project.name, body: '', hashtags: project.keywords,
    covers: { horizontal: null, vertical: null },
    visibility: 'public', allowSave: true, publishAt: 'now',
  };
  const next: ProjectPublish = {
    title: String(input.title ?? current.title).slice(0, 30),
    body: String(input.body ?? current.body).slice(0, 1000),
    hashtags: Array.isArray(input.hashtags) ? input.hashtags.map(String).slice(0, 10) : current.hashtags,
    covers: {
      horizontal: input.covers?.horizontal ?? current.covers.horizontal,
      vertical: input.covers?.vertical ?? current.covers.vertical,
    },
    visibility: String(input.visibility ?? current.visibility),
    allowSave: Boolean(input.allowSave ?? current.allowSave),
    publishAt: String(input.publishAt ?? current.publishAt),
  };
  const outDir = path.join(projectDir(id), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'publish.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  writePublishText(outDir, next);
  return next;
}

/** 成片 → 发布草稿：4:3 / 3:4 封面、publish.txt、publish.json（作品页编辑）。 */
export async function preparePublish(id: string): Promise<Project> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  if (!project.artifactRel) throw badRequest('还没有成片，先生成');
  const video = path.join(ROOT, project.artifactRel);
  const outDir = path.join(projectDir(id), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const ffmpeg = findBin('ffmpeg') || 'ffmpeg';

  const covers: Array<[string, number, number]> = [
    ['cover-4x3.jpg', 1440, 1080],
    ['cover-3x4.jpg', 1080, 1440],
  ];
  for (const [name, w, h] of covers) {
    await new Promise<void>((resolve) => {
      const proc = spawn(ffmpeg, [
        '-y', '-ss', '2', '-i', video, '-frames:v', '1',
        '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
        path.join(outDir, name),
      ]);
      proc.on('close', () => resolve());
    });
  }

  const existing = readPublish(id);
  const publish: ProjectPublish = existing ?? {
    title: project.name,
    body: fs.existsSync(path.join(ROOT, project.scriptRel))
      ? fs.readFileSync(path.join(ROOT, project.scriptRel), 'utf8').trim()
      : '',
    hashtags: project.keywords,
    covers: { horizontal: 'cover-4x3.jpg', vertical: 'cover-3x4.jpg' },
    visibility: 'public',
    allowSave: true,
    publishAt: 'now',
  };
  fs.writeFileSync(path.join(outDir, 'publish.json'), `${JSON.stringify(publish, null, 2)}\n`, 'utf8');
  writePublishText(outDir, publish);
  project.status = 'done';
  writeProject(project);
  return hydrate(project);
}

export function projectFiles(id: string): Record<string, string | null> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const dir = projectDir(id);
  const rel = (abs: string) => (fs.existsSync(abs) ? path.relative(ROOT, abs).split(path.sep).join('/') : null);
  return {
    video: project.artifactRel,
    cover4x3: rel(path.join(dir, 'output', 'cover-4x3.jpg')),
    cover3x4: rel(path.join(dir, 'output', 'cover-3x4.jpg')),
    publishTxt: rel(path.join(dir, 'output', 'publish.txt')),
    log: project.logRel,
  };
}

export function readLog(id: string, offset = 0): { text: string; next: number } {
  const project = readProject(id);
  if (!project?.logRel) return { text: '', next: 0 };
  const abs = path.join(ROOT, project.logRel);
  if (!fs.existsSync(abs)) return { text: '', next: 0 };
  const full = fs.readFileSync(abs, 'utf8');
  return { text: full.slice(offset), next: full.length };
}
