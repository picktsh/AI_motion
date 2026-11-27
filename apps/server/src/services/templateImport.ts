import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import yauzl from 'yauzl';
import { ROOT } from '../infra/paths.js';
import { badRequest, conflict } from '../core/errors.js';

// .motion 是 zip 容器，根目录直接是包内容。目前兼容两代包：
// 1) legacy（specVersion 0.1.x）：motion.json 内有 template/runtime.entry/license，带 integrity.json 逐文件哈希。
// 2) personal-download（specVersion 1.0.0-rc.1）：元数据在 assistant/guide.json 与 personal/receipt.json，
//    入口是 assistant/motion.mjs，内容加密封装在 content/release.bin，逐文件哈希在 receipt.files。
// 导入流程：解压到暂存目录 → 按对应格式校验 → 整体 rename 落到 studio/templates/<id>@<version>。
const MAX_PACKAGE_BYTES = 500 * 1024 * 1024;
const MAX_ENTRY_COUNT = 8000;
const MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024 * 1024;
const SKIP_PREFIXES = ['__MACOSX/'];
const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

const TEMPLATES_DIR = path.join(ROOT, 'studio', 'templates');
const STAGING_DIR = path.join(TEMPLATES_DIR, '.staging');

export interface ImportedTemplate {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  localPath: string;
  fileCount: number;
  bytes: number;
  packageSha256: string;
  integrity: 'verified' | 'absent';
  integritySource: string | null;
  verifiedFiles: number;
  packageProfile: string | null;
  specVersion: string | null;
  layout: 'legacy' | 'personal';
  hasPersonalKey: boolean;
  contentProtection: string | null;
  templateId: number | null;
  output: { width: number | null; height: number | null; layout: string | null } | null;
  sourceFilename: string;
  importedAt: string;
}

interface ExtEntry {
  entry?: string;
  guide?: string;
  profile?: string;
  templateId?: number;
  templateVersion?: string;
  templateSlug?: string;
  stage?: string;
}

interface MotionMeta {
  format?: string;
  specVersion?: string;
  packageProfile?: string;
  template?: { id?: string; version?: string; name?: string };
  runtime?: { entry?: string; profile?: string; operation?: string };
  license?: { file?: string };
  output?: unknown;
  integrity?: string;
  content?: { path?: string; protection?: string; sha256?: string };
  personal?: { credentials?: string; receipt?: string; signature?: string };
  extensions?: Record<string, ExtEntry | undefined>;
}

interface GuideTemplate {
  template?: { id?: string; name?: string; version?: string; width?: number; height?: number; layout?: string };
  parameterSchema?: unknown;
}

interface ReceiptFile {
  bytes?: number;
  sha256?: string;
}

interface Receipt {
  templateId?: number;
  templateSlug?: string;
  templateVersion?: string;
  profile?: string;
  files?: Record<string, ReceiptFile | string>;
}

interface PackageInfo {
  layout: 'legacy' | 'personal';
  slug: string;
  name: string;
  version: string | null;
  entry: string;
  runtimeProfile: string | null;
  licenseFile: string | null;
  files: Record<string, string> | null;
  integritySource: string | null;
  contentPath: string | null;
  contentSha: string | null;
  contentProtection: string | null;
  hasPersonalKey: boolean;
  templateId: number | null;
  output: { width: number | null; height: number | null; layout: string | null } | null;
}

interface EntryMeta {
  normalized: string;
  isDir: boolean;
  size: number;
}

function openZip(archivePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    // lazyEntries：按需逐条读取，避免一次性把 entry 表读进内存。
    yauzl.open(archivePath, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err || !zip) reject(err ?? new Error('无法读取压缩包'));
      else resolve(zip);
    });
  });
}

function openEntryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) reject(err ?? new Error('无法读取压缩包条目'));
      else resolve(stream);
    });
  });
}

