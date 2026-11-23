import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';

export interface Project {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  templateVersion: string | null;
  templateDir: string;
  templateSha256: string | null;
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
  scriptText?: string;
}

/** 返回项目在本地资产目录中的路径。 */
export function projectDir(id: string): string {
  return path.join(ROOT, 'studio', 'projects', id);
}

/** 读取项目并兼容旧版字段。 */
export function readProject(id: string): Project | null {
  if (!/^[\w一-龥.@-]+$/.test(id)) return null;
  const file = path.join(projectDir(id), 'project.json');
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Project & { kind?: string };
    if (!raw.runner) raw.runner = raw.kind === 'personal' || Boolean(raw.archiveRel) ? 'cloud' : 'adapter';
    delete raw.kind;
    raw.jobId ??= null;
    raw.error ??= null;
    raw.runMaxCredits ??= 0;
    raw.templateVersion ??= null;
    raw.templateDir ??= '';
    raw.templateSha256 ??= null;
    return raw;
  } catch {
    return null;
  }
}

/** 原子写入项目清单，避免进程中断时留下半截 JSON。 */
export function writeProject(project: Project): void {
  const target = path.join(projectDir(project.id), 'project.json');
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, target);
}
