import { getJson } from './client';
import { endpoints } from './endpoints';

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

/** 阶段路线图直接解析 docs/roadmap.md，文档是唯一口径。 */
export function getRoadmap(): Promise<RoadmapPayload> {
  return getJson<RoadmapPayload>(endpoints.about.roadmap);
}
