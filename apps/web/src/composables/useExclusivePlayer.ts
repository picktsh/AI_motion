// 音频播放器互斥：同一时间只允许一条波形在播；新的开始播放前暂停上一条。
// 只接管播放/暂停，不干预 seek（拖动进度由波形组件自身处理，互不影响）。

type PauseFn = () => void;

let active: PauseFn | null = null;

/** 声明自己开始播放：先暂停上一条，再登记为当前播放。 */
export function claimExclusive(pause: PauseFn): void {
  if (active && active !== pause) active();
  active = pause;
}

/** 自己暂停或结束：若仍是当前播放则注销，避免误停后来者。 */
export function releaseExclusive(pause: PauseFn): void {
  if (active === pause) active = null;
}
