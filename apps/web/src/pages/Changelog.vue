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
  <div class="flex flex-col gap-4">
    <SectionCard title="路线图 · 待办规划">
      <div class="md-body" v-html="roadmapHtml" />
      <p class="mt-4 mb-0 text-xs text-ink-3">{{ note }}</p>
    </SectionCard>

    <SectionCard v-for="release in releases" :key="release.version">
      <div class="flex flex-col gap-3">
        <div class="flex items-baseline gap-3">
          <span class="text-lg font-semibold text-ink">{{ release.version }}</span>
          <span v-if="release.date" class="text-xs text-ink-3 num">{{ release.date }}</span>
        </div>
        <div class="md-body" v-html="release.html" />
      </div>
    </SectionCard>
  </div>
</template>

