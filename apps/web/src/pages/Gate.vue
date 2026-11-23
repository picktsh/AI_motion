<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, NForm, NFormItem, NIcon, useMessage } from 'naive-ui';
import { ServerOutline } from '@vicons/ionicons5';
import { useServerConfig } from '../composables/useServerConfig';
import { pingHealth } from '../api/health';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const { state, save, defaultOrigin } = useServerConfig();

const origin = ref(state.origin || defaultOrigin);
const accessKey = ref(state.accessKey);
const testing = ref(false);
const originError = ref(false);

async function test(): Promise<boolean> {
  testing.value = true;
  originError.value = false;
  try {
    const res = await pingHealth(origin.value, accessKey.value);
    if (res.ok) return true;
    originError.value = true;
    message.error(res.message);
    return false;
  } finally {
    testing.value = false;
  }
}

function goBack(): void {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  router.replace(redirect || '/');
}

async function enter(): Promise<void> {
  const reachable = await test();
  if (!reachable) return;
  save(origin.value, accessKey.value);
  goBack();
}
</script>

<template>
  <div class="min-h-screen grid place-items-center bg-bg px-6">
    <div class="w-full max-w-md card p-6 flex flex-col gap-4">
      <div class="flex items-start gap-3">
        <NIcon :size="28" class="flex-none text-brand"><ServerOutline /></NIcon>
        <div>
          <h2 class="page-title mt-0">连接后端服务</h2>
          <p class="page-desc mt-0.5">先填后端地址；访问密钥仅在后端开启鉴权时需要，没有可留空。</p>
        </div>
      </div>

      <NForm label-placement="top" class="flex flex-col gap-3">
        <NFormItem label="后端地址" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="origin"
            placeholder="http://127.0.0.1:5199"
            spellcheck="false"
            :status="originError ? 'error' : undefined"
            @input="originError = false"
            @keyup.enter="enter"
          />
        </NFormItem>
        <NFormItem label="访问密钥（可选）" label-class="text-xs text-ink-2">
          <NInput
            v-model:value="accessKey"
            type="password"
            show-password-on="click"
            placeholder="后端未开启鉴权时留空"
            spellcheck="false"
          />
        </NFormItem>
      </NForm>

      <div class="flex items-center gap-2">
        <NButton type="primary" class="flex-1" :loading="testing" @click="enter">连接并进入</NButton>
      </div>

      <div class="flex flex-col gap-1 text-xs text-ink-3 leading-5">
        <div>
          连不上时，先在工程根目录运行 <span class="font-mono text-ink-2">pnpm dev:server</span> 启动后端，默认监听 <span class="font-mono text-ink-2">127.0.0.1:5199</span>；端口或主机有变动，再改上面的后端地址。
        </div>
        <div>地址与密钥只存在本机浏览器，之后可在设置页调整；后端未开启鉴权时密钥留空即可。</div>
      </div>
    </div>
  </div>
</template>
