import type { GlobalThemeOverrides } from 'naive-ui';
import { lightPalette, darkPalette, rgba, fontFamily, type Palette } from './palette';

/**
 * Naive UI 主题覆盖：色值全部来自 palette.ts（颜色唯一来源）。
 * Naive 内部会对颜色做 rgba 混合，这里必须给字面色值，不能给 var()。
 * 字号统一偶数：正文 14，标题 16/20。
 */

function build(p: Palette): GlobalThemeOverrides {
  const neutralSoft = rgba(p.textSecondary, 0.1);
  const brandSoft = rgba(p.brand, 0.12);
  return {
    common: {
      primaryColor: p.brand,
      primaryColorHover: p.brandHover,
      primaryColorPressed: p.brandPressed,
      primaryColorSuppl: p.brand,
      successColor: p.success,
      successColorHover: p.success,
      successColorPressed: p.success,
      warningColor: p.warning,
      warningColorHover: p.warning,
      warningColorPressed: p.warning,
      errorColor: p.danger,
      errorColorHover: p.danger,
      errorColorPressed: p.danger,
      infoColor: p.brand,
      infoColorHover: p.brandHover,
      infoColorPressed: p.brandPressed,
      borderRadius: '8px',
      borderRadiusSmall: '8px',
      fontSize: '14px',
      fontSizeMedium: '14px',
      fontSizeLarge: '16px',
      fontFamily,
      bodyColor: p.bg,
      cardColor: p.panel,
      modalColor: p.overlay,
      popoverColor: p.overlay,
      tableColor: p.panel,
      textColorBase: p.textPrimary,
      textColor1: p.textPrimary,
      textColor2: p.textSecondary,
      textColor3: p.textTertiary,
      borderColor: p.border,
      dividerColor: p.divider,
    },
    /** 默认按钮给一层可见底 + 描边，避免"看不出是按钮"。 */
    Button: {
      borderRadius: '8px',
      borderRadiusSmall: '8px',
      fontSizeMedium: '14px',
      color: neutralSoft,
      colorHover: p.border,
      colorPressed: p.border,
      colorFocus: p.border,
      border: `1px solid ${p.border}`,
      borderHover: `1px solid ${p.brand}`,
      borderPressed: `1px solid ${p.brandPressed}`,
      borderFocus: `1px solid ${p.brand}`,
      textColor: p.textPrimary,
      textColorHover: p.brand,
      textColorPressed: p.brandPressed,
      textColorFocus: p.brand,
      rippleColor: p.brand,
    },
    Card: {
      color: p.panel,
      borderColor: p.border,
      borderRadius: '12px',
      titleFontSize: '16px',
      fontSize: '14px',
      padding: '16px 20px',
    },
    Layout: { color: p.bg, colorBase: p.bg },
    Menu: {
      itemColor: 'transparent',
      itemColorHover: brandSoft,
      itemColorActive: brandSoft,
      itemColorActiveHover: brandSoft,
      itemTextColor: p.textSecondary,
      itemTextColorHover: p.textPrimary,
      itemTextColorActive: p.brand,
      itemIconColor: p.textSecondary,
      itemIconColorActive: p.brand,
      borderRadius: '8px',
      fontSize: '14px',
    },
    Input: {
      borderRadius: '8px',
      color: p.overlay,
      borderColor: p.border,
      borderColorHover: p.brand,
      borderColorFocus: p.brand,
      placeholderColor: p.textTertiary,
      fontSizeMedium: '14px',
    },
    Tag: { borderRadius: '8px', fontSizeMedium: '12px' },
    DataTable: {
      thColor: p.bg,
      tdColor: p.panel,
      tdColorHover: brandSoft,
      borderColor: p.divider,
      thTextColor: p.textSecondary,
      fontSizeMedium: '14px',
    },
    Drawer: { color: p.overlay },
    Tooltip: { color: p.overlay, textColor: p.textPrimary },
    Progress: { railColor: p.divider },
    Skeleton: { color: p.divider, colorEnd: p.border },
    Empty: { textColor: p.textTertiary, fontSizeMedium: '14px' },
    Alert: { borderRadius: '8px', fontSize: '14px', titleFontSize: '14px' },
    Tabs: { tabFontSizeMedium: '14px' },
    Radio: { fontSizeMedium: '14px', buttonBorderColor: p.border },
    Switch: { railColor: p.border },
    Select: { fontSizeMedium: '14px' },
  };
}

export const lightThemeOverrides: GlobalThemeOverrides = build(lightPalette);
export const darkThemeOverrides: GlobalThemeOverrides = build(darkPalette);
