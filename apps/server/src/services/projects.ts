import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, findBin } from '../infra/paths.js';
import { config } from '../config.js';
import { badRequest, notFound } from '../core/errors.js';

// 创作项目：模板 + 文稿 + 素材 → 报价 → 生成 → 发布草稿。
// 个人 .motion 包由包内 assistant/motion.mjs 驱动，项目目录固定 studio/projects/<id>。

export interface Project {
  id: string;
  kind: 'personal' | 'builtin';
  name: string;
  templateId: string;
  templateName: string;
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
}

interface TemplateRef {
  id: string;
  name: string;
  archiveRel: string | null;
  dir: string;
  kind: 'personal' | 'builtin';
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
  if (!/^[\w\u4e00-\u9fa5.@-]+$/.test(id)) return null;
  const file = path.join(projectDir(id), 'project.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Project;
  } catch {
    return null;
  }
}

function hydrate(p: Project): Project {
  const video = p.artifactRel;
  return {
    ...p,
    videoUrl: video && fs.existsSync(path.join(ROOT, video)) ? assetUrl(video) : null,
  };
}

function findTemplateRef(templateId: string): TemplateRef | null {
  const legacyDir = path.join(ROOT, 'studio', 'template');
  if (fs.existsSync(path.join(legacyDir, 'motion.json'))) {
    const motion = JSON.parse(fs.readFileSync(path.join(legacyDir, 'motion.json'), 'utf8')) as Record<string, unknown>;
    const tmeta = (motion.template ?? {}) as Record<string, unknown>;
    if (String(tmeta.id ?? '') === templateId) {
      return { id: templateId, name: String(tmeta.name ?? templateId), archiveRel: null, dir: legacyDir, kind: 'builtin' };
    }
  }
  const root = path.join(ROOT, 'studio', 'templates');
  if (!fs.existsSync(root)) return null;
  for (const name of fs.readdirSync(root)) {
    if (name.startsWith('.')) continue;
    const dir = path.join(root, name);
    const metaPath = path.join(dir, '.import-meta.json');
    const motionPath = path.join(dir, 'motion.json');
    if (!fs.existsSync(motionPath)) continue;
    const meta = fs.existsSync(metaPath)
      ? (JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    const motion = JSON.parse(fs.readFileSync(motionPath, 'utf8')) as Record<string, unknown>;
    const runtime = (motion.runtime ?? {}) as Record<string, unknown>;
    const builtin = runtime.entry === 'adapter.py' || !fs.existsSync(path.join(dir, 'assistant', 'motion.mjs'));
    const slug = String(meta.slug ?? ((motion.template as Record<string, unknown> | undefined)?.id ?? name));
    const tmeta = (motion.template ?? {}) as Record<string, unknown>;
    const canonical = slug.includes('@') ? slug : `${slug}@${String(meta.version ?? tmeta.version ?? '')}`;
    if (canonical !== templateId && name !== templateId) continue;
    if (builtin) return { id: templateId, name: String(tmeta.name ?? name), archiveRel: null, dir, kind: 'builtin' };
    const archiveRel = String(meta.archiveRel ?? '');
    if (!archiveRel || !fs.existsSync(path.join(ROOT, archiveRel))) return null;
    return { id: templateId, name: String(meta.name ?? slug), archiveRel, dir, kind: 'personal' };
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
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `${base || 'project'}-${stamp}`;
}

export function createProject(input: Record<string, unknown>): Project {
  const templateId = String(input.templateId ?? '').trim();
  const title = String(input.title ?? '').trim();
  const script = String(input.script ?? '').trim();
  if (!templateId) throw badRequest('缺少 templateId');
  if (!title) throw badRequest('先填一个作品标题');
  if (!script) throw badRequest('先填口播文稿');
  const tpl = findTemplateRef(templateId);
  if (!tpl) throw notFound('模板不存在，或缺少原始 .motion 包（无法运行）');

  const id = safeId(title);
  const dir = projectDir(id);
  fs.mkdirSync(path.join(dir, 'input'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
  const scriptRel = `studio/projects/${id}/input/script.txt`;
  fs.writeFileSync(path.join(dir, 'input', 'script.txt'), `${script}\n`, 'utf8');

  let nativeDuration: number | null = null;
  if (tpl.kind === 'builtin') {
    nativeDuration = writeBuiltinInput(tpl.dir, path.join(dir, 'input', 'user.json'), title, script);
  }

  const requested = Number(input.duration);
  const project: Project = {
    id,
    kind: tpl.kind,
    name: title,
    templateId,
    templateName: tpl.name,
    archiveRel: tpl.archiveRel ?? '',
    scriptRel,
    status: 'draft',
    createdAt: new Date().toISOString(),
    duration: nativeDuration ?? (Number.isFinite(requested) && requested > 0 ? requested : 30),
    keywords: String(input.keywords ?? '')
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    quote: tpl.kind === 'builtin' ? { route: 'builtin-adapter', total: 0, note: '本机适配器渲染，不调用官方云端' } : null,
    artifactRel: null,
    videoUrl: null,
    logRel: null,
  };
  writeProject(project);
  return hydrate(project);
}

function runNode(
  args: string[],
  cwd: string,
  timeoutMs: number,
  logFile?: string,
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
    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (logFile) fs.appendFileSync(logFile, text);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (logFile) fs.appendFileSync(logFile, text);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function spawnLogged(
  bin: string,
  args: string[],
  envPath: string,
  timeoutMs: number,
  logFile: string,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      cwd: ROOT,
      env: { ...process.env, PATH: envPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      stderr += '\n[超时] 命令超过时限已终止';
    }, timeoutMs);
    proc.stdout.on('data', (b: Buffer) => fs.appendFileSync(logFile, b.toString()));
    proc.stderr.on('data', (b: Buffer) => {
      const text = b.toString();
      stderr += text;
      fs.appendFileSync(logFile, text);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stderr: err.message });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
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

/** 免费报价：不提交付费生成，只拿到路线、消耗与上传内容。 */
export async function quoteProject(id: string, maxCredits = 0): Promise<Project> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const tpl = findTemplateRef(project.templateId);
  if (!tpl) throw notFound('模板不可用');
  if (tpl.kind === 'builtin') {
    project.quote = { route: 'builtin-adapter', total: 0, note: '本机适配器渲染，不调用官方云端，不消耗积分' };
    project.status = 'quoted';
    writeProject(project);
    return hydrate(project);
  }

  const dir = projectDir(project.id);
  const instance = path.join(dir, 'instance');
  const assets = path.join(dir, 'input', 'assets');
  fs.mkdirSync(instance, { recursive: true });
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
      path.join(tpl.dir, 'assistant', 'motion.mjs'),
      'api',
      path.join(ROOT, tpl.archiveRel ?? ''),
      'expert',
      '--script',
      path.join(ROOT, project.scriptRel),
      '--max-credits',
      String(maxCredits),
      '--assets',
      assets,
      '--instance',
      instance,
      '--quote-only',
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

/** 正式生成：按报价授权额度执行；日志落 runs/run.log，产物回填。 */
export async function runProject(id: string, maxCredits: number): Promise<Project> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const tpl = findTemplateRef(project.templateId);
  if (!tpl) throw notFound('模板缺少原始包，无法生成');
  if (!Number.isFinite(maxCredits) || maxCredits < 0) throw badRequest('授权额度不合法');

  const dir = projectDir(project.id);
  const instance = path.join(dir, 'instance');
  const assets = path.join(dir, 'input', 'assets');
  const logRel = `studio/projects/${project.id}/run.log`;
  fs.writeFileSync(path.join(ROOT, logRel), `# ${new Date().toISOString()}\n`, 'utf8');
  project.status = 'running';
  project.logRel = logRel;
  writeProject(project);

  if (tpl.kind === 'builtin') {
    const input = path.join(dir, 'input', 'user.json');
    if (!fs.existsSync(input)) throw badRequest('内置模板缺少输入 user.json');
    const uv = findBin('uv') || 'uv';
    const adapter = path.join(ROOT, 'studio', 'template', 'adapter.py');
    const envPath = `${path.join(ROOT, 'studio', 'bin')}:${process.env.PATH ?? ''}`;
    const prep = await spawnLogged(uv, ['run', adapter, 'prepare', '--input', input, '--out', instance], envPath, 10 * 60_000, path.join(ROOT, logRel));
    if (prep.code !== 0) {
      project.status = 'failed';
      writeProject(project);
      throw badRequest(`准备失败：${prep.stderr.trim().slice(-260)}`);
    }
    const userAssets = path.join(instance, 'user-assets');
    fs.mkdirSync(userAssets, { recursive: true });
    const cover = path.join(ROOT, 'studio', 'videos', 'input', 'cover.png');
    if (fs.existsSync(cover)) fs.copyFileSync(cover, path.join(userAssets, 'cover.png'));
    const out = path.join(dir, 'output', 'video.mp4');
    const render = await spawnLogged(uv, ['run', adapter, 'render', '--instance', instance, '--out', out], envPath, 30 * 60_000, path.join(ROOT, logRel));
    if (render.code !== 0) {
      project.status = 'failed';
      writeProject(project);
      throw badRequest(`渲染失败：${render.stderr.trim().slice(-260)}`);
    }
    project.artifactRel = fs.existsSync(`${out.slice(0, -4)}-with-audio.mp4`)
      ? `studio/projects/${project.id}/output/video-with-audio.mp4`
      : `studio/projects/${project.id}/output/video.mp4`;
    project.status = 'done';
    writeProject(project);
    return hydrate(project);
  }

  const { code, stderr } = await runNode(
    [
      path.join(tpl.dir, 'assistant', 'motion.mjs'),
      'api',
      path.join(ROOT, tpl.archiveRel ?? ''),
      'expert',
      '--script',
      path.join(ROOT, project.scriptRel),
      '--max-credits',
      String(maxCredits),
      '--assets',
      assets,
      '--instance',
      instance,
      '--run',
    ],
    tpl.dir,
    30 * 60_000,
    path.join(ROOT, logRel),
  );

  if (code !== 0) {
    project.status = 'failed';
    writeProject(project);
    throw badRequest(`生成失败：${stderr.trim().slice(-300) || '见 run.log'}`);
  }

  const video = findVideo(instance);
  project.artifactRel = video ? path.relative(ROOT, video).split(path.sep).join('/') : null;
  project.status = video ? 'done' : 'failed';
  writeProject(project);
  return hydrate(project);
}

function findVideo(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const walk = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) return walk(abs);
      return /\.(mp4|mov|webm)$/i.test(e.name) ? [abs] : [];
    });
  const files = walk(dir).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] ?? null;
}

