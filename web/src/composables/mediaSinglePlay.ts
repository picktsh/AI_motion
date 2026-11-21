/**
 * 全局音视频单播：同一时间只允许一个 audio / video 处于播放状态。
 * 用 document 级捕获委托，覆盖原生 controls 播放与自绘播放器两类元素。
 */

let installed = false;

function onPlay(e: Event) {
  const current = e.target as HTMLMediaElement | null;
  if (!current || typeof current.paused !== 'boolean') return;
  document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((el) => {
    if (el !== current && !el.paused) el.pause();
  });
}

export function setupMediaSinglePlay() {
  if (installed) return;
  installed = true;
  document.addEventListener('play', onPlay, true);
}
