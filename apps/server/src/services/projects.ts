import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ROOT, findBin, resolveSafe } from '../infra/paths.js';
import { config } from '../config.js';
import { badRequest, notFound, forbidden, conflict } from '../core/errors.js';
import { mediaType, type MediaType } from '../infra/probe.js';
import { submitJob, getJob } from './jobs.js';
import { projectDir, readProject, writeProject, type Project } from './projectRepository.js';
import { transitionProject } from './projectState.js';

// 创作项目：模板 + 文稿 → 报价 → 异步生成（任务服务）→ 作品页发布配置。
// 模板一律来自官网导入，落在 studio/templates/<id>；运行入口跟随模板自身：
// 带 assistant/motion.mjs 的走官方云端（积分），带 adapter.py 的走本机渲染。

export type { Project } from './projectRepository.js';

interface TemplateRef {
  id: string;
  name: string;
  version: string | null;
  dir: string;
  dirRel: string;
  packageSha256: string | null;
  archiveRel: string | null;
  runner: 'adapter' | 'cloud';
}

function assetUrl(rel: string): string {
  return `${config.apiPrefix}/assets?path=${encodeURIComponent(rel)}`;
}

function hydrate(p: Project): Project {
  // 服务重启后 running 状态可能悬空：任务不在内存里就按失败回落，允许重跑。
  if (p.status === 'running' && (!p.jobId || !getJob(p.jobId))) {
    transitionProject(p, 'failed');
    p.error = p.error ?? '服务重启导致任务中断，请重新生成';
    writeProject(p);
  }
  const scriptText = p.scriptRel && fs.existsSync(path.join(ROOT, p.scriptRel))
    ? fs.readFileSync(path.join(ROOT, p.scriptRel), 'utf8').trim()
    : '';
  return {
    ...p,
    scriptText,
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
    const version = String(meta.version ?? tmeta.version ?? '') || null;
    const packageSha256 = String(meta.packageSha256 ?? '') || null;
    const dirRel = path.relative(ROOT, dir);
    if (cloud) {
      const archiveRel = String(meta.archiveRel ?? '');
      if (!archiveRel || !fs.existsSync(path.join(ROOT, archiveRel))) return null;
      return { id: templateId, name: String(meta.name ?? tmeta.name ?? slug), version, dir, dirRel, packageSha256, archiveRel, runner: 'cloud' };
    }
    if (!fs.existsSync(path.join(dir, 'adapter.py'))) return null;
    return { id: templateId, name: String(tmeta.name ?? meta.name ?? name), version, dir, dirRel, packageSha256, archiveRel: null, runner: 'adapter' };
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
  const zh = String(base.language ?? 'zh') === 'zh';
  // 与 adapter.py 的 basic 字段容量对齐：keyword/explanation 按整段字数上限（中文），超出截断避免 plan 阶段被拒。
  const keywordCap = zh ? 8 : 36;
  const explanationCap = zh ? 42 : 138;
  const explanationSource = lines[0] ?? title.slice(0, keywordCap);
  base.title = title.slice(0, 30);
  base.basic = {
    keyword: title.slice(0, keywordCap),
    explanation: explanationSource.slice(0, explanationCap),
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
    templateVersion: tpl.version,
    templateDir: tpl.dirRel,
    templateSha256: tpl.packageSha256,
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
    transitionProject(project, 'quoted');
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
  transitionProject(project, 'quoted');
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

  transitionProject(project, 'running');
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
  transitionProject(project, 'done');
  writeProject(project);
  return hydrate(project);
}

export function projectFiles(id: string): Record<string, unknown> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const dir = projectDir(id);
  const rel = (abs: string) => (fs.existsSync(abs) ? path.relative(ROOT, abs).split(path.sep).join('/') : null);
  const voiceMetaAbs = path.join(dir, 'input', 'voice.json');
  let voiceMeta: { voice: string; duration_s: number; createdAt: string } | null = null;
  if (fs.existsSync(voiceMetaAbs)) {
    try {
      const raw = JSON.parse(fs.readFileSync(voiceMetaAbs, 'utf8')) as Record<string, unknown>;
      voiceMeta = {
        voice: String(raw.voice ?? ''),
        duration_s: Number(raw.duration_s ?? 0),
        createdAt: String(raw.createdAt ?? ''),
      };
    } catch {
      voiceMeta = null;
    }
  }
  return {
    video: project.artifactRel,
    cover4x3: rel(path.join(dir, 'output', 'cover-4x3.jpg')),
    cover3x4: rel(path.join(dir, 'output', 'cover-3x4.jpg')),
    publishTxt: rel(path.join(dir, 'output', 'publish.txt')),
    log: project.logRel,
    voice: rel(path.join(dir, 'input', 'voice.mp3')),
    voiceMeta,
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

/* ---------- 环节配置：素材 / 配音偏好（独立 studio-config.json，不干涉 adapter 输入 user.json） ---------- */

export interface ProjectAsset {
  name: string;
  type: MediaType;
  rel: string;
  url: string;
}

export interface StudioConfig {
  voicePreference: string | null;
  assets: ProjectAsset[];
}

const ASSET_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.wav', '.m4a', '.aac', '.mp4', '.webm', '.mov', '.mkv']);
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

function studioConfigPath(id: string): string {
  return path.join(projectDir(id), 'input', 'studio-config.json');
}

export function readStudioConfig(id: string): StudioConfig {
  if (!readProject(id)) throw notFound('项目不存在');
  const file = studioConfigPath(id);
  if (!fs.existsSync(file)) return { voicePreference: null, assets: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StudioConfig>;
    return {
      voicePreference: typeof raw.voicePreference === 'string' ? raw.voicePreference : null,
      assets: Array.isArray(raw.assets) ? raw.assets : [],
    };
  } catch {
    return { voicePreference: null, assets: [] };
  }
}

function writeStudioConfig(id: string, cfg: StudioConfig): void {
  fs.mkdirSync(path.join(projectDir(id), 'input'), { recursive: true });
  fs.writeFileSync(studioConfigPath(id), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

export function updateStudioConfig(id: string, patch: { voicePreference?: string | null }): StudioConfig {
  const cfg = readStudioConfig(id);
  if (patch.voicePreference !== undefined) cfg.voicePreference = patch.voicePreference || null;
  writeStudioConfig(id, cfg);
  return cfg;
}

/** 面板内轻编辑：只改标题、文稿这类纯文本；模板入参 user.json 等创作文件仍交外部 AI。 */
export function updateProjectText(id: string, patch: { name?: string; script?: string }): Project {
  const p = readProject(id);
  if (!p) throw notFound('项目不存在');
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw badRequest('标题不能为空');
    if (name.length > 30) throw badRequest('标题不超过 30 字');
    p.name = name;
  }
  if (patch.script !== undefined) {
    const script = patch.script.trim();
    if (!script) throw badRequest('文稿不能为空');
    fs.writeFileSync(path.join(ROOT, p.scriptRel), `${script}\n`, 'utf8');
  }
  writeProject(p);
  return hydrate(p);
}

function assetDir(id: string): string {
  return path.join(projectDir(id), 'input', 'assets');
}

/** 素材清单以磁盘 input/assets 为准，配置里只保留顺序与登记信息。 */
export function listProjectAssets(id: string): ProjectAsset[] {
  if (!readProject(id)) throw notFound('项目不存在');
  const dir = assetDir(id);
  if (!fs.existsSync(dir)) return [];
  const cfg = readStudioConfig(id);
  const ordered = new Map(cfg.assets.map((a) => [a.rel, a]));
  const onDisk = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !['.DS_Store', 'Thumbs.db'].includes(d.name))
    .map((d) => {
      const abs = path.join(dir, d.name);
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      const existing = ordered.get(rel);
      return existing ?? {
        name: d.name,
        type: mediaType(d.name),
        rel,
        url: assetUrl(rel),
      };
    });
  return onDisk;
}

/** 在项目 instance-* 目录的 JSON 里找素材文件名引用；只扫一层，避免深递归拖慢删除。 */
function findInstanceRefs(id: string, filename: string): string[] {
  const root = projectDir(id);
  if (!fs.existsSync(root)) return [];
  const hits: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('instance-')) continue;
    const dir = path.join(root, entry.name);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const text = fs.readFileSync(path.join(dir, file), 'utf8');
        if (text.includes(filename)) hits.push(path.relative(ROOT, path.join(dir, file)).split(path.sep).join('/'));
      } catch {
        /* 坏文件跳过，不影响删除判定 */
      }
    }
  }
  return hits;
}

