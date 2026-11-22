<script setup lang="ts">
import { computed } from 'vue';
import SectionCard from '../components/data/SectionCard.vue';
import { renderMarkdown } from '../lib/markdown';
import changelogRaw from '../../../../docs/changelog.md?raw';
import roadmapRaw from '../../../../docs/roadmap.md?raw';

interface ReleaseSection {
  version: string;
  date: string;
  html: string;
}

function splitSections(raw: string): { head: string; body: string }[] {
  const sections: { head: string; body: string }[] = [];
  let current: { head: string; body: string } | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('## ')) {
      current = { head: line.slice(3).trim(), body: '' };
      sections.push(current);
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  return sections;
}

function parseHead(head: string): { version: string; date: string } {
  const [version, date] = head.split('·').map((s) => s.trim());
  return { version: version ?? head, date: date ?? '' };
}

const roadmapHtml = computed(() => renderMarkdown(roadmapRaw));

const releases = computed<ReleaseSection[]>(() =>
  splitSections(changelogRaw).map((s) => {
    const { version, date } = parseHead(s.head);
    return { version, date, html: renderMarkdown(s.body) };
  }),
);

const note =
  '完整变更记录见 docs/changelog.md，路线图与待办见 docs/roadmap.md，需求归属见 docs/requirements.md';
</script>

<template>
  <div class="changelog">
    <SectionCard title="路线图 · 待办规划">
      <div class="md-body" v-html="roadmapHtml" />
      <p class="changelog__note">{{ note }}</p>
    </SectionCard>

    <SectionCard v-for="release in releases" :key="release.version">
      <div class="release">
        <div class="release__head">
          <span class="release__version">{{ release.version }}</span>
          <span v-if="release.date" class="release__date tnum">{{ release.date }}</span>
        </div>
        <div class="md-body" v-html="release.html" />
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.changelog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.release {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.release__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.release__version {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.release__date {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.changelog__note {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.md-body :deep(h2:first-child),
.md-body :deep(h3:first-child) {
  margin-top: 0;
}

.md-body :deep(ul) {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.md-body :deep(li) {
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-primary);
}

.md-body :deep(li ul) {
  margin-top: 8px;
}

.md-body :deep(code) {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--color-neutral-soft);
}

.md-body :deep(a) {
  color: var(--color-brand);
  text-decoration: none;
}

.md-body :deep(a:hover) {
  text-decoration: underline;
}

.md-body :deep(blockquote) {
  margin: 8px 0;
  padding-left: 12px;
  border-left: 2px solid var(--color-border);
  color: var(--color-text-tertiary);
  font-size: 12px;
}
</style>
