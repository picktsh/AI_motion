import { getJson, getList, postJson } from './client';
import { endpoints } from './endpoints';

export interface ProjectQuote {
  total?: number;
  maxCredits?: number;
  withinBudget?: boolean;
  tts?: { model?: string; credits?: number; status?: string };
  compose?: { model?: string; credits?: number; note?: string };
  uploads?: string[];
  notUploaded?: string[];
  instanceDirectory?: string;
}

export interface Project {
  id: string;
  kind: 'personal' | 'builtin';
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
}

export interface ProjectFiles {
  video: string | null;
  cover4x3: string | null;
  cover3x4: string | null;
  publishTxt: string | null;
  log: string | null;
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

export function runProject(id: string, maxCredits: number): Promise<Project> {
  return postJson<Project>(endpoints.projects.run(id), { maxCredits });
}

export function preparePublish(id: string): Promise<Project> {
  return postJson<Project>(endpoints.projects.preparePublish(id), {});
}

export function projectFiles(id: string): Promise<ProjectFiles> {
  return getJson<ProjectFiles>(endpoints.projects.files(id));
}

export interface ProjectCredits {
  credits_remaining?: number;
  credits?: { remaining?: number };
  account_balance?: { available?: number };
  resets_at?: string;
}

export function getProjectCredits(id: string): Promise<ProjectCredits> {
  return getJson<ProjectCredits>(endpoints.projects.credits(id));
}
