<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NIcon } from 'naive-ui';
import { InformationCircleOutline, DocumentTextOutline } from '@vicons/ionicons5';
import { REPO_URL } from '../../shared/constants';

const router = useRouter();
const VERSION = '0.1.0';

function goAbout() {
  router.push('/about');
}

function goChangelog() {
  router.push('/changelog');
}
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__left">
      <span class="app-footer__brand">AI Motion Studio</span>
      <span class="app-footer__dot">·</span>
      <span class="app-footer__meta">v{{ VERSION }}</span>
    </div>

    <nav class="app-footer__links">
      <button type="button" class="app-footer__link" @click="goAbout">
        <n-icon :size="14"><InformationCircleOutline /></n-icon>
        关于我们
      </button>
      <button type="button" class="app-footer__link" @click="goChangelog">
        <n-icon :size="14"><DocumentTextOutline /></n-icon>
        更新日志
      </button>
      <a class="app-footer__link" :href="REPO_URL" target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </nav>
  </footer>
</template>

<style scoped>
.app-footer {
  flex: none;
  box-sizing: border-box;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: nowrap;
  padding: 0 var(--space-page);
  border-top: 1px solid var(--color-border);
  background: var(--color-panel);
}

.app-footer__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
}

.app-footer__brand {
  font-weight: 600;
  color: var(--color-text-primary);
}

.app-footer__dot {
  color: var(--color-text-tertiary);
}

.app-footer__meta {
  color: var(--color-text-secondary);
}

.app-footer__links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-footer__link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-decoration: none;
  transition: color var(--transition);
}

.app-footer__link:hover {
  color: var(--color-brand);
}
</style>