/** 归一 zip 条目名并挡掉穿越、绝对路径、反斜杠与符号链接。 */
function normalizeEntryName(name: string): string | null {
  if (!name || name.startsWith('/') || name.includes('\\')) return null;
  const parts = name.split('/').filter((s) => s !== '' && s !== '.');
  if (!parts.length) return null;
  if (parts.some((s) => s === '..')) return null;
  return parts.join('/');
}

function isSymlink(entry: yauzl.Entry): boolean {
  // 高 16 位是 unix mode；0xA000 表示符号链接。
  const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
  return mode === 0xa000;
}

function shouldSkip(name: string): boolean {
  if (SKIP_PREFIXES.some((p) => name.startsWith(p))) return true;
  return SKIP_NAMES.has(name.split('/').pop() ?? '');
}

/** 第一遍：只读条目表，做数量/体积/路径安全检查并收集清单。 */
async function scanEntries(archivePath: string): Promise<{ entries: EntryMeta[] }> {
  const zip = await openZip(archivePath);
  const entries: EntryMeta[] = [];
  let uncompressed = 0;

  return new Promise((resolve, reject) => {
    const fail = (e: Error) => {
      zip.close();
      reject(e);
    };

    zip.on('error', fail);
    zip.on('entry', (entry: yauzl.Entry) => {
      const raw = entry.fileName;
      const normalized = normalizeEntryName(raw);
      const isDir = raw.endsWith('/');
      if (isSymlink(entry)) {
        fail(badRequest('压缩包内含符号链接，已拒绝导入', { entry: raw }));
        return;
      }
      if (!normalized) {
        fail(badRequest('压缩包内含非法路径，已拒绝导入', { entry: raw }));
        return;
      }
      if (!shouldSkip(normalized)) {
        entries.push({ normalized, isDir, size: entry.uncompressedSize });
        uncompressed += entry.uncompressedSize;
        if (entries.length > MAX_ENTRY_COUNT || uncompressed > MAX_UNCOMPRESSED_BYTES) {
          fail(badRequest('压缩包条目过多或解压体积过大，已拒绝导入'));
          return;
        }
      }
      zip.readEntry();
    });
    zip.on('end', () => {
      zip.close();
      resolve({ entries });
    });
    zip.readEntry();
  });
}

/** 多数打包工具会套一层同名目录；识别出统一前缀后剥掉。 */
function detectPrefix(entries: EntryMeta[]): string {
  const names = entries.filter((e) => !e.isDir).map((e) => e.normalized);
  if (names.some((n) => n === 'motion.json')) return '';
  const firstSegments = new Set(names.map((n) => n.split('/')[0]));
  if (firstSegments.size === 1) {
    const only = [...firstSegments][0];
    if (names.includes(`${only}/motion.json`)) return `${only}/`;
  }
  return '';
}

/** 第二遍：逐条解压并边写边算 sha256。 */
async function extractEntries(
  archivePath: string,
  prefix: string,
  destDir: string,
): Promise<{ hashes: Map<string, string>; fileCount: number; bytes: number }> {
  const zip = await openZip(archivePath);
  const hashes = new Map<string, string>();
  let fileCount = 0;
  let bytes = 0;

  const handleEntry = async (entry: yauzl.Entry): Promise<void> => {
    const normalized = normalizeEntryName(entry.fileName);
    if (!normalized || shouldSkip(normalized)) return;
    const rel = prefix && normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
    if (!rel) return;

    const destAbs = path.join(destDir, rel);
    if (!destAbs.startsWith(destDir + path.sep)) throw badRequest('压缩包路径越界，已拒绝导入');

    if (entry.fileName.endsWith('/')) {
      await fs.promises.mkdir(destAbs, { recursive: true });
      return;
    }

    await fs.promises.mkdir(path.dirname(destAbs), { recursive: true });
    const stream = await openEntryStream(zip, entry);
    const hash = crypto.createHash('sha256');
    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        hash.update(chunk);
        bytes += chunk.length;
        cb(null, chunk);
      },
    });
    await pipeline(stream, meter, fs.createWriteStream(destAbs, { flags: 'wx' }));
    hashes.set(rel, hash.digest('hex'));
    fileCount += 1;
  };

  await new Promise<void>((resolve, reject) => {
    let chain: Promise<void> = Promise.resolve();
    zip.on('error', (e) => reject(e));
    zip.on('entry', (entry: yauzl.Entry) => {
      chain = chain
        .then(() => handleEntry(entry))
        .then(() => zip.readEntry())
        .catch((e) => {
          zip.close();
          reject(e);
        });
    });
    zip.on('end', () => {
      chain.then(() => {
        zip.close();
        resolve();
      }).catch(reject);
    });
    zip.readEntry();
  });

  return { hashes, fileCount, bytes };
}

