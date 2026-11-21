import { execFile } from 'node:child_process';
import path from 'node:path';
import { findBin } from './paths.mjs';

export function probeMedia(abs) {
  return new Promise((resolve) => {
    const ffprobe = findBin('ffprobe');
    if (!ffprobe) return resolve({ ok: false, reason: 'ffprobe 不可用' });
    execFile(
      ffprobe,
      ['-v', 'error', '-show_entries',
        'format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,channels,sample_rate',
        '-of', 'json', abs],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) return resolve({ ok: false, reason: err.message });
        try {
          const data = JSON.parse(stdout);
          const streams = (data.streams || []).map((s) => ({
            type: s.codec_type, codec: s.codec_name,
            width: s.width || null, height: s.height || null,
            channels: s.channels || null, sampleRate: s.sample_rate ? Number(s.sample_rate) : null,
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
          resolve({ ok: false, reason: e.message });
        }
      }
    );
  });
}

// 从文件名猜媒体类型
export function mediaType(name) {
  const ext = path.extname(name).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) return 'video';
  return 'file';
}
