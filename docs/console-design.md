# 本地控制台工程设计

## 一、目标与一期范围

做一个开源本地 Web 控制台，补 MotionGit 没有图形界面的空白：浏览模板与素材、检查环境依赖、回显预览和产物。只绑 127.0.0.1，不暴露公网。

一期只做读取和预览，不接渲染执行：
1. 环境检查：工具版本、路径、依赖目录是否就位。
2. 资源浏览：模板、视频条目、TTS 样例与分段清单。
3. 素材回显：图片、音频、视频、预览图在页面里查看和试听。

二期再放开命令台：plan、prepare、preview、render、tts 白名单执行，日志回流，长任务异步轮询。

## 二、目标目录结构

```
AI_motion/
├── package.json              # 根：pnpm scripts、workspace 约定
├── pnpm-workspace.yaml       # apps/*、packages/*
├── apps/
│   ├── server/               # 后端 Fastify 5 + TypeScript（入库）
│   └── web/                  # 前端 Vite + Vue3 + TS 工程（入库）
├── packages/
│   └── shared/               # 前后端共享错误码、常量与契约类型
├── docs/                     # 设计与说明文档
└── studio/                   # 业务资产收拢目录（面板收纳层，非模板输入契约，见 motion-layout.md）
    ├── templates/            # 已落地模板包（只读，跟随官方包结构）
    ├── templates-cache/      # 第三方模板下载缓存（不入库，类比 node_modules）
    ├── templates.lock.json   # 模板锁清单（规划预留）
    ├── projects/<id>/        # 各期工程：面板台账 + 输入归集 + 实例 + 成片产物
    ├── public/               # 公共 demo 素材（入库，可再分发）
    ├── tts/                  # 公共配音脚本与样例（入库）
    ├── videos/               # 旧链路产物（待下线，范围另立步骤）
    └── bin/                  # 外部二进制（不入库）
```

模板、素材、台词、音频、成片的官方放置契约与本平台收纳层对照，见 [motion-layout.md](./motion-layout.md)；入参槽位以各模板自身 schema / contract 为准，不在面板写死固定目录。

现状映射（一期先保留旧路径，迁移另立步骤）：
- 旧 `studio/videos/` 条目产物已被 `studio/projects/<id>/` 取代，旧目录待清理。
- 后端读取路径做一层适配，迁移后只改路径映射，不改业务逻辑。

## 三、模板依赖管理

模板当外部依赖管，和 node_modules 同构：第三方模板不进仓库，本地缓存，仓库只存锁清单。

### 锁清单 templates.lock.json

```json
{
  "version": 1,
  "templates": [
    {
      "id": "kinetic-tech",
      "slug": "385712",
      "name": "酷炫科技风",
      "version": "0.2.7-open-beta",
      "source": {
        "type": "github",
        "url": "https://github.com/motiontemplates/385712",
        "commit": "9dfbe7d7c6a6d4aa03f6f8e2f2285e631099faa"
      },
      "localPath": "studio/templates/kinetic-tech",
      "sha256": null,
      "license": "licenses/TEMPLATE-LICENSE.txt",
      "runtime": { "profile": "kinetic-user-core/1", "entry": "adapter.py" }
    }
  ]
}
```

来源类型：
1. `github`：仓库链接或模板 ID，archive zipball 或浅克隆，锁 commit SHA。
2. `motiongit`：网页链接 `https://motiongit.com/{author}/{slug}`，解析页面元数据后取包。
3. `local-motion`：本地 .motion 文件导入解压。

### 下载与校验
1. 缓存目录 `studio/templates-cache/{slug}-{commit 或版本}/`，gitignore。
2. 下载后记录 SHA256，和锁清单比对；许可文件原样保留，页面展示许可类型。
3. 不跟踪上游分支浮动版本，一律锁 commit 或模板版本号。
4. .motion 是单层 ZIP 容器，不再套压缩包。
5. 包里可能带个人 API key，只本地私有保存，不二次分享、不入库。

### 模板获取流程（按是否需要登录分两类）

