import { execFile } from 'node:child_process';
import path from 'node:path';
import { findBin } from './paths.js';
import type { ProbeResult, ProbeStream } from '@ai-motion/shared/types';

interface ProbeStreamRaw {
  codec_type?: string;
  codec_name?: string;
  width?: number | null;
  height?: number | null;
  channels?: number | null;
  sample_rate?: number | null;
}

interface ProbeFormatRaw {
  duration?: string;
  size?: string;
  bit_rate?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function probeMedia(abs: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const ffprobe = findBin('ffprobe');
    if (!ffprobe) {
      resolve({ ok: false, reason: 'ffprobe 不可用', streams: [] });
      return;
    }
    execFile(
      ffprobe,
      ['-v', 'error', '-show_entries',
        'format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,channels,sample_rate',
        '-of', 'json', abs],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          resolve({ ok: false, reason: err.message, streams: [] });
          return;
        }
        try {
          const data = JSON.parse(stdout) as { streams?: ProbeStreamRaw[]; format?: ProbeFormatRaw };
          const streams: ProbeStream[] = (data.streams || []).map((s) => ({
            type: s.codec_type ?? '',
            codec: s.codec_name ?? '',
            width: s.width ?? null,
            height: s.height ?? null,
            channels: s.channels ?? null,
            sampleRate: s.sample_rate ? Number(s.sample_rate) : null,
          }));
          const format = data.format || {};
          resolve({
            ok: true,
            duration: format.duration ? Number(format.duration) : null,
            size: format.size ? Number(format.size) : null,
            bitRate: format.bit_rate ? Number(format.bit_rate) : null,
            streams,
          });
        } catch (e) {
          resolve({ ok: false, reason: errorMessage(e), streams: [] });
        }
      },
    );
  });
}

export type MediaType = 'image' | 'audio' | 'video' | 'file';

// 从文件名猜媒体类型
export function mediaType(name: string): MediaType {
  const ext = path.extname(name).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) return 'video';
  return 'file';
}
