import { computed, ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'ams-theme';

function initialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const mode = ref<ThemeMode>(initialMode());

function apply(next: ThemeMode) {
  document.documentElement.dataset.theme = next;
}

watch(
  mode,
  (next) => {
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  },
  { immediate: true },
);

/** 全局主题单例：模块级共享，无需 Pinia。 */
export function useTheme() {
  const isDark = computed(() => mode.value === 'dark');

  function setMode(next: ThemeMode) {
    mode.value = next;
  }
  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark';
  }

  return { mode, isDark, setMode, toggle };
}