1. 公开可直取：GitHub 源码仓库。无门禁、无个人 key，工具可以直接拉取 archive 或浅克隆到缓存目录，锁 commit SHA。
2. 受门禁或带个人 key：MotionGit 模板包。工具不代登录、不代下载、不经手 key：
   - 网页链接只解析元数据（名称、版本、许可、运行时、参数、原始页面地址）。
   - 页面给“前往原站下载”跳转按钮，用户回原站登录、满足下载条件后自行下载。
   - 文件落在用户本机下载目录，不放在我们工程里。
   - 用户把下载好的 .motion 文件拖进网页，工具再做解析、校验、解压，缓存到 `studio/templates-cache/`，并写入锁清单。
3. 凭据检查：解压前扫描包内是否有个人 key、token、凭据字段；发现就提示该包含个人身份信息，仅限本机使用，禁止外传和提交仓库。

### 网页解析待开工验证项
下载直链不在静态 HTML 里，是点按钮后浏览器请求内部 API 拿到的；公开元数据从页面可读，受门禁包不尝试模拟请求。下载规则做成可替换的适配层，站点改版不影响主流程。

## 四、后端 API（Fastify 5 分层骨架，#77 已落地）

基础约定：JSON 响应统一包络；静态资源走独立路由，路径限制在白名单目录内，禁止路径穿越。接口前缀为 `/api/v1`，后续不兼容变更递增版本号。

### 响应与错误规范

成功响应：

- 单资源或报告：`{ "ok": true, "data": <本体> }`
- 列表：`{ "ok": true, "data": { "items": [], "meta": { "total": n } } }`

错误响应：`{ "ok": false, "error": { "code": "<机器码>", "message": "<可读信息>", "details": {} } }`

| HTTP 状态码 | code | 用途 |
| --- | --- | --- |
| 400 | INVALID_PARAMETER | 参数缺失或校验未通过 |
| 401 | UNAUTHORIZED | 访问密钥缺失或无效（预留） |
| 403 | PATH_OUT_OF_SCOPE | 路径越出白名单、拒绝访问 |
| 404 | RESOURCE_NOT_FOUND | 资源或接口不存在 |
| 405 | METHOD_NOT_ALLOWED | 请求方法不被允许 |
| 500 | INTERNAL | 服务内部错误，堆栈不外泄给前端 |

静态资产接口返回原始文件流，不走 JSON 包络；越界归 403，文件不存在归 404。资产回显 URL 由后端按当前 API 前缀拼接，不写死路径。

### 接口文档

- 每条路由的 JSON Schema 同时承担入参校验与 OpenAPI 文档生成，文档即代码，不手写第二份接口说明。
- 运行后端后访问 `/docs`（Scalar 渲染页）；OpenAPI 3.1 JSON 数据源在 `/documentation/json`，Scalar 自带副本 `/docs/openapi.json` 与 `/docs/openapi.yaml`。
- 文档页只在本地/内网开放；将来公开部署时，鉴权或下线文档页另行约定。

### 环境与服务
- `GET /api/v1/health`：服务自身状态。
- `GET /api/v1/environment`：逐项返回工具状态。

环境检查项：
- Node、pnpm 版本与路径。
- uv 版本与路径。
- ffmpeg、ffprobe 版本、路径、可用性。
- Chrome 可执行路径（environment 服务内同一套探测逻辑）。
- Python：uv 可用即可，解释器按脚本头隔离创建。
- 依赖目录：`node_modules`、`studio/tts/.venv`、`studio/bin` 二进制是否就位。

每项返回：`{ key, label, ok, version, path, hint }`，`hint` 给缺失时的补装提示。

### 模板
- `GET /api/v1/templates`：锁清单加本地目录，返回模板卡片列表：id、名称、版本、来源类型、许可、运行时、本地是否就位。
- `GET /api/v1/templates/:id`：详情，读 `motion.json`、`motion.lock.json`、licenses、参数概要、文件树。
- `POST /api/v1/templates/import`：接收拖拽上传的 .motion 文件（multipart 或本地文件路径），扫描凭据、解析清单、解压到缓存目录、写锁清单。返回解析出的元数据和校验结果。
- `GET /api/v1/templates/:id/redirect`：返回原站页面地址，用于跳转登录下载，工具本身不下载受门禁包。

### 视频条目
- `GET /api/v1/videos`：条目列表，每条列 input、instance、output、preview 状态和产物文件。
- `GET /api/v1/videos/:id`：详情，读 `user.json` 字段（标题、场景、文案、字幕、媒体引用），素材清单，图片尺寸，音视频用 ffprobe 读时长/编码/声道/码率。

