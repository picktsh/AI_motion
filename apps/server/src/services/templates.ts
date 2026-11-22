import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';

interface MotionTemplate {
  id?: string;
  name?: string;
  version?: string;
  [key: string]: unknown;
}

interface MotionRuntime {
  profile?: string | null;
  entry?: string | null;
  [key: string]: unknown;
}

interface MotionMeta {
  template?: MotionTemplate;
  runtime?: MotionRuntime;
  license?: { file?: string | null };
  permissions?: Record<string, unknown> | null;
  output?: unknown;
  extensions?: Record<string, unknown> | null;
  parameters?: { schema?: string };
  services?: Record<string, { origin?: string; credentials?: string; execution?: string }> | null;
}

/** 参数概要字段（一层只读摘要，不展开嵌套对象/数组）。 */
export interface ParamField {
  name: string;
  type: string | null;
  required: boolean;
  enum: string[] | null;
  constValue: string | null;
  defaultValue: unknown;
  range: string | null;
  description: string | null;
  nested: number | null;
}

export interface ParamSummary {
  file: string | null;
  fields: ParamField[];
}

interface Discovered {
  dir: string;
  origin: string;
  slug: string;
  tplDir: string;
  motion: MotionMeta | null;
  importMeta: ImportMeta | null;
  legacy: boolean;
}

/** 导入时写入 .import-meta.json 的元数据（包 sha256、来源文件名、导入时间与代际信息）。 */
interface ImportMeta {
  name?: string;
  version?: string | null;
  packageSha256?: string;
  sourceFilename?: string;
  importedAt?: string;
  integrity?: string;
  integritySource?: string | null;
  fileCount?: number;
  packageProfile?: string | null;
  specVersion?: string | null;
  layout?: 'legacy' | 'personal';
  hasPersonalKey?: boolean;
  contentProtection?: string | null;
  templateId?: number | null;
  services?: Record<string, { origin?: string; credentials?: string; execution?: string }> | null;
  output?: { width: number | null; height: number | null; layout: string | null } | null;
}

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  origin: string;
  localPath: string;
  runtime: { profile: string | null; entry: string | null };
  license: string | null;
  network: boolean | null;
  inPlace: boolean;
  sourceRepo: string | null;
  importedAt: string | null;
  packageSha256: string | null;
  integrity: string | null;
  fileCount: number | null;
  /** 模板中心编号（个人下载包的 receipt.templateId），用于关联封面与清单条目。 */
  templateId: number | null;
  packageProfile: string | null;
  specVersion: string | null;
  layout: string | null;
  hasPersonalKey: boolean;
  contentProtection: string | null;
  /** 包内声明了官方云端 creator 服务：走该路线会按官方价目扣积分。 */
  paidCloud: boolean;
  cloudOrigin: string | null;
}

export interface FileNode {
  name: string;
  type: 'dir' | 'file';
  size: number | null;
  children: FileNode[];
}

export interface TemplateDetail {
  id: string;
  slug: string;
  name: string;
  version: string | null;
  origin: string;
  localPath: string;
  runtime: MotionRuntime;
  lock: Record<string, unknown> | null;
  license: { file: string | null; present: boolean };
  output: unknown;
  network: boolean | null;
  permissions: Record<string, unknown> | null;
  extensions: Record<string, unknown> | null;
  parameters: ParamSummary;
  fileTree: FileNode[];
  sourceRepo: string | null;
  importedAt: string | null;
  packageSha256: string | null;
  integrity: string | null;
  integritySource: string | null;
  fileCount: number | null;
  templateId: number | null;
  packageProfile: string | null;
  specVersion: string | null;
  layout: string | null;
  hasPersonalKey: boolean;
  contentProtection: string | null;
  paidCloud: boolean;
  cloudOrigin: string | null;
}

function readJson(abs: string): MotionMeta | null {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as MotionMeta | null;
  } catch {
    return null;
  }
}

interface RawParamSchema {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
  properties?: Record<string, RawParamSchema>;
  items?: { properties?: Record<string, RawParamSchema> };
  required?: string[];
}

