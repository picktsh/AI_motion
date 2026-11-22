import { getJson, getList, postJson, putJson } from './client';
import { endpoints } from './endpoints';

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
}

export interface ProjectFiles {
  video: string | null;
  cover4x3: string | null;
  cover3x4: string | null;
  publishTxt: string | null;
  log: string | null;
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

export function listProjects(): Promise<Project[]> {
  return getList<Project>(endpoints.projects.list);
}

export function getProject(id: string): Promise<Project> {
  return getJson<Project>(endpoints.projects.detail(id));
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
