<script setup lang="ts">
import { NConfigProvider, lightTheme, darkTheme } from 'naive-ui';
import { useTheme } from './theme/useTheme';
import { lightThemeOverrides, darkThemeOverrides } from './theme/naiveTheme';
import AppShell from './components/layout/AppShell.vue';

const { isDark } = useTheme();
</script>

<template>
  <n-config-provider
    :theme="isDark ? darkTheme : lightTheme"
    :theme-overrides="isDark ? darkThemeOverrides : lightThemeOverrides"
    inline-theme-disabled
  >
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <AppShell />
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>