function describeRange(d: RawParamSchema): string | null {
  const parts: string[] = [];
  if (d.minimum != null || d.maximum != null) parts.push(`范围 ${d.minimum ?? '−'}~${d.maximum ?? '−'}`);
  if (d.minLength != null || d.maxLength != null) parts.push(`长度 ${d.minLength ?? '−'}~${d.maxLength ?? '−'}`);
  if (d.minItems != null || d.maxItems != null) parts.push(`项数 ${d.minItems ?? '−'}~${d.maxItems ?? '−'}`);
  return parts.length ? parts.join('，') : null;
}

// 只读概要化 params.schema.json：抽取一层字段的类型、必填、枚举/常量、默认值与范围；
// schema 缺失或解析失败时返回空概要，不阻断模板详情。
function summarizeSchema(tplDir: string, motion: MotionMeta | null): ParamSummary {
  const schemaFile = motion?.parameters?.schema;
  if (!schemaFile || typeof schemaFile !== 'string') return { file: null, fields: [] };
  const raw = readJson(path.join(tplDir, schemaFile)) as unknown as RawParamSchema | null;
  if (!raw || typeof raw !== 'object' || !raw.properties) return { file: schemaFile, fields: [] };

  const required = new Set(Array.isArray(raw.required) ? raw.required : []);
  const fields: ParamField[] = Object.entries(raw.properties).map(([name, def]) => {
    const d = def ?? {};
    const nestedProps = d.properties ?? d.items?.properties;
    return {
      name,
      type: typeof d.type === 'string' ? d.type : d.const != null ? 'const' : null,
      required: required.has(name),
      enum: Array.isArray(d.enum) ? d.enum.map(String) : null,
      constValue: d.const != null ? String(d.const) : null,
      defaultValue: d.default !== undefined ? d.default : null,
      range: describeRange(d),
      description:
        typeof d.description === 'string' && d.description ? d.description.slice(0, 120) : null,
      nested: nestedProps ? Object.keys(nestedProps).length : null,
    };
  });
  return { file: schemaFile, fields };
}

function listDirs(base: string): string[] {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name);
}

/** 模板标识统一带上版本：导入的模板按版本并列存放，互不覆盖；内置工程保持原 id。 */
function canonicalId(slug: string, motion: MotionMeta | null, legacy = false): string {
  const base = motion?.template?.id || slug;
  if (legacy) return base;
  const version = motion?.template?.version;
  return version ? `${base}@${version}` : base;
}

/** 从 extensions 的源码仓库地址取编号，用于跟模板中心的 entries 对齐。 */
function sourceRepo(motion: MotionMeta | null): string | null {
  const ext = motion?.extensions as Record<string, { repository?: string } | undefined> | null | undefined;
  const repo = ext?.['motiongit.com:open-source']?.repository;
  if (typeof repo !== 'string') return null;
  const last = repo.replace(/\/+$/, '').split('/').pop();
  return last || null;
}

function readImportMeta(tplDir: string): ImportMeta | null {
  return readJson(path.join(tplDir, '.import-meta.json')) as unknown as ImportMeta | null;
}

function discover(): Discovered[] {
  const found: Discovered[] = [];
  // 规划结构：studio/templates/ 与 studio/templates-cache/ 下每个子目录是一个模板
  for (const dir of ['studio/templates', 'studio/templates-cache']) {
    const base = path.join(ROOT, dir);
    for (const name of listDirs(base)) {
      const tplDir = path.join(base, name);
      const motion = readJson(path.join(tplDir, 'motion.json'));
      if (motion) {
        found.push({
          dir,
          origin: dir.includes('templates-cache') ? 'cache' : 'local',
          slug: name,
          tplDir,
          motion,
          importMeta: readImportMeta(tplDir),
          legacy: false,
        });
      }
    }
  }
  return found;
}

