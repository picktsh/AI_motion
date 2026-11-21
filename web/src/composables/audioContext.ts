let ctx: AudioContext | null = null;

/** 共享一个 AudioContext，避免每个波形/播放器重复创建；解码不需要用户手势。 */
export function getSharedContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
