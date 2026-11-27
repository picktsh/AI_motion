import { getJson, postJson, putJson, delJson } from './client';
import { endpoints } from './endpoints';

export interface FileEntry {
  name: string;
  type: 'dir' | 'file';
  ext: string;
  size: number;
  mtime: number;
  rel: string;
}

export interface DirListing {
  parent: string;
  path: string;
  items: FileEntry[];
}

export interface TextFile {
  rel: string;
  content: string;
  size: number;
  sha256: string;
  ext: string;
  isJson: boolean;
}

export function listTree(rel = ''): Promise<DirListing> {
  return getJson<DirListing>(endpoints.files.tree(rel));
}

export function readText(rel: string): Promise<TextFile> {
  return getJson<TextFile>(endpoints.files.text(rel));
}

export function writeText(
  rel: string,
  content: string,
  expectedSha?: string,
): Promise<TextFile> {
  return putJson<TextFile>(endpoints.files.textWrite, { path: rel, content, expectedSha });
}

export function createDir(rel: string): Promise<FileEntry> {
  return postJson<FileEntry>(endpoints.files.dir, { path: rel });
}

export function createFile(rel: string): Promise<FileEntry> {
  return postJson<FileEntry>(endpoints.files.file, { path: rel });
}

export function renameEntry(rel: string, name: string): Promise<FileEntry> {
  return postJson<FileEntry>(endpoints.files.rename, { path: rel, name });
}

export function moveEntry(rel: string, destDir: string): Promise<FileEntry> {
  return postJson<FileEntry>(endpoints.files.move, { path: rel, destDir });
}

export function removeEntry(rel: string): Promise<{ rel: string; type: 'dir' | 'file' }> {
  return delJson<{ rel: string; type: 'dir' | 'file' }>(endpoints.files.remove(rel));
}
