import { defineConfig, presetUno, presetIcons } from 'unocss';

/**
 * 样式骨架（唯一全局入口）：
 * - 颜色：全部来自 tokens.css 变量，这里只做命名映射；
 * - 字号：只用偶数（12/14/16/18/20/24/28/32），body 默认 14；
 * - 间距：默认刻度 1 = 4px，所有 p/m/gap 用数字刻度，保证 4 的倍数；
 * - 组件里不写 <style>，一律 utility class；实现不了的才进 preflights。
 */
export default defineConfig({
  presets: [presetUno(), presetIcons()],
  theme: {
    colors: {
      bg: 'var(--color-bg)',
      panel: 'var(--color-panel)',
      overlay: 'var(--color-overlay)',
      glass: 'var(--color-glass)',
      'glass-border': 'var(--color-glass-border)',
      border: 'var(--color-border)',
      divider: 'var(--color-divider)',
      ink: 'var(--color-text-primary)',
      'ink-2': 'var(--color-text-secondary)',
      'ink-3': 'var(--color-text-tertiary)',
      brand: 'var(--color-brand)',
      'brand-hover': 'var(--color-brand-hover)',
      'brand-pressed': 'var(--color-brand-pressed)',
      cyan: 'var(--color-cyan)',
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      danger: 'var(--color-danger)',
      'brand-soft': 'var(--color-brand-soft)',
      'success-soft': 'var(--color-success-soft)',
      'warning-soft': 'var(--color-warning-soft)',
      'danger-soft': 'var(--color-danger-soft)',
      'neutral-soft': 'var(--color-neutral-soft)',
    },
    fontSize: {
      xs: ['12px', '20px'],
      sm: ['14px', '22px'],
      base: ['14px', '22px'],
      lg: ['16px', '24px'],
      xl: ['18px', '28px'],
      '2xl': ['20px', '28px'],
      '3xl': ['24px', '32px'],
      '4xl': ['28px', '36px'],
      '5xl': ['32px', '40px'],
    },
    fontFamily: {
      sans: 'var(--font-family)',
      mono: 'var(--font-mono)',
    },
    boxShadow: {
      card: 'var(--shadow-card)',
      float: 'var(--shadow-float)',
      overlay: 'var(--shadow-overlay)',
    },
    borderRadius: {
      card: '12px',
      control: '8px',
    },
    breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
  },
  shortcuts: {
    // 页面骨架
    'page-wrap': 'flex flex-col gap-4',
    'page-title': 'text-xl font-semibold text-ink',
    'page-desc': 'text-sm text-ink-2',
    card: 'bg-glass border border-glass-border rounded-[20px] shadow-float backdrop-blur-xl',
    'glass-panel': 'bg-glass border border-glass-border rounded-[20px] shadow-float backdrop-blur-xl',
    'card-pad': 'card p-4',
    'row-between': 'flex items-center justify-between gap-2',
    'muted': 'text-ink-2',
    'faint': 'text-ink-3',
    'num': 'tabular-nums',
    // 状态浅底标签
    'chip-brand': 'bg-brand-soft text-brand',
    'chip-success': 'bg-success-soft text-success',
    'chip-warning': 'bg-warning-soft text-warning',
    'chip-danger': 'bg-danger-soft text-danger',
    'chip-neutral': 'bg-neutral-soft text-ink-2',
    // 渲染后的 Markdown 正文（v-html 子元素只能用变体选择器）
    'md-body':
      'text-sm text-ink [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-ink-2 [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink-2 [&_h4]:mt-3 [&_h4]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-ink-2 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_ul]:m-0 [&_ul]:pl-4 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_li]:text-sm [&_li]:leading-5 [&_li_ul]:mt-2 [&_code]:font-mono [&_code]:text-xs [&_code]:px-1 [&_code]:rounded [&_code]:bg-neutral-soft [&_a]:text-brand [&_a]:no-underline hover:[&_a]:underline [&_blockquote]:my-2 [&_blockquote]:pl-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:text-ink-3 [&_blockquote]:text-xs',
  },
  preflights: [
    {
      // UnoCSS 表达不了的全局基础：根高度、滚动条、选中色。只此一处。
      getCSS: () => `
html, body, #app { height: 100%; }
body {
  margin: 0;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
.app-canvas {
  position: relative;
  isolation: isolate;
  background: var(--color-bg);
}
.app-canvas::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 82% 8%, var(--color-glow-brand), transparent 34%),
    radial-gradient(ellipse at 16% 92%, var(--color-glow-cyan), transparent 36%);
}
.glass-surface {
  background: var(--color-glass);
  border: 1px solid var(--color-glass-border);
  box-shadow: var(--shadow-float);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}
.app-header {
  background-color: var(--color-glass);
  box-shadow: var(--shadow-float);
  -webkit-backdrop-filter: blur(28px) saturate(1.25);
  backdrop-filter: blur(28px) saturate(1.25);
}
.app-content {
  background: color-mix(in srgb, var(--color-bg) 24%, transparent);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
  backdrop-filter: blur(12px) saturate(1.08);
}
.sidebar-menu.n-menu {
  background: transparent;
}
.sidebar-menu .n-menu-item-content {
  border-radius: 999px;
}
.sidebar-menu .n-menu-item-content::before {
  left: 0;
  right: 0;
}
.sidebar-menu.n-menu--collapsed .n-menu-item-content::before {
  top: 5px;
  bottom: 5px;
}
.sidebar-label {
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  transition: opacity 80ms ease-out, max-width 180ms ease-out;
}
.sidebar-label.is-visible {
  max-width: 180px;
  opacity: 1;
  transition-delay: 80ms;
}
.n-card {
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}
@supports not ((-webkit-backdrop-filter: blur(24px)) or (backdrop-filter: blur(24px))) {
  .glass-surface { background: var(--color-panel); }
  .app-content { background: var(--color-bg); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
}
* { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 8px; }
*::-webkit-scrollbar-thumb:hover { background: var(--color-text-tertiary); }
*::-webkit-scrollbar-track { background: transparent; }
::selection { background: var(--color-brand-soft); }
`,
    },
  ],
});
