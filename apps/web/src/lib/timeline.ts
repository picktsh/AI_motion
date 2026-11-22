/**
 * 时间线基座：轨道条目模型、时间归一化、激活条目判定与时间码格式化。
 * 第一版只读对齐 + 定位高亮；片段拖拽、切点写回依赖后端写 API，后置。
 */

/** 轨道上的一个区间条目（字幕、配音分段、场景等统一映射为此结构）。 */
export interface TimelineItem {
  id: string;
  start: number;
  end: number;
  label?: string;
}

/** 把时间钳制到 [0, duration]，容错 NaN/负数。 */
export function clampTime(t: number, duration: number): number {
  if (!Number.isFinite(t) || t < 0) return 0;
  if (duration > 0 && t > duration) return duration;
  return t;
}

/** 返回当前时间命中的条目下标；未命中返回 -1。条目按 start 升序时判定更稳。 */
export function activeItemIndex(items: readonly TimelineItem[], t: number): number {
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (t >= it.start && t < it.end) return i;
  }
  return -1;
}

/** 区间在时间轴上的百分比定位；duration 非正时退化为 0。 */
export function itemPercent(
  start: number,
  end: number,
  duration: number,
): { left: string; width: string } {
  if (!(duration > 0)) return { left: '0%', width: '0%' };
  const s = clampTime(start, duration);
  const e = clampTime(Math.max(end, start), duration);
  const left = (s / duration) * 100;
  const width = Math.max(0, ((e - s) / duration) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

/** 播放头位置百分比（0–100）。 */
export function playheadPercent(currentTime: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return (clampTime(currentTime, duration) / duration) * 100;
}

/** 时间码格式 mm:ss.s；入参单位秒。 */
export function formatTimecode(t: number): string {
  const v = clampTime(t, Number.POSITIVE_INFINITY);
  const m = Math.floor(v / 60);
  const s = v - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}
