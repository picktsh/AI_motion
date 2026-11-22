/**
 * 所有后端接口路径集中在这里维护。
 * 业务页面与领域模块只引用这里的常量或工厂，不在代码里拼路径字面量。
 */
export const endpoints = {
  environment: '/environment',

  templates: {
    list: '/templates',
    catalog: '/templates/catalog',
    import: '/templates/import',
    detail: (id: string): string => `/templates/${encodeURIComponent(id)}`,
    redirect: (id: string): string => `/templates/${encodeURIComponent(id)}/redirect`,
  },

  videos: {
    list: '/videos',
    detail: (id: string): string => `/videos/${encodeURIComponent(id)}`,
    publish: (id: string): string => `/videos/${encodeURIComponent(id)}/publish`,
    assets: (id: string): string => `/videos/${encodeURIComponent(id)}/assets`,
  },

  tts: {
    samples: '/tts/samples',
    segments: '/tts/segments',
  },

  jobs: {
    list: '/jobs',
    detail: (id: string): string => `/jobs/${encodeURIComponent(id)}`,
    logs: (id: string): string => `/jobs/${encodeURIComponent(id)}/logs`,
    cancel: (id: string): string => `/jobs/${encodeURIComponent(id)}/cancel`,
  },

  projects: {
    list: '/projects',
    create: '/projects',
    detail: (id: string): string => `/projects/${encodeURIComponent(id)}`,
    quote: (id: string): string => `/projects/${encodeURIComponent(id)}/quote`,
    run: (id: string): string => `/projects/${encodeURIComponent(id)}/run`,
    preparePublish: (id: string): string => `/projects/${encodeURIComponent(id)}/prepare-publish`,
    files: (id: string): string => `/projects/${encodeURIComponent(id)}/files`,
    credits: (id: string): string => `/projects/${encodeURIComponent(id)}/credits`,
    log: (id: string, offset = 0): string => `/projects/${encodeURIComponent(id)}/log?offset=${offset}`,
  },

  assets: {
    byPath: (rel: string): string => `/assets?path=${encodeURIComponent(rel)}`,
  },
} as const;