/** 删除项目素材：磁盘文件与 studio-config 登记一并清理；只允许 input/assets 内条目。 */
export function deleteProjectAsset(id: string, rel: string): { rel: string } {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const dir = assetDir(id);
  const abs = resolveSafe(rel);
  if (!abs) throw forbidden('素材路径越界');
  const normalized = path.normalize(abs);
  if (!normalized.startsWith(dir + path.sep)) throw forbidden('素材路径越界');
  if (!fs.existsSync(normalized)) throw notFound('素材不存在');

  // 引用核对：已渲染实例的 JSON 入参若写着该文件名，删素材会破坏实例复用，先拦下。
  const refs = findInstanceRefs(id, path.basename(normalized));
  if (refs.length) {
    throw conflict('素材仍被已渲染实例引用，请先清理对应实例目录后再删除', { refs });
  }

  fs.rmSync(normalized);
  const cfg = readStudioConfig(id);
  cfg.assets = cfg.assets.filter((a) => a.rel !== rel);
  writeStudioConfig(id, cfg);
  return { rel };
}

export async function saveProjectAsset(id: string, filename: string, source: Readable): Promise<ProjectAsset> {
  if (!readProject(id)) throw notFound('项目不存在');
  const ext = path.extname(filename || '').toLowerCase();
  if (!ASSET_EXTS.has(ext)) throw badRequest('只接收图片、音频或视频素材');

  const base = path.basename(filename || 'upload').trim()
    .slice(0, -ext.length)
    .replace(/[^\w一-龥.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) throw badRequest('文件名不合法');

  fs.mkdirSync(assetDir(id), { recursive: true });
  let name = `${base}${ext}`;
  let n = 1;
  while (fs.existsSync(path.join(assetDir(id), name))) {
    name = `${base}-${n}${ext}`;
    n += 1;
    if (n > 99) throw badRequest('同名素材过多，请先清理目录');
  }

  const abs = path.join(assetDir(id), name);
  const temp = `${abs}.${process.pid}.upload`;
  let bytes = 0;
  try {
    await pipeline(source, new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > MAX_ASSET_BYTES ? badRequest('素材超过 20MB 上限') : null, chunk);
    } }), createWriteStream(temp, { flags: 'wx' }));
    if (bytes === 0) throw badRequest('素材文件为空');
    fs.renameSync(temp, abs);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const asset: ProjectAsset = { name, type: mediaType(name), rel, url: assetUrl(rel) };

  const cfg = readStudioConfig(id);
  cfg.assets = [asset, ...cfg.assets.filter((a) => a.rel !== rel)];
  writeStudioConfig(id, cfg);
  return asset;
}

