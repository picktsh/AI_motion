<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NCard, NInput, NEmpty, NTag, NButton, NSpin } from 'naive-ui';
import { SearchOutline } from '@vicons/ionicons5';
import { searchAll, type SearchHit, type SearchResult } from '../api/search';
import { assetUrl } from '../api/client';
import { endpoints } from '../api/endpoints';

const route = useRoute();
const router = useRouter();

const keyword = ref(String(route.query.q ?? ''));
const loading = ref(false);
const result = ref<SearchResult | null>(null);

const groups = computed(() => {
  const list = result.value?.hits ?? [];
  const order: Array<{ kind: SearchHit['kind']; label: string }> = [
    { kind: 'project', label: '项目' },
    { kind: 'template', label: '模板' },
    { kind: 'asset', label: '素材' },
  ];
  return order.map((g) => ({ ...g, items: list.filter((h) => h.kind === g.kind) })).filter((g) => g.items.length > 0);
});

async function run() {
  const q = keyword.value.trim();
  if (!q) {
    result.value = null;
    return;
  }
  loading.value = true;
  try {
    result.value = await searchAll(q);
  } finally {
    loading.value = false;
  }
}

function submit() {
  const q = keyword.value.trim();
  router.replace({ path: '/search', query: q ? { q } : {} });
  void run();
}

function openHit(item: SearchHit) {
  if (item.kind === 'asset' && item.id) {
    window.open(assetUrl(endpoints.assets.byPath(item.id)), '_blank', 'noopener');
    return;
  }
  if (item.route) router.push(item.route);
}

onMounted(() => void run());
watch(() => route.query.q, (v) => {
  const next = String(v ?? '');
  if (next !== keyword.value) {
    keyword.value = next;
    void run();
  }
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <NCard>
      <div class="flex flex-col gap-3">
        <NInput
          v-model:value="keyword"
          size="large"
          clearable
          placeholder="搜索项目、模板或素材文件名，回车执行"
          @keyup.enter="submit"
        >
          <template #prefix>
            <SearchOutline class="w-4 h-4 text-ink-3" />
          </template>
          <template #suffix>
            <NButton text type="primary" :loading="loading" @click="submit">搜索</NButton>
          </template>
        </NInput>
        <p class="m-0 text-xs text-ink-3">只查本地台账与磁盘清单：项目名/编号/文稿、模板名/编号、素材文件名。</p>
      </div>
    </NCard>

    <NSpin :show="loading">
      <NEmpty v-if="!keyword.trim()" description="输入关键词开始检索" />
      <NEmpty v-else-if="result && !result.total" description="没有匹配结果" />
      <div v-else class="flex flex-col gap-4">
        <NCard v-for="group in groups" :key="group.kind" :title="`${group.label} · ${group.items.length}`">
          <ul class="m-0 pl-0 flex flex-col gap-1 list-none">
            <li
              v-for="item in group.items"
              :key="`${item.kind}-${item.id}`"
              class="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-brand-soft cursor-pointer"
              @click="openHit(item)"
            >
              <NTag size="small" :bordered="false" class="flex-none mt-0.5">{{ group.label }}</NTag>
              <div class="min-w-0 flex-1 flex flex-col gap-1">
                <span class="text-sm text-ink truncate">{{ item.title }}</span>
                <span class="text-xs text-ink-3 truncate font-mono">{{ item.subtitle }}</span>
              </div>
              <span class="flex-none text-xs text-ink-3">{{ item.kind === 'asset' ? '打开' : '进入' }}</span>
            </li>
          </ul>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>
