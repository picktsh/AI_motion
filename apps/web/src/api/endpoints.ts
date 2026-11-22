/**
 * 所有后端接口路径集中在这里维护。
 * 业务页面与领域模块只引用这里的常量或工厂，不在代码里拼路径字面量。
 */
export const endpoints = {
  environment: '/environment',

  templates: {
    list: '/templates',
    detail: (id: string): string => `/templates/${encodeURIComponent(id)}`,
    redirect: (id: string): string => `/templates/${encodeURIComponent(id)}/redirect`,
  },

  videos: {
    list: '/videos',
    detail: (id: string): string => `/videos/${encodeURIComponent(id)}`,
  },

  tts: {
    samples: '/tts/samples',
    segments: '/tts/segments',
  },

  assets: {
    byPath: (rel: string): string => `/assets?path=${encodeURIComponent(rel)}`,
  },
} as const;
