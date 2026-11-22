<script setup lang="ts">
import SectionCard from '../components/data/SectionCard.vue';
import changelogRaw from '../../../../docs/changelog.md?raw';
import roadmapRaw from '../../../../docs/roadmap.md?raw';

interface Entry {
  type: string;
  text: string;
  ref: string;
}

interface Release {
  version: string;
  date: string;
  items: Entry[];
}

interface RoadmapGroup {
  title: string;
  items: Entry[];
}

const REF_RE = /#\d+/g;

function releaseEntry(body: string): Entry {
  const parts = body.split('·').map((s) => s.trim());
  const refs = body.match(REF_RE) ?? [];
  const text = parts
    .slice(1)
    .map((s) => s.replace(REF_RE, '').trim())
    .filter(Boolean)
    .join(' · ');
  return { type: parts[0] ?? '', text, ref: refs.join(' ') };
}

function roadmapEntry(body: string): Entry {
  const refs = body.match(REF_RE) ?? [];
  const text = body.replace(REF_RE, '').replace(/^·\s*/, '').trim();
  return { type: '规划', text, ref: refs.join(' ') };
}

function parseReleases(raw: string): Release[] {
  const releases: Release[] = [];
  let release: Release | null = null;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('# ') || t.startsWith('>')) continue;

    if (t.startsWith('## ')) {
      const [version, date] = t.slice(3).trim().split('·').map((s) => s.trim());
      release = { version: version ?? '', date: date ?? '', items: [] };
      releases.push(release);
    } else if (t.startsWith('- ')) {
      release?.items.push(releaseEntry(t.slice(2).trim()));
    }
  }

  return releases;
}

function parseRoadmap(raw: string): RoadmapGroup[] {
  const groups: RoadmapGroup[] = [];
  let group: RoadmapGroup | null = null;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('# ') || t.startsWith('>')) continue;

    if (t.startsWith('## ')) {
      group = { title: t.slice(3).trim(), items: [] };
      groups.push(group);
    } else if (t.startsWith('- ')) {
      group?.items.push(roadmapEntry(t.slice(2).trim()));
    }
  }

  return groups;
}

const releases = parseReleases(changelogRaw);
const roadmap = parseRoadmap(roadmapRaw);

const typeTone: Record<string, string> = {
  新增: 'success',
  修复: 'danger',
  调整: 'warning',
  文档: 'neutral',
  规划: 'info',
};

const note =
  '完整变更记录见 docs/changelog.md，路线图与待办见 docs/roadmap.md，需求归属见 docs/requirements.md';
</script>

<template>
  <div class="changelog">
    <SectionCard title="路线图 · 待办规划">
      <div v-for="group in roadmap" :key="group.title" class="group">
        <div class="group__title">{{ group.title }}</div>
        <ul class="group__list">
          <li v-for="(item, i) in group.items" :key="i" class="group__item">
            <span class="tag tag--info">{{ item.type }}</span>
            <span class="group__text">{{ item.text }}</span>
            <span v-if="item.ref" class="group__ref tnum">{{ item.ref }}</span>
          </li>
        </ul>
      </div>
      <p class="changelog__note">{{ note }}</p>
    </SectionCard>

    <SectionCard v-for="release in releases" :key="release.version">
      <div class="release">
        <div class="release__head">
          <span class="release__version">{{ release.version }}</span>
          <span v-if="release.date" class="release__date tnum">{{ release.date }}</span>
        </div>

        <ul class="group__list">
          <li v-for="(item, i) in release.items" :key="i" class="group__item">
            <span class="tag" :class="`tag--${typeTone[item.type] ?? 'neutral'}`">{{ item.type }}</span>
            <span class="group__text">{{ item.text }}</span>
            <span v-if="item.ref" class="group__ref tnum">{{ item.ref }}</span>
          </li>
        </ul>
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

.release__head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
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

.group {
  margin-bottom: 16px;
}

.group:last-child {
  margin-bottom: 0;
}

.group__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.group__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group__item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-primary);
}

.group__text {
  line-height: 20px;
}

.group__ref {
  flex: none;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.tag {
  flex: none;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-tag);
  background: var(--color-neutral-soft);
  color: var(--color-text-secondary);
}

.tag--success {
  color: var(--color-success);
  background: var(--color-success-soft);
}

.tag--danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

.tag--warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
}

.tag--info {
  color: var(--color-brand);
  background: var(--color-brand-soft);
}

.changelog__note {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
