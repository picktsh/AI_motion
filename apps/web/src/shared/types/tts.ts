export interface Sample {
  id: string;
  file: string;
  voice: string;
  label: string;
  style: string;
  text: string;
  rate: string;
  pitch: string;
  duration_s: number;
  exists: boolean;
  url: string | null;
}

export interface WordBound {
  text: string;
  start: number;
  end: number;
}

export interface Segment {
  id: string;
  windowStart: number;
  windowEnd: number;
  text: string;
  audio: string;
  exists: boolean;
  url: string | null;
  bounds: WordBound[];
}