### TTS
- `GET /api/v1/tts/samples`：试音样例清单，读 `samples.json`，返回文件名、音色标签、音频可回显地址。
- `GET /api/v1/tts/segments`：分段清单，读 `segments.json`，返回段落窗、台词、词边界、音频地址。

### 静态资源
- `GET /api/v1/assets?path=<相对路径>`：回显图片、音频、视频、预览图。允许目录：studio/templates 静态素材、studio/public、studio/videos 条目素材与产物、studio/tts/samples、studio/tts/segments。禁止访问 `.env`、密钥、上级目录。

一期不提供任何 execute / spawn 类接口。

### 后端分层骨架（Fastify 5 + TypeScript，已落地）

后端为独立 pnpm 包 `apps/server`，源码在 `src/`，分层如下；接口路径与响应字段保持不变，前端零改动。

```
apps/server/src/
  index.ts           # 启停层：创建实例、监听、优雅停机
  app.ts             # 装配层：插件、错误收口、OpenAPI/Scalar 文档与路由挂载
  config.ts          # 配置层：HOST/PORT/前缀/服务名，读环境变量并给缺省值
  core/
    errors.ts        # 错误类型、错误码与错误处理器收口（400/401/403/404/405/500）
    response.ts      # 统一成功包络：单资源 data，列表 items + meta.total
    schemas.ts       # 复用 JSON Schema 片段，兼作入参校验与 OpenAPI 文档源
  infra/
    paths.ts         # 白名单路径解析与可执行文件查找
    probe.ts         # ffprobe 媒体探测
    assets.ts        # 白名单资产解析：越界/目录/不存在分别归错
  services/          # 服务层：读文件、探测、业务规则，不接触 req/res
  routes/            # 路由处理器：按域组织，只取参数并调服务层
```

运行时：开发用 `tsx watch` 直跑 TS 源码；生产 `tsc` 编译到 `dist/` 后由 Node 启动。错误日志由 Fastify 内置 Pino 接管，不在业务层手写 `console.error`。

分层职责：

1. 配置层：监听地址、端口、访问密钥、白名单目录的来源与缺省值；业务代码不直接读裸环境变量。
2. 路由层：只做路径匹配、方法校验、参数提取，不写业务规则。
3. 服务层：读文件、探测、业务规则，不接触请求与响应对象。
4. 校验层：路径越界、参数类型与必填；后续写接口接 schema 校验。
5. 响应层：统一 JSON 结构、状态码、Content-Type、Cache-Control，错误格式收口到一处。
6. 中间件：CORS 白名单、访问日志、鉴权钩子；未捕获异常兜底收口。

选型已定为 Fastify 5；下表为当初多维对比依据。性能基准来自 Fastify 官方 2026-11 单实例数据：Fastify 与 Hono 吞吐接近且高于 Express；但本项目是本机单用户低并发，真实瓶颈在渲染与子进程，框架吞吐差异基本不敏感。

| 维度 | Fastify（推荐） | Express | Hono | 零依赖薄骨架 |
| --- | --- | --- | --- | --- |
| 定位 | Node 服务端 API，高性能与规范优先 | 老牌通用中间件框架 | 边缘/多运行时轻框架 | Node 内置 http 自写 |
| TypeScript | 内置一等支持 | 靠社区 @types | 内置一流 | 自己配类型 |
| 参数校验 | 内置 JSON Schema（ajv/TypeBox/Zod） | 手动或另加校验库 | Zod/Valibot 中间件 | 自写 |
| 错误收口 | setErrorHandler 统一，async 抛出自动接 500 | next(err) 手动传递 | 中间件约定 | 自写 |
| 日志 | 默认带 Pino 结构化日志 | 需另接 morgan/pino | @hono/logger | 自写 |
| 鉴权/中间件 | hook + 封装插件，作用域隔离 | 全局中间件，靠顺序 | 中间件式 | 自写链 |
| 优雅停机 | preClose/onClose 钩子，便于收尾子进程 | 需自管 | 需自管 | 自写 |
| 运行时 | 仅 Node | 仅 Node | Node/Bun/Deno/边缘 | Node |
| 生态 | 大而成熟 | 最大最老 | 成长中，偏窄 | 无 |
| 体积 | 中等 | 较大 | 极小（约 14KB） | 零 |
| 学习曲线 | 中 | 最低 | 低到中 | 自担设计成本 |

