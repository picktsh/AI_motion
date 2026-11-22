import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * Naive UI 主题覆盖。
 * 这里是唯一允许集中写死 hex 的地方：自绘组件一律走 tokens.css 的 CSS 变量。
 * 色值与设计规范保持一致。
 */

const brand = '#bc8cff';
const brandHover = '#cca6ff';
const brandPressed = '#a66ef0';
const success = '#34d399';
const warning = '#f5a524';
const danger = '#f26d6d';

const fontFamily =
  '-apple-system, "SF Pro Text", "PingFang SC", Inter, "Segoe UI", "Microsoft YaHei", sans-serif';

const semanticCommon = {
  primaryColor: brand,
  primaryColorHover: brandHover,
  primaryColorPressed: brandPressed,
  primaryColorSuppl: brand,
  successColor: success,
  successColorHover: success,
  successColorPressed: success,
  warningColor: warning,
  warningColorHover: warning,
  warningColorPressed: warning,
  errorColor: danger,
  errorColorHover: danger,
  errorColorPressed: danger,
  infoColor: brand,
  infoColorHover: brandHover,
  infoColorPressed: brandPressed,
  borderRadius: '8px',
  borderRadiusSmall: '6px',
  fontFamily,
};

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    ...semanticCommon,
    bodyColor: '#f6f7f9',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    textColorBase: '#111827',
    textColor1: '#111827',
    textColor2: '#6b7280',
    textColor3: '#9ca3af',
    borderColor: '#e6e8ec',
    dividerColor: '#edf0f3',
  },
  Card: {
    color: '#ffffff',
    borderColor: '#e6e8ec',
    borderRadius: '12px',
    titleFontSize: '15px',
  },
  Layout: {
    color: '#f6f7f9',
    colorBase: '#f6f7f9',
  },
  Menu: {
    itemColor: 'transparent',
    itemColorHover: 'rgba(188, 140, 255, 0.08)',
    itemColorActive: 'rgba(188, 140, 255, 0.12)',
    itemColorActiveHover: 'rgba(188, 140, 255, 0.16)',
    itemTextColor: '#6b7280',
    itemTextColorHover: '#111827',
    itemTextColorActive: brand,
    itemIconColor: '#6b7280',
    itemIconColorActive: brand,
    borderRadius: '8px',
  },
  Button: {
    borderRadius: '8px',
    borderRadiusSmall: '6px',
  },
  Input: {
    borderRadius: '8px',
    color: '#ffffff',
    borderColor: '#e6e8ec',
    borderColorHover: brand,
    borderColorFocus: brand,
    placeholderColor: '#9ca3af',
  },
  Tag: {
    borderRadius: '6px',
  },
  DataTable: {
    thColor: '#f6f7f9',
    tdColor: '#ffffff',
    tdColorHover: 'rgba(188, 140, 255, 0.04)',
    borderColor: '#edf0f3',
    thTextColor: '#6b7280',
  },
  Drawer: {
    color: '#ffffff',
  },
  Tooltip: {
    color: '#1c1f27',
    textColor: '#e8eaf0',
  },
  Progress: {
    railColor: '#edf0f3',
  },
  Skeleton: {
    color: '#edf0f3',
    colorEnd: '#e6e8ec',
  },
  Empty: {
    textColor: '#9ca3af',
  },
  Alert: {
    borderRadius: '8px',
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    ...semanticCommon,
    bodyColor: '#0e1014',
    cardColor: '#16181f',
    modalColor: '#1c1f27',
    popoverColor: '#1c1f27',
    tableColor: '#16181f',
    textColorBase: '#e8eaf0',
    textColor1: '#e8eaf0',
    textColor2: '#9aa2b1',
    textColor3: '#5c6470',
    borderColor: '#262a33',
    dividerColor: '#1f232b',
  },
  Card: {
    color: '#16181f',
    borderColor: '#262a33',
    borderRadius: '12px',
    titleFontSize: '15px',
  },
  Layout: {
    color: '#0e1014',
    colorBase: '#0e1014',
  },
  Menu: {
    itemColor: 'transparent',
    itemColorHover: 'rgba(188, 140, 255, 0.12)',
    itemColorActive: 'rgba(188, 140, 255, 0.18)',
    itemColorActiveHover: 'rgba(188, 140, 255, 0.22)',
    itemTextColor: '#9aa2b1',
    itemTextColorHover: '#e8eaf0',
    itemTextColorActive: brand,
    itemIconColor: '#9aa2b1',
    itemIconColorActive: brand,
    borderRadius: '8px',
  },
  Button: {
    borderRadius: '8px',
    borderRadiusSmall: '6px',
  },
  Input: {
    borderRadius: '8px',
    color: '#1c1f27',
    borderColor: '#262a33',
    borderColorHover: brand,
    borderColorFocus: brand,
    placeholderColor: '#5c6470',
  },
  Tag: {
    borderRadius: '6px',
  },
  DataTable: {
    thColor: '#16181f',
    tdColor: '#16181f',
    tdColorHover: 'rgba(188, 140, 255, 0.08)',
    borderColor: '#1f232b',
    thTextColor: '#9aa2b1',
  },
  Drawer: {
    color: '#1c1f27',
  },
  Tooltip: {
    color: '#1c1f27',
    textColor: '#e8eaf0',
  },
  Progress: {
    railColor: '#1f232b',
  },
  Skeleton: {
    color: '#1f232b',
    colorEnd: '#262a33',
  },
  Empty: {
    textColor: '#5c6470',
  },
  Alert: {
    borderRadius: '8px',
  },
};