function readJson<T>(abs: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as T;
  } catch {
    return null;
  }
}

function safeSeg(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9\u4e00-\u9fa5._-]+/g, '-')
    .replace(/^[.\-]+/, '')
    .slice(0, 80);
}

function existsIn(dir: string, rel: string | null | undefined): boolean {
  return Boolean(rel) && fs.existsSync(path.join(dir, rel as string));
}

/** receipt.files 有的是 {bytes, sha256}，有的直接是哈希字符串；统一取哈希。 */
function normalizeHashFiles(files: Record<string, ReceiptFile | string> | undefined): Record<string, string> | null {
  if (!files) return null;
  const out: Record<string, string> = {};
  for (const [rel, val] of Object.entries(files)) {
    const sha = typeof val === 'string' ? val : val?.sha256;
    if (typeof sha === 'string' && sha) out[rel] = sha;
  }
  return Object.keys(out).length ? out : null;
}

/** 识别包的代际并抽出统一的元数据；元数据缺失时给出可读的失败原因。 */
function describePackage(stagingDir: string, motion: MotionMeta): PackageInfo {
  const assistant = motion.extensions?.['motiongit.com:assistant-entry'];
  const stage = motion.extensions?.['motiongit.com:delivery-stage'];
  const guide = readJson<GuideTemplate>(
    path.join(stagingDir, assistant?.guide ?? 'assistant/guide.json'),
  );
  const receipt = readJson<Receipt>(path.join(stagingDir, motion.personal?.receipt ?? 'personal/receipt.json'));

  const personal = motion.packageProfile === 'personal-download-v1' || Boolean(stage);
  if (personal) {
    const rawId = guide?.template?.id ?? receipt?.templateSlug ?? stage?.templateSlug ?? null;
    if (typeof rawId !== 'string' || !safeSeg(rawId)) {
      throw badRequest('个人下载包缺少模板标识', {
        guide: guide?.template?.id ?? null,
        receipt: receipt?.templateSlug ?? null,
      });
    }
    const rawVersion = guide?.template?.version ?? receipt?.templateVersion ?? stage?.templateVersion ?? null;
    const entry = typeof assistant?.entry === 'string' ? assistant.entry : 'assistant/motion.mjs';
    if (!existsIn(stagingDir, entry)) throw badRequest('个人下载包缺少随包入口', { entry });

    const contentPath = typeof motion.content?.path === 'string' ? motion.content.path : null;
    if (contentPath && !existsIn(stagingDir, contentPath)) {
      throw badRequest('个人下载包缺少封装内容文件', { contentPath });
    }
    const files = normalizeHashFiles(receipt?.files);
    if (!files) throw badRequest('个人下载包缺少逐文件校验清单（personal/receipt.json）');

    return {
      layout: 'personal',
      slug: safeSeg(rawId),
      name: guide?.template?.name ?? safeSeg(rawId),
      version: rawVersion ? safeSeg(rawVersion) || null : null,
      entry,
      runtimeProfile: motion.runtime?.profile ?? assistant?.profile ?? null,
      licenseFile: null,
      files,
      integritySource: 'personal/receipt.json',
      contentPath,
      contentSha: typeof motion.content?.sha256 === 'string' ? motion.content.sha256 : null,
      contentProtection: typeof motion.content?.protection === 'string' ? motion.content.protection : null,
      hasPersonalKey: existsIn(stagingDir, motion.personal?.credentials ?? 'personal/motiongit.key.json'),
      templateId: typeof receipt?.templateId === 'number'
        ? receipt.templateId
        : typeof stage?.templateId === 'number'
          ? stage.templateId
          : null,
      output: guide?.template
        ? {
            width: typeof guide.template.width === 'number' ? guide.template.width : null,
            height: typeof guide.template.height === 'number' ? guide.template.height : null,
            layout: guide.template.layout ?? null,
          }
        : null,
    };
  }

  // legacy：motion.json 自带 template/runtime/license 与 integrity.json
  const rawId = motion.template?.id;
  if (typeof rawId !== 'string' || !safeSeg(rawId)) {
    throw badRequest('motion.json 缺少合法的 template.id');
  }
  const entry = typeof motion.runtime?.entry === 'string' ? motion.runtime.entry : '';
  if (!entry || !existsIn(stagingDir, entry)) throw badRequest('缺少运行时入口文件', { entry });
  const licenseFile = typeof motion.license?.file === 'string' ? motion.license.file : null;
  if (licenseFile && !existsIn(stagingDir, licenseFile)) {
    throw badRequest('缺少声明的许可文件', { licenseFile });
  }

  const integrityFile = typeof motion.integrity === 'string' ? motion.integrity : 'integrity.json';
  const manifest = readJson<{ files?: Record<string, string> }>(path.join(stagingDir, integrityFile));
  return {
    layout: 'legacy',
    slug: safeSeg(rawId),
    name: motion.template?.name ?? safeSeg(rawId),
    version: typeof motion.template?.version === 'string' ? safeSeg(motion.template.version) || null : null,
    entry,
    runtimeProfile: motion.runtime?.profile ?? null,
    licenseFile,
    files: normalizeHashFiles(manifest?.files),
    integritySource: manifest?.files ? integrityFile : null,
    contentPath: null,
    contentSha: null,
    contentProtection: null,
    hasPersonalKey: false,
    templateId: null,
    output: null,
  };
}