// 项目封面槽位：横版 4:3、竖版 3:4，固定落在 output 目录，供发布页取用。
const COVER_FILES: Record<'horizontal' | 'vertical', string> = {
  horizontal: 'cover-4x3.jpg',
  vertical: 'cover-3x4.jpg',
};

export async function saveProjectCover(id: string, slot: 'horizontal' | 'vertical', source: Readable): Promise<ProjectAsset> {
  if (!readProject(id)) throw notFound('项目不存在');

  const name = COVER_FILES[slot];
  const outDir = path.join(projectDir(id), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const abs = path.join(outDir, name);
  const temp = `${abs}.${process.pid}.upload`;
  let bytes = 0;
  try {
    await pipeline(source, new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > MAX_ASSET_BYTES ? badRequest('封面超过 20MB 上限') : null, chunk);
    } }), createWriteStream(temp, { flags: 'w' }));
    if (!bytes) throw badRequest('封面文件为空');
    fs.renameSync(temp, abs);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  return { name, type: mediaType(name), rel, url: assetUrl(rel) };
}

/* ---------- 制作步骤条：状态只读派生自 input/output 实有文件，不改数据结构 ---------- */

export interface ProjectStep {
  key: string;
  label: string;
  done: boolean;
  detail: string;
}

function readJsonSafe(abs: string): Record<string, unknown> | null {
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarize(names: string[]): string {
  if (names.length === 0) return '';
  const head = names.slice(0, 3).join('、');
  return names.length > 3 ? `${head} 等 ${names.length} 个` : head;
}

/** 七步：素材 → 台词 → 截图 → 配音 → 字幕 → BGM → 成片。有文件即判完成，不做时长/槽位校验。 */
export function projectSteps(id: string): ProjectStep[] {
  const p = readProject(id);
  if (!p) throw notFound('项目不存在');
  const dir = projectDir(id);
  const inputDir = path.join(dir, 'input');
  const assetDirAbs = path.join(inputDir, 'assets');

  const assetFiles = fs.existsSync(assetDirAbs)
    ? fs.readdirSync(assetDirAbs, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name !== '.DS_Store')
        .map((d) => d.name)
    : [];
  const images = assetFiles.filter((n) => mediaType(n) === 'image');

  const scriptAbs = p.scriptRel ? path.join(ROOT, p.scriptRel) : path.join(inputDir, 'script.txt');
  const scriptOk = fs.existsSync(scriptAbs) && fs.readFileSync(scriptAbs, 'utf8').trim().length > 0;

  const voiceAbs = path.join(inputDir, 'voice.mp3');
  const voiceOk = fs.existsSync(voiceAbs) && fs.statSync(voiceAbs).size > 0;

  const userJson = readJsonSafe(path.join(inputDir, 'user.json'));
  const captions = Array.isArray(userJson?.captions) ? (userJson.captions as unknown[]) : [];
  const vttFile = fs.existsSync(inputDir)
    ? fs.readdirSync(inputDir).find((n) => n.endsWith('.vtt'))
    : undefined;
  const captionOk = captions.length > 0 || Boolean(vttFile);

  const musicRaw = (userJson?.media as { music?: unknown } | undefined)?.music;
  const musicBound = Boolean(musicRaw && typeof musicRaw === 'object' && Object.keys(musicRaw as object).length > 0);
  const bgmFile = assetFiles.find((n) => /bgm|music/i.test(n));
  const musicOk = musicBound || Boolean(bgmFile);

  const artifactAbs = p.artifactRel ? path.join(ROOT, p.artifactRel) : null;
  const artifactOk = Boolean(artifactAbs && fs.existsSync(artifactAbs) && fs.statSync(artifactAbs).size > 0);

  return [
    {
      key: 'assets',
      label: '素材',
      done: assetFiles.length > 0,
      detail: assetFiles.length > 0 ? summarize(assetFiles) : 'input/assets 下还没有素材文件',
    },
    {
      key: 'script',
      label: '台词',
      done: scriptOk,
      detail: scriptOk ? path.basename(scriptAbs) : 'script.txt 为空或缺失',
    },
    {
      key: 'shots',
      label: '截图',
      done: images.length > 0,
      detail: images.length > 0 ? summarize(images) : '素材里还没有图片截图',
    },
    {
      key: 'voice',
      label: '配音',
      done: voiceOk,
      detail: voiceOk ? 'voice.mp3 已生成' : 'input/voice.mp3 缺失',
    },
    {
      key: 'captions',
      label: '字幕',
      done: captionOk,
      detail: captionOk ? (captions.length > 0 ? `user.json ${captions.length} 条字幕` : vttFile ?? '字幕文件已就位') : '未找到字幕条或 vtt 文件',
    },
    {
      key: 'music',
      label: 'BGM',
      done: musicOk,
      detail: musicOk ? (bgmFile ?? 'user.json media.music 已绑定') : '未绑定 BGM，也没有 bgm 音频',
    },
    {
      key: 'artifact',
      label: '成片',
      done: artifactOk,
      detail: artifactOk ? path.basename(p.artifactRel ?? '') : 'output 下还没有成片产物',
    },
  ];
}
