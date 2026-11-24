<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NIcon } from 'naive-ui';
import { CopyOutline, CheckmarkOutline } from '@vicons/ionicons5';

const props = withDefaults(
  defineProps<{
    /** 区块标题，默认「交给 AI 助手」 */
    title?: string;
    /** 一句引导说明：这段动作不在面板执行，复制给外部 AI 工具处理 */
    hint?: string;
    /** 要复制的完整提示词文案 */
    prompt: string;
    buttonText?: string;
    /** 无内容时禁用复制按钮 */
    disabled?: boolean;
  }>(),
  {
    title: '交给 AI 助手',
    hint: '',
    buttonText: '复制提示词',
    disabled: false,
  },
);

const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.prompt);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = props.prompt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-card border border-border bg-neutral-soft p-4">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="m-0 text-sm font-semibold text-ink">{{ title }}</h3>
        <p v-if="hint" class="m-0 mt-1 text-xs leading-5 text-ink-2">{{ hint }}</p>
      </div>
      <NButton
        :type="copied ? 'success' : 'primary'"
        :disabled="disabled"
        class="flex-none"
        @click="copy"
      >
        <template #icon>
          <NIcon :size="14">
            <CheckmarkOutline v-if="copied" />
            <CopyOutline v-else />
          </NIcon>
        </template>
        {{ copied ? '已复制' : buttonText }}
      </NButton>
    </header>
    <pre
      class="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-control border border-border bg-panel p-3 font-mono text-xs leading-5 text-ink-2"
    >{{ prompt }}</pre>
  </section>
</template>
