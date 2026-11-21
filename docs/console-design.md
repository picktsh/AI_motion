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
├── package.json              # 根：pnpm 依赖、scripts、workspace 约定
├── pnpm-lock.yaml
├── .gitignore
├── server/                   # 后端 Node http 服务（入库）
├── web/                      # 前端 Vite + Vue3 工程（入库）
├── docs/                     # 设计与说明文档
└── studio/                   # 业务资产收拢目录
    ├── templates/            # 自有和已落地模板源码（入库）
    ├── templates-cache/      # 第三方模板下载缓存（不入库，类比 node_modules）
    ├── templates.lock.json   # 模板锁清单（入库）
    ├── public/               # 公共 demo 素材（入库，可再分发）
    ├── videos/               # 每条视频的输入素材与产物（不入库）
    ├── tts/                  # 公共配音脚本与样例（入库）
    └── bin/                  # 外部二进制（不入库）
```

现状映射（一期先保留旧路径，迁移另立步骤）：
- 现 `studio/template/` 将来迁到 `studio/templates/kinetic-tech/`。
- 现 `studio/videos/` 将来迁到 `studio/videos/v01-ai-edit/`。
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

## 四、后端 API（Node 内置 http，零框架）

基础约定：JSON 响应，错误带 `error` 字段；静态资源走独立路由，路径限制在白名单目录内，禁止路径穿越。

### 环境与服务
- `GET /api/health`：服务自身状态。
- `GET /api/environment`：逐项返回工具状态。

环境检查项：
- Node、pnpm 版本与路径。
- uv 版本与路径。
- ffmpeg、ffprobe 版本、路径、可用性。
- Chrome 可执行路径（chrome.mjs 同一套探测逻辑）。
- Python：uv 可用即可，解释器按脚本头隔离创建。
- 依赖目录：`node_modules`、`studio/tts/.venv`、`studio/bin` 二进制是否就位。

每项返回：`{ key, label, ok, version, path, hint }`，`hint` 给缺失时的补装提示。

### 模板
- `GET /api/templates`：锁清单加本地目录，返回模板卡片列表：id、名称、版本、来源类型、许可、运行时、本地是否就位。
- `GET /api/templates/:id`：详情，读 `motion.json`、`motion.lock.json`、licenses、参数概要、文件树。
- `POST /api/templates/import`：接收拖拽上传的 .motion 文件（multipart 或本地文件路径），扫描凭据、解析清单、解压到缓存目录、写锁清单。返回解析出的元数据和校验结果。
- `GET /api/templates/:id/redirect`：返回原站页面地址，用于跳转登录下载，工具本身不下载受门禁包。

### 视频条目
- `GET /api/videos`：条目列表，每条列 input、instance、output、preview 状态和产物文件。
- `GET /api/videos/:id`：详情，读 `user.json` 字段（标题、场景、文案、字幕、媒体引用），素材清单，图片尺寸，音视频用 ffprobe 读时长/编码/声道/码率。

### TTS
- `GET /api/tts/samples`：试音样例清单，读 `samples.json`，返回文件名、音色标签、音频可回显地址。
- `GET /api/tts/segments`：分段清单，读 `segments.json`，返回段落窗、台词、词边界、音频地址。

### 静态资源
- `GET /api/assets?path=<相对路径>`：回显图片、音频、视频、预览图。允许目录：studio/templates 静态素材、studio/public、studio/videos 条目素材与产物、studio/tts/samples、studio/tts/segments。禁止访问 `.env`、密钥、上级目录。

一期不提供任何 execute / spawn 类接口。

## 五、前端页面（Vue3 + Vite + TS）

技术栈：Vue3、Vite、TypeScript、VueUse、Naive UI、UnoCSS、lodash-es。

页面划分：
1. 仪表盘 `/`：环境状态红绿一览、最近视频条目、快捷入口。
2. 模板 `/templates`：模板卡片，来源、版本、许可、运行时、就位状态；点进详情看参数和文件树。
3. 视频 `/videos`：条目列表，详情页看文案、字幕、素材预览、预览图、成片播放。
4. TTS `/tts`：样例试听、分段台词与词边界查看。
5. 环境 `/environment`：逐项版本、路径、可用性、补装提示。

数据层：后端 JSON 接口封装成 composable；类型按接口响应定义 TS 类型，方便后续 AI 改代码时不猜错字段。

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