/** 逐文件哈希核对：缺失与不符都算失败。 */
function verifyFiles(
  hashes: Map<string, string>,
  files: Record<string, string> | null,
): { state: 'verified' | 'absent'; verifiedFiles: number; mismatched: string[]; missing: string[] } {
  if (!files) return { state: 'absent', verifiedFiles: 0, mismatched: [], missing: [] };
  const mismatched: string[] = [];
  const missing: string[] = [];
  let verified = 0;
  for (const [rel, expected] of Object.entries(files)) {
    const actual = hashes.get(rel);
    if (actual == null) {
      missing.push(rel);
      continue;
    }
    if (actual !== expected) {
      mismatched.push(rel);
      continue;
    }
    verified += 1;
  }
  return { state: 'verified', verifiedFiles: verified, mismatched, missing };
}

// 凭据扫描：包内代码/文档出现第三方服务密钥即拒绝导入，避免把别人的 Key 带进工程。
// personal/ 下随包密钥属于包自带凭证（hasPersonalKey 已提示），不算第三方泄漏，单独排除。
const CREDENTIAL_EXT = new Set([
  '.json', '.js', '.mjs', '.cjs', '.ts', '.md', '.txt', '.yml', '.yaml', '.env',
  '.pem', '.sh', '.py', '.toml', '.xml', '.html',
]);
const SCAN_MAX_BYTES = 512 * 1024;
const SECRET_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'openai-like sk-', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { kind: 'volcengine-ak', re: /\bAKLT[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'generic-secret', re: /["']?(api[_-]?key|secret[_-]?key|access[_-]?token)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{24,}["']/i },
];
// 占位符不算泄漏：模板里的示例配置常写 your-key / sk-xxxx / <token>。
const PLACEHOLDER = /x{3,}|your[_-]|example|placeholder|replace|dummy|sample|test|demo|<|>|\*{3,}/i;

function scanCredentials(
  hashes: Map<string, string>,
  dir: string,
): Array<{ file: string; kind: string }> {
  const findings: Array<{ file: string; kind: string }> = [];
  for (const rel of hashes.keys()) {
    if (rel.startsWith('personal/')) continue;
    if (!CREDENTIAL_EXT.has(path.extname(rel).toLowerCase())) continue;
    if (findings.length >= 20) break;
    let text: string;
    try {
      const stat = fs.statSync(path.join(dir, rel));
      if (stat.size > SCAN_MAX_BYTES) continue;
      text = fs.readFileSync(path.join(dir, rel), 'utf8');
    } catch {
      continue;
    }
    for (const { kind, re } of SECRET_PATTERNS) {
      const m = text.match(re);
      if (!m) continue;
      if (m[0].length > 12 && PLACEHOLDER.test(m[0])) continue;
      findings.push({ file: rel, kind });
      break;
    }
  }
  return findings;
}

// 来源锁定：每次成功导入登记包哈希与来源，templates.lock.json 作为可审计清单。
const LOCK_FILE = path.join(TEMPLATES_DIR, 'templates.lock.json');

export interface LockEntry {
  id: string;
  slug: string;
  version: string | null;
  packageSha256: string;
  fileCount: number;
  bytes: number;
  sourceFilename: string;
  importedAt: string;
  layout: string;
  specVersion: string | null;
  packageProfile: string | null;
  runtimeProfile: string | null;
}

interface LockFile {
  version: number;
  updatedAt: string;
  packages: Record<string, LockEntry>;
}

function readLockFile(): LockFile {
  const parsed = readJson<Partial<LockFile>>(LOCK_FILE);
  if (!parsed || typeof parsed !== 'object' || !parsed.packages || typeof parsed.packages !== 'object') {
    return { version: 1, updatedAt: new Date(0).toISOString(), packages: {} };
  }
  return {
    version: parsed.version ?? 1,
    updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    packages: parsed.packages as Record<string, LockEntry>,
  };
}

function writeLockEntry(meta: ImportedTemplate, runtimeProfile: string | null): void {
  const lock = readLockFile();
  lock.packages[meta.id] = {
    id: meta.id,
    slug: meta.slug,
    version: meta.version,
    packageSha256: meta.packageSha256,
    fileCount: meta.fileCount,
    bytes: meta.bytes,
    sourceFilename: meta.sourceFilename,
    importedAt: meta.importedAt,
    layout: meta.layout,
    specVersion: meta.specVersion,
    packageProfile: meta.packageProfile,
    runtimeProfile,
  };
  lock.updatedAt = new Date().toISOString();
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  const temp = `${LOCK_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, LOCK_FILE);
}

/** 读锁定清单并核对磁盘：目录缺失记 missing，包哈希与 .import-meta 不一致记 changed。 */
export function readLockStatus(): { updatedAt: string; packages: Array<LockEntry & { status: 'ok' | 'missing' | 'changed' }> } {
  const lock = readLockFile();
  const packages = Object.values(lock.packages).map((entry) => {
    const dir = path.join(TEMPLATES_DIR, entry.id);
    if (!fs.existsSync(dir)) return { ...entry, status: 'missing' as const };
    const meta = readJson<ImportedTemplate>(path.join(dir, '.import-meta.json'));
    if (meta?.packageSha256 && meta.packageSha256 !== entry.packageSha256) {
      return { ...entry, status: 'changed' as const };
    }
    return { ...entry, status: 'ok' as const };
  });
  return { updatedAt: lock.updatedAt, packages };
}

export async function importMotionPackage(
  archivePath: string,
  sourceFilename: string,
): Promise<ImportedTemplate> {
  const stat = fs.statSync(archivePath);
  if (!stat.isFile() || stat.size === 0) throw badRequest('上传文件为空');
  if (stat.size > MAX_PACKAGE_BYTES) {
    throw badRequest(`包体超过 ${Math.round(MAX_PACKAGE_BYTES / 1024 / 1024)} MB 上限`);
  }

  const { entries } = await scanEntries(archivePath);
  if (!entries.length) throw badRequest('压缩包为空');
  const prefix = detectPrefix(entries);
  if (!entries.some((e) => e.normalized === `${prefix}motion.json`)) {
    throw badRequest('不是有效的 .motion 包：根目录缺少 motion.json');
  }

  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const stagingDir = fs.mkdtempSync(path.join(STAGING_DIR, 'import-'));
  const packageSha = await new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(archivePath)
      .on('data', (c) => hash.update(c as Buffer))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });

  try {
    const { hashes, fileCount, bytes } = await extractEntries(archivePath, prefix, stagingDir);
    const motion = readJson<MotionMeta>(path.join(stagingDir, 'motion.json'));
    if (!motion || motion.format !== 'motiongit-template') {
      throw badRequest('motion.json 的 format 不是 motiongit-template', { format: motion?.format ?? null });
    }
    const info = describePackage(stagingDir, motion);

    const integrity = verifyFiles(hashes, info.files);
    if (integrity.mismatched.length || integrity.missing.length) {
      throw badRequest('包完整性校验未通过，文件可能被改动或损坏', {
        mismatched: integrity.mismatched.slice(0, 20),
        missing: integrity.missing.slice(0, 20),
      });
    }
    // 新格式还声明了封装内容的独立哈希，要求与校验清单一致，避免元数据自相矛盾。
    if (info.contentPath && info.contentSha && info.files?.[info.contentPath]
      && info.files[info.contentPath] !== info.contentSha) {
      throw badRequest('封装内容哈希与校验清单不一致', {
        contentPath: info.contentPath,
        declared: info.contentSha,
        receipt: info.files[info.contentPath],
      });
    }

    const credentialFindings = scanCredentials(hashes, stagingDir);
    if (credentialFindings.length) {
      throw badRequest('包内含疑似第三方 API Key 或令牌，已拒绝导入；请清理后再打包', {
        findings: credentialFindings,
      });
    }

    const id = info.version ? `${info.slug}@${info.version}` : info.slug;
    const targetDir = path.join(TEMPLATES_DIR, id);
    if (fs.existsSync(targetDir)) {
      throw conflict(`已经导入过这个版本：${id}。旧版本不会被覆盖，如需换包请先把该目录移出 studio/templates。`, { slug: id });
    }

    const meta: ImportedTemplate = {
      id,
      slug: id,
      name: info.name,
      version: info.version,
      localPath: path.relative(ROOT, targetDir),
      fileCount,
      bytes,
      packageSha256: packageSha,
      integrity: integrity.state,
      integritySource: info.integritySource,
      verifiedFiles: integrity.verifiedFiles,
      packageProfile: motion.packageProfile ?? null,
      specVersion: motion.specVersion ?? null,
      layout: info.layout,
      hasPersonalKey: info.hasPersonalKey,
      contentProtection: info.contentProtection,
      templateId: info.templateId,
      output: info.output,
      sourceFilename,
      importedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(stagingDir, '.import-meta.json'),
      `${JSON.stringify(meta, null, 2)}\n`,
      'utf8',
    );
    fs.renameSync(stagingDir, targetDir);
    writeLockEntry(meta, info.runtimeProfile);
    return meta;
  } catch (err) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }
}
