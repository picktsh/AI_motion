/**
 * 颜色唯一来源：亮/暗两套色板。
 * - useTheme 把它们注入 :root 的 CSS 变量（自绘组件 / UnoCSS 用 var()）；
 * - naiveTheme 直接取这里的字面色值（Naive 内部要做颜色混合，不认 var()）。
 * 改颜色只改这一个文件。
 */

export interface Palette {
  bg: string;
  panel: string;
  overlay: string;
  border: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  brand: string;
  brandHover: string;
  brandPressed: string;
  cyan: string;
  success: string;
  warning: string;
  danger: string;
  shadowCard: string;
  shadowOverlay: string;
}

export const lightPalette: Palette = {
  bg: '#f6f7f9',
  panel: '#ffffff',
  overlay: '#ffffff',
  border: '#e6e8ec',
  divider: '#edf0f3',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  brand: '#bc8cff',
  brandHover: '#cca6ff',
  brandPressed: '#a66ef0',
  cyan: '#22d3ee',
  success: '#34d399',
  warning: '#f5a524',
  danger: '#f26d6d',
  shadowCard: '0 1px 2px rgba(16, 24, 40, 0.06)',
  shadowOverlay: '0 8px 24px rgba(16, 24, 40, 0.18)',
};

export const darkPalette: Palette = {
  bg: '#0e1014',
  panel: '#16181f',
  overlay: '#1c1f27',
  border: '#262a33',
  divider: '#1f232b',
  textPrimary: '#e8eaf0',
  textSecondary: '#9aa2b1',
  textTertiary: '#5c6470',
  brand: '#bc8cff',
  brandHover: '#cca6ff',
  brandPressed: '#a66ef0',
  cyan: '#22d3ee',
  success: '#34d399',
  warning: '#f5a524',
  danger: '#f26d6d',
  shadowCard: '0 1px 2px rgba(0, 0, 0, 0.3)',
  shadowOverlay: '0 8px 24px rgba(0, 0, 0, 0.45)',
};

export const fontFamily =
  '-apple-system, "SF Pro Text", "PingFang SC", Inter, "Segoe UI", "Microsoft YaHei", sans-serif';
export const fontMono = '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

/** hex → rgba 字符串，供 Naive 主题与 CSS 浅底变量共用同一套透明度。 */
export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 注入 CSS 变量：UnoCSS 与自绘 class 只认 var(--color-*)。 */
export function applyPaletteVars(p: Palette): void {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set('--color-bg', p.bg);
  set('--color-panel', p.panel);
  set('--color-overlay', p.overlay);
  set('--color-border', p.border);
  set('--color-divider', p.divider);
  set('--color-text-primary', p.textPrimary);
  set('--color-text-secondary', p.textSecondary);
  set('--color-text-tertiary', p.textTertiary);
  set('--color-brand', p.brand);
  set('--color-brand-hover', p.brandHover);
  set('--color-brand-pressed', p.brandPressed);
  set('--color-cyan', p.cyan);
  set('--color-success', p.success);
  set('--color-warning', p.warning);
  set('--color-danger', p.danger);
  set('--color-brand-soft', rgba(p.brand, 0.12));
  set('--color-success-soft', rgba(p.success, 0.14));
  set('--color-warning-soft', rgba(p.warning, 0.14));
  set('--color-danger-soft', rgba(p.danger, 0.13));
  set('--color-neutral-soft', rgba(p.textSecondary, 0.1));
  set('--shadow-card', p.shadowCard);
  set('--shadow-overlay', p.shadowOverlay);
  set('--font-family', fontFamily);
  set('--font-mono', fontMono);
}
