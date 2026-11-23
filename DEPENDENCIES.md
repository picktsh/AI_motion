# 依赖与工具复现说明

本文件记录工程在一台新机器上重建所需的运行环境、依赖声明位置和工具获取来源。
二进制工具不入库，按下面的说明自备；代码和文本配置通过 git 同步。

## 一、运行环境

| 组件 | 要求 | 本机实测（Mac arm64） |
| --- | --- | --- |
| Node.js | 22+ | v22.23.2，npm 10.9.8 |
| Python（渲染链路） | 3.11+ | 由 uv 按 adapter.py 脚本头自动拉取，不依赖系统 Python |
| Python（TTS 脚本） | 3.10+ | 由 uv 按 make_voice.py 脚本头自动拉取 |
| uv | 0.13.9 | 0.13.9 aarch64-apple-darwin |
| ffmpeg | 较新版本，scale 滤镜需支持 in_primaries / in_transfer / in_range | 9.0 arm64 |
| ffprobe | 任意现代版本，基础流信息探测即可 | 6.0 arm64 |
| 浏览器 | 系统安装的 Chrome（playwright-core 连接系统 Chrome，不自带内核） | Google Chrome |

注意：ffmpeg 不能用 6.0 及以下的老版本。老版本 scale 滤镜没有上述色彩选项，渲染阶段会报
“Option not found”并导致管道中断。

## 二、依赖声明位置（可二次下载，不入库）

### Node 依赖
- 声明文件：`studio/template/package.json`
- 依赖：playwright-core 1.64.0
- 安装：在 `studio/template/` 目录执行 `npm ci`

### Python 渲染依赖
- 声明位置：`studio/template/adapter.py` 顶部 PEP 723 脚本头
- 依赖：numpy、scipy、soundfile、pyloudnorm、jsonschema
- 安装：无需手动建环境，`uv run adapter.py ...` 会自动创建隔离环境并装齐

### Python TTS 依赖
- 声明位置：`apps/server/python/make_voice.py` 顶部 PEP 723 脚本头
- 依赖：edge-tts==7.3.1
- 运行：可用 `uv run apps/server/python/make_voice.py`（走脚本头 PEP723 临时环境，无需预建）
- 预热/离线：工程根执行 `pnpm setup:python`（= `uv sync --project apps/server/python`），在 `apps/server/python/.venv` 建持久环境，供环境页检测与离线运行

## 三、本地工具二进制（apps/server/vendor/，不入库）

工具统一存放在 `apps/server/vendor/`（不入库）；脚本优先从 PATH 查找，找不到再回退该目录。

### 自动安装（推荐，`pnpm install` 即触发）
`pnpm install` 时 `apps/server` 的 `postinstall` 会跑 `scripts/setup-bin.mjs`，把二进制准备到 `apps/server/vendor/`：
- ffmpeg / ffprobe：取自依赖 `ffmpeg-static` / `ffprobe-static`（两包自身 postinstall 按平台下载，已在 `pnpm-workspace.yaml` 的 `allowBuilds` 放行），再硬链/拷贝进 vendor；
- uv / uvx：astral 无官方 npm 包，脚本按平台从其 GitHub release 下载解压（版本由 `UV_VERSION` 锁定，默认 0.13.9）。

护栏：幂等（已存在即跳过）、失败仅告警不阻断安装（由环境页兑底暴露缺失）。开关：`SKIP_BIN_DOWNLOAD=1` 全部关闭；`UV_MIRROR` / `FFMPEG_BINARIES_URL` 配镜像。下面手动获取仅用于离线/下载失败的回退。

> ⚠️ ffmpeg 版本命门：`ffmpeg-static` 捆绑版本偏旧（约 6.x），能否跑通 `.motion` 模板渲染需 mac + win 各真机验证一次；不足时提高锁定版本或改用下面手动来源。

### uv
- 来源：GitHub `astral-sh/uv` releases
- Mac arm64：`uv-aarch64-apple-darwin.tar.gz`
- Windows x64：`uv-x86_64-pc-windows-msvc.zip`
- 解压取 `uv`（和 `uvx`）放入 `apps/server/vendor/`，加可执行权限

### ffmpeg
- 版本口径：ffmpeg 的需求下限取决于导入的 `.motion` 模板用到哪些滤镜/参数（模板若使用 `scale` 的 `in_primaries/in_transfer/in_range` 等新色彩参数则需较新版本）；并非固定版本号。
- 优先平台自带（推荐）：macOS `brew install ffmpeg`、Windows `winget install Gyan.FFmpeg`；脚本会从 PATH 自动命中，无特殊需要就不必把二进制放进 `apps/server/vendor/`。下面的手动下载仅用于“不依赖系统、可复现”场景。
- Mac arm64 实测来源：GitHub `imageio/imageio-ffmpeg` release v0.8.1
  - wheel：`imageio_ffmpeg-0.8.1-py3-none-macosx_12_0_arm64.whl`
  - 解包后取 `imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0`，改名 `ffmpeg` 放入 `apps/server/vendor/`
- Windows x64：使用新版 git 每日构建（实测 N-129000-g64f6bcffaf-20261117），需带 libx264
- 两端 ffmpeg 版本不必完全一致，但都要满足上面的新版要求

### ffprobe
- Mac arm64 实测来源：GitHub `eugeneware/ffmpeg-static` release b6.1.1
  - 资产：`ffprobe-darwin-arm64`，改名 `ffprobe` 放入 `apps/server/vendor/`
- Windows x64：随 ffmpeg 同一构建包提供

## 四、渲染命令链

在 `studio/template/` 目录下执行，`apps/server/vendor/` 需在 PATH 中：

```sh
npm ci

uv run adapter.py plan    --input ../videos/input/user.json --out ../videos/plan.json
uv run adapter.py prepare --input ../videos/input/user.json --out ../videos/instance
uv run adapter.py preview --instance ../videos/instance --out ../videos/preview.png --time 2
uv run adapter.py render  --instance ../videos/instance --out ../videos/silent.mp4
```

render 会自动调用 `mix.py` 混音，最终产出 `silent-with-audio.mp4`。

## 五、入库边界（详见 .gitignore）

入库：模板源码、配置、schema、文档、tts 脚本、词边界清单、小体积试音样例、模板自带静态素材。

不入库：
- `node_modules/`、`.venv/`、`__pycache__/`
- `apps/server/vendor/` 工具二进制
- `studio/videos/` 成片、实例、抽帧、预览和输入素材
- `studio/bgm/` 音乐素材
- `studio/tts/segments/` 下的 mp3、vtt 配音产物（`segments.json` 词边界清单保留）
- 系统文件、日志、IDE 配置；`.env.local`、`.env.*.local` 等本地环境覆盖文件（`.env` 默认值入库）

## 六、跨端约定

- 脚本内路径全部相对工程根：由服务端注入 `PROJECT_ROOT` 环境变量，脚本据此定位 `studio/` 素材与 `apps/server/vendor/`，回退按 `Path(__file__)` 层级回溯；不写死盘符或绝对路径。
- `studio/tts/segments/segments.json` 由 `make_voice.py` 生成；重新合成配音时会按脚本内 SEGMENTS 刷新。
- 文案与时间窗以第四版为准：B1 0.0–8.0，B2 8.0–16.2，B3 16.2–25.8，B4 25.8–35.0，结尾 C1 31.8–35.0。
