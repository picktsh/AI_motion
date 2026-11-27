# AI Motion Desk

围绕 `.motion` 模板的本地可视化工作台。项目、素材、配音和成片以磁盘文件为事实来源；用户既可以通过面板管理文件，也可以让外部 AI 工具直接在工程目录中落盘，再由面板统一回显和整理。当前不依赖数据库或托管服务器。

AI Motion Desk 是独立社区项目，与 MotionGit 无隶属、合作或官方背书关系。

## 环境要求

- Node.js >= 22（自带 corepack，pnpm 通过 corepack 启用）
- uv（Python 脚本依赖；优先使用 `apps/server/vendor/uv`，否则从系统 `PATH` 查找）
- ffmpeg / ffprobe（可放在 `studio/bin/` 或加入 PATH）
- Chrome / Chromium（模板渲染用）

版本与来源见 `DEPENDENCIES.md`。

## 启动

开发模式需要两个进程：

```bash
# 后端：本地 API（只读回显 + 白名单命令台），127.0.0.1:5599
pnpm dev:server

# 前端：Vite 开发服务器，127.0.0.1:5577，后端地址由页面运行时配置
pnpm dev:web
```

浏览器打开 http://127.0.0.1:5577 。

两端都只绑定本机回环 `127.0.0.1`；默认端口若与本机其他软件冲突，后端用 `PORT`、前端用 `VITE_PORT` 覆盖（见下表）。

生产构建（后端编译到 `dist/`，前端打包）：

```bash
pnpm build
```

初始化或修复 TTS Python 环境：

```bash
pnpm setup:python
```

该命令根据 `apps/server/python/pyproject.toml` 与 `uv.lock` 在 `apps/server/python/.venv/` 安装依赖。首次安装需要连接 Python 包索引；若网络受限，可配置 `UV_CACHE_DIR` 指向可写缓存目录。

## 配置项

后端配置在进程启动时读取环境变量，未设置时回退到内置缺省；业务代码不直接读裸环境变量，统一经 `apps/server/src/config.ts`。生效值与来源可查 `GET /api/v1/config`，也可在面板「环境」页的「运行配置」卡片查看。

| 变量 | 作用 | 缺省值 |
|---|---|---|
| `HOST` | 后端监听地址 | `127.0.0.1`（仅本机回环） |
| `PORT` | 后端监听端口 | `5599`（非 1–65535 整数时回退缺省） |
| `API_PREFIX` | 接口路径前缀 | `/api/v1`（自动去除尾部斜杠） |
| `SERVICE_NAME` | 服务名，健康检查回显 | `ai-motion-studio` |
| `ACCESS_KEY` / `ACCESS_KEYS` | 访问密钥，配了即强制鉴权；`ACCESS_KEYS` 用逗号分隔多把，便于轮换 | 未配置（回环本地不校验） |
| `CORS_ORIGINS` | 允许的跨域来源白名单（逗号分隔） | 未配置时仅放行本机回环来源 |
| `LOG_LEVEL` | Pino 日志级别 | `info` |

也可以把固定值写进 `config/local.json`（不入库，模板见 `config/local.example.json`），优先级为环境变量 > 本地配置文件 > 内置缺省。

前端配置为 Vite 构建期变量，写在 `apps/web/.env`，改完需重启 dev 或重新构建：

| 变量 | 作用 | 缺省/示例 |
|---|---|---|
| `VITE_SERVER_ORIGIN` | 后端服务源 | `http://127.0.0.1:5599` |
| `VITE_SERVER_API` | 接口路径前缀 | `/api/v1` |
| `VITE_PORT` | 前端 dev 端口 | `5577`（非 1–65535 整数时回退缺省） |

密钥只从环境变量或本地配置文件读取，不入库、不进日志，面板只显示启用状态与长度；多把并存用于轮换，删掉旧密钥重启即失效。

## 目录

| 路径 | 说明 | 是否入库 |
|---|---|---|
| `apps/server/` | 后端，Fastify 5 + TypeScript，只读回显 + 命令台任务执行 | 入库（`node_modules`、`dist` 忽略） |
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

## 当前范围

只读浏览与回显：环境检查、模板列表与详情（含参数概要）、视频条目与产物、TTS 样例与分段。命令台按白名单执行 plan / prepare / preview / render / tts 等本地脚本，任务异步排队，状态与日志经 SSE 推送（`GET /api/v1/jobs/stream`），REST 增量日志作补偿；发布配置与 BGM 选用的写回接口仍待开放。

## 素材边界

公共仓只放可再分发的代码、脚本、锁清单和确认许可的 demo 素材。本人角色人像、配音轨、选定 BGM、个人成片、个人字幕稿不提交。公共素材逐个确认许可后再入库。
