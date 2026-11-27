import { getJson, getList, postJson, putJson, delJson, postForm } from './client';
import { endpoints } from './endpoints';
import { resolveAssetUrl } from '../composables/useServerConfig';

export interface ProjectQuote {
  total?: number;
  maxCredits?: number;
  withinBudget?: boolean;
  route?: string;
  note?: string;
  tts?: { model?: string; credits?: number; status?: string };
  compose?: { model?: string; credits?: number; note?: string };
  uploads?: string[];
  notUploaded?: string[];
  instanceDirectory?: string;
}

export interface Project {
  id: string;
  /** adapter = 模板自带本机渲染入口；cloud = 官方云端（积分） */
  runner: 'adapter' | 'cloud';
  name: string;
  templateId: string;
  templateName: string;
  templateVersion: string | null;
  templateDir: string;
  templateSha256: string | null;
  status: 'draft' | 'quoted' | 'running' | 'failed' | 'done';
  createdAt: string;
  duration: number;
  keywords: string[];
  quote: ProjectQuote | null;
  artifactRel: string | null;
  videoUrl: string | null;
  logRel: string | null;
  jobId: string | null;
  error: string | null;
  runMaxCredits: number;
  scriptText?: string;
}

export interface ProjectAsset {
  name: string;
  type: 'image' | 'audio' | 'video' | 'file';
  rel: string;
  url: string | null;
}

export interface StudioConfig {
  voicePreference: string | null;
  assets: ProjectAsset[];
}

export interface VoiceMeta {
  voice: string;
  duration_s: number;
  createdAt: string;
}

export interface ProjectStep {
  key: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface ProjectFiles {
  video: string | null;
  cover4x3: string | null;
  cover3x4: string | null;
  publishTxt: string | null;
  log: string | null;
  voice: string | null;
  voiceMeta: VoiceMeta | null;
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

function resolveProject(p: Project): Project {
  return { ...p, videoUrl: resolveAssetUrl(p.videoUrl) };
}

export async function listProjects(): Promise<Project[]> {
  const items = await getList<Project>(endpoints.projects.list);
  return items.map(resolveProject);
}

export async function getProject(id: string): Promise<Project> {
  const p = await getJson<Project>(endpoints.projects.detail(id));
  return resolveProject(p);
}

export function createProject(payload: {
  templateId: string;
  title: string;
  script: string;
  duration?: number;
  keywords?: string;
}): Promise<Project> {
  return postJson<Project>(endpoints.projects.create, payload);
}

export function quoteProject(id: string, maxCredits: number): Promise<Project> {
  return postJson<Project>(endpoints.projects.quote(id), { maxCredits });
}

/** 提交异步生成任务，立即返回；进度靠轮询 getProject。 */
export function runProject(id: string, maxCredits: number): Promise<Project> {
  return postJson<Project>(endpoints.projects.run(id), { maxCredits });
}

export function preparePublish(id: string): Promise<Project> {
  return postJson<Project>(endpoints.projects.preparePublish(id), {});
}

export function projectFiles(id: string): Promise<ProjectFiles> {
  return getJson<ProjectFiles>(endpoints.projects.files(id));
}

export function getProjectSteps(id: string): Promise<ProjectStep[]> {
  return getList<ProjectStep>(endpoints.projects.steps(id));
}

export function getPublish(id: string): Promise<ProjectPublish | null> {
  return getJson<ProjectPublish | null>(endpoints.projects.publish(id));
}

export function savePublish(id: string, payload: Partial<ProjectPublish>): Promise<ProjectPublish> {
  return putJson<ProjectPublish>(endpoints.projects.publish(id), payload);
}

export function readProjectLog(id: string, offset = 0): Promise<{ text: string; next: number }> {
  return getJson<{ text: string; next: number }>(endpoints.projects.log(id, offset));
}

export interface ProjectCredits {
  credits_remaining?: number;
  credits?: { remaining?: number };
  account_balance?: { available?: number };
  resets_at?: string;
  paid_cloud?: boolean;
}

export function getProjectCredits(id: string): Promise<ProjectCredits> {
  return getJson<ProjectCredits>(endpoints.projects.credits(id));
}

export function getStudioConfig(id: string): Promise<StudioConfig> {
  return getJson<StudioConfig>(endpoints.projects.config(id));
}

export function saveStudioConfig(id: string, payload: { voicePreference?: string | null }): Promise<StudioConfig> {
  return putJson<StudioConfig>(endpoints.projects.config(id), payload);
}

export async function listProjectAssets(id: string): Promise<ProjectAsset[]> {
  const items = await getList<ProjectAsset>(endpoints.projects.assets(id));
  return items.map((a) => ({ ...a, url: resolveAssetUrl(a.url) }));
}

export function deleteProjectAsset(id: string, rel: string): Promise<{ rel: string }> {
  return delJson<{ rel: string }>(`${endpoints.projects.assets(id)}?rel=${encodeURIComponent(rel)}`);
}

/** 面板内轻编辑：标题 / 文稿纯文本，不动创作入参文件。 */
export function saveProjectText(
  id: string,
  payload: { name?: string; script?: string },
): Promise<Project> {
  return putJson<Project>(endpoints.projects.text(id), payload);
}

export function uploadProjectAsset(id: string, file: File, onProgress?: (percent: number) => void): Promise<ProjectAsset> {
  const form = new FormData();
  form.append('file', file, file.name);
  return postForm<ProjectAsset>(endpoints.projects.assets(id), form, onProgress);
}
