import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../infra/paths.js';

// About 页的阶段路线图：直接解析 docs/roadmap.md，避免文档与页面两套口径。
// 只取二级标题分节与顶层 `- ` 条目；嵌套子项作为详情行，三级标题并入当前节。
export interface RoadmapItem {
  text: string;
  done: boolean;
  details: string[];
}

export interface RoadmapSection {
  title: string;
  done: number;
  total: number;
  items: RoadmapItem[];
}

export interface RoadmapPayload {
  updatedAt: string;
  source: string;
  sections: RoadmapSection[];
  total: number;
  done: number;
}

const DONE_MARK = /(已落地|已完成|已定稿|已补齐|已成文|已核对|已实测|已巡检)/;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^#+\s*/, '')
    .trim();
}

export function readRoadmap(): RoadmapPayload {
  const file = path.join(ROOT, 'docs', 'roadmap.md');
  const source = 'docs/roadmap.md';
  if (!fs.existsSync(file)) {
    return { updatedAt: new Date(0).toISOString(), source, sections: [], total: 0, done: 0 };
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const sections: RoadmapSection[] = [];
  let current: RoadmapSection | null = null;
  let lastItem: RoadmapItem | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      const title = stripMarkdown(line);
      current = { title, done: 0, total: 0, items: [] };
      sections.push(current);
      lastItem = null;
      continue;
    }
    if (/^###/.test(line)) {
      if (current && lastItem) lastItem.details.push(stripMarkdown(line));
      continue;
    }
    if (!current) continue;
    if (/^- /.test(line)) {
      const text = stripMarkdown(line.slice(2));
      const item: RoadmapItem = { text, done: DONE_MARK.test(text), details: [] };
      current.items.push(item);
      current.total += 1;
      if (item.done) current.done += 1;
      lastItem = item;
      continue;
    }
    if (/^\s{2,}- /.test(line) && lastItem) {
      lastItem.details.push(stripMarkdown(line.replace(/^\s*-\s*/, '')));
    }
  }

  const total = sections.reduce((n, s) => n + s.total, 0);
  const done = sections.reduce((n, s) => n + s.done, 0);
  return {
    updatedAt: fs.statSync(file).mtime.toISOString(),
    source,
    sections: sections.filter((s) => s.total > 0),
    total,
    done,
  };
}