NestJS：企业级模块化、依赖注入、TS 全家桶，但对单机本地工具过重，排除。

### Python 子进程调用（选型必须纳入的一环）

后端将来要拉起的 Python 与外部进程：

1. `uv run studio/tts/make_voice.py`：TTS 合成，PEP723 声明 Python >=3.10、edge-tts。
2. `uv run studio/template/adapter.py`：preview/render，PEP723 声明 Python >=3.11、numpy、scipy、soundfile、pyloudnorm、jsonschema；脚本内部还会 subprocess 调 ffprobe。
3. `studio/tts/gen_samples.py`：试音样例生成。
4. 外部二进制：ffmpeg、ffprobe、uv、Chromium/Node 侧模板依赖。

边界约定：

1. 框架不负责调 Python。子进程一律用 Node 内置 `child_process`（spawn 取流、execFile 取一次性结果）；后端只拼命令、定工作目录、传环境变量、回收退出码与 stdout/stderr。
2. Python 依赖不进 Node 工程：由 uv 按脚本头 PEP723 自动建隔离环境，pnpm 不装 Python 包。
3. 长任务不占 HTTP 请求：提交任务返回任务 id，再轮询或 SSE 取状态与日志行；渲染串行，任务队列限制并行数。
4. 框架需要配合的点：异步路由不阻塞事件循环；超时与取消信号可透传并终止子进程树；结构化日志收子进程输出行；服务关闭时终止在跑的子进程。
5. 三家在这块的差异：子进程能力都来自 Node 内置，框架不替代；差别在异步模型、错误与超时收口、停机钩子和后台任务插件的成熟度。Fastify 的封装插件与关闭钩子更适合管这类后台任务；Express、Hono 同样能做，队列与停机要自己拼得更多。

落地记录：配置层与统一响应/错误先行抽出；路由拆到 routes 处理器，服务函数不碰 req/res；CORS 与日志经 Fastify 插件接入，鉴权钩子预留；后端独立成包并入 pnpm workspace。访问密钥鉴权、写接口请求体/参数 schema 留待二期。

## 五、前端页面（Vue3 + Vite + TS）

技术栈：Vue3、Vite、TypeScript、VueUse、Naive UI、UnoCSS、lodash-es。

页面划分：
1. 仪表盘 `/`：环境状态红绿一览、最近视频条目、快捷入口。
2. 模板 `/templates`：模板卡片，来源、版本、许可、运行时、就位状态；点进详情看参数和文件树。
3. 视频 `/videos`：条目列表，详情页看文案、字幕、素材预览、预览图、成片播放。
4. TTS `/tts`：样例试听、分段台词与词边界查看。
5. 环境 `/environment`：逐项版本、路径、可用性、补装提示。

数据层：axios 实例集中前缀、超时与错误归一，接口按域拆出类型化函数；契约类型按域归入 `shared/types`，包络与媒体探测结果复用 `packages/shared`。

## 六、公私素材边界

入库（公共）：
- 模板源码与配置、控制台前后端代码、TTS 脚本、文档。
- `studio/public/` 下的 demo 占位图、占位音、示例 user.json、TTS 样例。
- 锁清单、依赖声明。

不入库（私有）：
- 本人角色人像、真实配音轨、选定 BGM、个人成片、个人字幕稿。
- 第三方模板缓存、node_modules、.venv、studio/bin 二进制、渲染实例与产物。

公共素材逐个确认可再分发许可；字体、示例图、BGM 不随便塞进公共仓。

## 七、依赖分工

1. pnpm 只管 Node 侧：前端依赖，以及模板运行时的 Node 包（如 playwright-core）。
2. uv 管 Python 侧：adapter 与 tts 脚本头 PEP723 声明，隔离环境。
3. studio/bin/ 手动管外部二进制：ffmpeg、ffprobe、uv，版本与来源记 DEPENDENCIES.md。

## 八、分期路线

1. 一期：控制台骨架、环境检查、资源浏览、素材回显；适配现有 `studio/template/`、`studio/videos/`、`studio/tts/` 路径。
2. 二期：目录迁移到 `studio/templates`、`studio/videos` 目标结构；接入模板下载解析（GitHub、本地 .motion，MotionGit 网页解析）。
3. 三期：命令台执行（白名单 + 日志流 + 长任务轮询），模板依赖安装联动。