function cloudInfo(motion: MotionMeta | null): { paidCloud: boolean; cloudOrigin: string | null } {
  const creator = motion?.services?.creator;
  const origin = typeof creator?.origin === 'string' ? creator.origin : null;
  const cloud = Boolean(origin && /^https?:\/\//i.test(origin) && creator?.credentials === 'personal-envelope');
  return { paidCloud: cloud, cloudOrigin: origin };
}

export function listTemplates(): TemplateSummary[] {
  return discover().map(({ origin, slug, tplDir, motion, importMeta, legacy }) => {
    const t = motion?.template ?? {};
    const runtime = motion?.runtime ?? {};
    const assistant = (motion?.extensions as Record<string, { entry?: string; profile?: string } | undefined> | null)?.[
      'motiongit.com:assistant-entry'
    ];
    const license = motion?.license?.file ?? null;
    const id = canonicalId(slug, motion, legacy);
    return {
      id,
      slug,
      name: t.name || importMeta?.name || slug,
      version: t.version ?? importMeta?.version ?? null,
      origin,
      localPath: path.relative(ROOT, tplDir),
      runtime: {
        profile: runtime.profile ?? assistant?.profile ?? null,
        entry: runtime.entry ?? assistant?.entry ?? null,
      },
      license,
      network: (motion?.permissions?.network as boolean | null) ?? null,
      inPlace: fs.existsSync(tplDir),
      sourceRepo: sourceRepo(motion),
      importedAt: importMeta?.importedAt ?? null,
      packageSha256: importMeta?.packageSha256 ?? null,
      integrity: importMeta?.integrity ?? null,
      fileCount: importMeta?.fileCount ?? null,
      templateId: importMeta?.templateId ?? null,
      packageProfile: importMeta?.packageProfile ?? null,
      specVersion: importMeta?.specVersion ?? null,
      layout: importMeta?.layout ?? null,
      hasPersonalKey: Boolean(importMeta?.hasPersonalKey),
      contentProtection: importMeta?.contentProtection ?? null,
      ...cloudInfo(motion),
    };
  });
}

function fileTree(dir: string, depth = 0, maxDepth = 3): FileNode[] {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !['node_modules', '.git', '__pycache__', '.import-meta.json'].includes(d.name))
    .map((d) => {
      const abs = path.join(dir, d.name);
      return {
        name: d.name,
        type: d.isDirectory() ? 'dir' : 'file',
        size: d.isFile() ? fs.statSync(abs).size : null,
        children: d.isDirectory() ? fileTree(abs, depth + 1, maxDepth) : [],
      };
    });
}

export function getTemplate(id: string): TemplateDetail | null {
  const hit = discover().find(({ motion, slug, legacy }) => canonicalId(slug, motion, legacy) === id);
  if (!hit) return null;
  const { tplDir, motion, origin, legacy, importMeta } = hit;
  const lock = readJson(path.join(tplDir, 'motion.lock.json')) as Record<string, unknown> | null;
  const t = motion?.template ?? {};
  const runtime = motion?.runtime ?? {};
  const assistant = (motion?.extensions as Record<string, { entry?: string; profile?: string } | undefined> | null)?.[
    'motiongit.com:assistant-entry'
  ];
  const licenseFile = motion?.license?.file ?? null;
  const licenseAbs = licenseFile ? path.join(tplDir, licenseFile) : null;
  return {
    id: canonicalId(hit.slug, motion, legacy),
    slug: hit.slug,
    name: t.name || importMeta?.name || hit.slug,
    version: t.version ?? importMeta?.version ?? null,
    origin,
    localPath: path.relative(ROOT, tplDir),
    runtime: {
      ...runtime,
      profile: runtime.profile ?? assistant?.profile ?? null,
      entry: runtime.entry ?? assistant?.entry ?? null,
    },
    lock,
    license: { file: licenseFile, present: licenseAbs ? fs.existsSync(licenseAbs) : false },
    output: motion?.output ?? importMeta?.output ?? null,
    network: (motion?.permissions?.network as boolean | null) ?? null,
    permissions: motion?.permissions ?? null,
    extensions: motion?.extensions ?? null,
    parameters: summarizeSchema(tplDir, motion),
    fileTree: fileTree(tplDir),
    sourceRepo: sourceRepo(motion),
    importedAt: importMeta?.importedAt ?? null,
    packageSha256: importMeta?.packageSha256 ?? null,
    integrity: importMeta?.integrity ?? null,
    integritySource: importMeta?.integritySource ?? null,
    fileCount: importMeta?.fileCount ?? null,
    templateId: importMeta?.templateId ?? null,
    packageProfile: importMeta?.packageProfile ?? null,
    specVersion: importMeta?.specVersion ?? null,
    layout: importMeta?.layout ?? null,
    hasPersonalKey: Boolean(importMeta?.hasPersonalKey),
    contentProtection: importMeta?.contentProtection ?? null,
    ...cloudInfo(motion),
  };
}
