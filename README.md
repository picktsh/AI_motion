# AI Motion Studio

本地 AI 视频制作工具链 + 开源控制台。围绕 MotionGit 模板组织素材、配音和成片，提供一个仅本机访问的 Web 界面来浏览模板与素材、检查环境依赖、回显预览和产物。

## 环境要求

- Node.js >= 22（自带 corepack，pnpm 通过 corepack 启用）
- uv（Python 脚本依赖，按脚本头 PEP723 隔离）
- ffmpeg / ffprobe（可放在 `studio/bin/` 或加入 PATH）
- Chrome / Chromium（模板渲染用）

版本与来源见 `DEPENDENCIES.md`。

## 启动

开发模式需要两个进程：

```bash
# 后端：只读 API，127.0.0.1:5199
pnpm dev:server

# 前端：Vite 开发服务器，127.0.0.1:5173，/api 代理到后端
pnpm dev:web
```

浏览器打开 http://127.0.0.1:5173 。

生产构建（后端编译到 `dist/`，前端打包）：

```bash
pnpm build
```

## 配置项

后端配置在进程启动时读取环境变量，未设置时回退到内置缺省；业务代码不直接读裸环境变量，统一经 `apps/server/src/config.ts`。

| 变量 | 作用 | 缺省值 |
|---|---|---|
| `HOST` | 后端监听地址 | `127.0.0.1`（仅本机回环） |
| `PORT` | 后端监听端口 | `5199`（非 1–65535 整数时回退缺省） |
| `API_PREFIX` | 接口路径前缀 | `/api/v1`（自动去除尾部斜杠） |
| `SERVICE_NAME` | 服务名，健康检查回显 | `ai-motion-studio` |
| `LOG_LEVEL` | Pino 日志级别 | `info` |

前端配置为 Vite 构建期变量，写在 `apps/web/.env`，改完需重启 dev 或重新构建：

| 变量 | 作用 | 缺省/示例 |
|---|---|---|
| `VITE_SERVER_ORIGIN` | 后端服务源 | `http://127.0.0.1:5199` |
| `VITE_SERVER_API` | 接口路径前缀 | `/api/v1` |

访问密钥、CORS 来源白名单属二期安全条目，方案待定，见 [docs/roadmap.md](./docs/roadmap.md)。

## 目录

| 路径 | 说明 | 是否入库 |
|---|---|---|
| `apps/server/` | 后端，Fastify 5 + TypeScript，只读 API | 入库（`node_modules`、`dist` 忽略） |
| `apps/web/` | 前端，Vue3 + Vite + TS + Naive UI | 入库（`node_modules`、`dist` 忽略） |
| `packages/shared/` | 前后端共享错误码、常量与契约类型 | 入库 |
| `studio/template/` | 现有 MotionGit 模板工程（二期迁 `studio/templates/`） | 入库 |
| `studio/templates/` | 自有模板 | 入库 |
| `studio/templates-cache/` | 第三方模板本地缓存 | 忽略 |
| `templates.lock.json` | 模板锁清单 | 入库 |
| `studio/public/` | 可再分发的 demo 素材 | 入库 |
| `studio/videos/` | 每条视频的输入与产物 | 忽略 |
| `studio/tts/` | 配音脚本、样例、分段清单 | 脚本与清单入库，音频产物忽略 |
| `studio/bin/` | 外部二进制 | 忽略 |
| `docs/` | 愿景、设计文档、需求清单、路线图与变更日志 | 入库 |

## 模板来源

1. GitHub 公开仓库：工具可直拉到缓存，锁 commit SHA。
2. MotionGit 受门禁或带个人 key 的包：不代登录、不代下载、不经手 key。页面只解析元数据并跳转原站，用户自行下载后把 `.motion` 拖进网页，再解析、校验、缓存到 `studio/templates-cache/`。
3. 本地 `.motion` 导入。

包里若含个人 key 或凭据，仅限本机使用，禁止外传和提交仓库。

## 一期范围

只读浏览与回显：环境检查、模板列表与详情、视频条目与产物、TTS 样例与分段。渲染、合成等执行命令在后续阶段接入。

## 素材边界

公共仓只放可再分发的代码、脚本、锁清单和确认许可的 demo 素材。本人角色人像、配音轨、选定 BGM、个人成片、个人字幕稿不提交。公共素材逐个确认许可后再入库。