/** 成片 → 发布草稿：4:3 与 3:4 封面、publish.txt、publish.json。 */
export async function preparePublish(id: string): Promise<Project> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  if (!project.artifactRel) throw badRequest('还没有成片，先生成');
  const video = path.join(ROOT, project.artifactRel);
  const outDir = path.join(projectDir(id), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const ffmpeg = findBin('ffmpeg') || 'ffmpeg';

  const covers: Array<[string, string]> = [
    ['cover-4x3.jpg', '4:3'],
    ['cover-3x4.jpg', '3:4'],
  ];
  for (const [name, ratio] of covers) {
    const w = ratio === '4:3' ? 1440 : 1080;
    const h = ratio === '4:3' ? 1080 : 1440;
    await new Promise<void>((resolve) => {
      const proc = spawn(ffmpeg, [
        '-y',
        '-ss',
        '2',
        '-i',
        video,
        '-frames:v',
        '1',
        '-vf',
        `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
        path.join(outDir, name),
      ]);
      proc.on('close', () => resolve());
    });
  }

  const publish = {
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
  const publishJson = path.join(outDir, 'publish.json');
  fs.writeFileSync(publishJson, `${JSON.stringify(publish, null, 2)}\n`, 'utf8');
  const txt = `${publish.title}\n\n${publish.body}\n\n${publish.hashtags.map((t) => `#${t}`).join(' ')}\n`;
  fs.writeFileSync(path.join(outDir, 'publish.txt'), txt, 'utf8');
  project.status = 'done';
  writeProject(project);
  return hydrate(project);
}

/** 查询模板包自带官方 Key 的额度余额（只读，不扣费）。 */
export async function projectCredits(id: string): Promise<Record<string, unknown>> {
  const project = readProject(id);
  if (!project) throw notFound('项目不存在');
  const tpl = findTemplateRef(project.templateId);
  if (!tpl) throw notFound('模板不可用');
  if (tpl.kind === 'builtin') {
    return { credits_remaining: null, paid_cloud: false, note: '内置模板由本机适配器渲染，不查官方额度' };
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

/** 用模板自带 text-only 示例生成内置模板输入；时长由模板原生窗口决定。 */
function writeBuiltinInput(tplDir: string, outFile: string, title: string, script: string): number {
  const example = path.join(tplDir, 'examples', 'text-only.json');
  const base: Record<string, unknown> = fs.existsSync(example)
    ? (JSON.parse(fs.readFileSync(example, 'utf8')) as Record<string, unknown>)
    : { mode: 'user-media', language: 'zh', layout: 'landscape', duration: 8, scenes: [{ id: 'B1', title: '开场' }], media: { presenter: { mode: 'none' }, voice: { mode: 'none' }, music: { mode: 'none' } }, captions: [] };
  const lines = script.split(/[。！？!?\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 2);
  base.title = title.slice(0, 30);
  base.basic = {
    keyword: title.slice(0, 12),
    explanation: (lines.length ? lines : [title.slice(0, 12)]).join('\n'),
  };
  fs.writeFileSync(outFile, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  return Number(base.duration) || 8;
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
