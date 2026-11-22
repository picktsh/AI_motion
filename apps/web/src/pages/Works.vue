<script setup lang="ts">
import { useRouter } from 'vue-router';
import SectionCard from '../components/data/SectionCard.vue';
import EmptyState from '../components/data/EmptyState.vue';

const router = useRouter();
</script>

<template>
  <div class="works">
    <SectionCard title="作品">
      <EmptyState
        description="作品发布清单待后端清单接口落地"
        tip="这里将集中管理各作品的发布配置、封面与成片交付物；制作工程、引用素材与产物回显在「视频条目」"
      >
        <template #action>
          <n-button size="small" @click="router.push('/videos')">查看视频条目</n-button>
        </template>
      </EmptyState>
    </SectionCard>
  </div>
</template>

<style scoped>
.works {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
