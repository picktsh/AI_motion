import { shallowRef, type Ref } from 'vue';

export interface AsyncState<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  run: () => Promise<void>;
}

/**
 * 通用异步拉取三态：loading / error / data。
 * 不引入 Pinia；页面组合多个 useFetch 或在一个 fetcher 内并发请求。
 */
export function useFetch<T>(fetcher: () => Promise<T>): AsyncState<T> {
  const data = shallowRef<T | null>(null);
  const loading = shallowRef(true);
  const error = shallowRef<string | null>(null);

  async function run() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetcher();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, run };
}
