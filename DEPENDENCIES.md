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
- 声明文件：`template/package.json`
- 依赖：playwright-core 1.64.0
- 安装：在 `template/` 目录执行 `npm ci`

### Python 渲染依赖
- 声明位置：`template/adapter.py` 顶部 PEP 723 脚本头
- 依赖：numpy、scipy、soundfile、pyloudnorm、jsonschema
- 安装：无需手动建环境，`uv run adapter.py ...` 会自动创建隔离环境并装齐

### Python TTS 依赖
- 声明位置：`tts/make_voice.py` 顶部 PEP 723 脚本头
- 依赖：edge-tts==7.3.1
- 运行：可用 `uv run tts/make_voice.py`，或在 `tts/.venv` 独立虚拟环境中安装

## 三、本地工具二进制（bin/，不入库）

工具统一放到工程根的 `bin/` 目录；脚本优先从 PATH 查找，找不到再回退工程根 `bin/`。

### uv
- 来源：GitHub `astral-sh/uv` releases
- Mac arm64：`uv-aarch64-apple-darwin.tar.gz`
- Windows x64：`uv-x86_64-pc-windows-msvc.zip`
- 解压取 `uv`（和 `uvx`）放入 `bin/`，加可执行权限

### ffmpeg
- Mac arm64 实测来源：GitHub `imageio/imageio-ffmpeg` release v0.8.1
  - wheel：`imageio_ffmpeg-0.8.1-py3-none-macosx_12_0_arm64.whl`
  - 解包后取 `imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0`，改名 `ffmpeg` 放入 `bin/`
- Windows x64：使用新版 git 每日构建（实测 N-129000-g64f6bcffaf-20261117），需带 libx264
- 两端 ffmpeg 版本不必完全一致，但都要满足上面的新版要求

### ffprobe
- Mac arm64 实测来源：GitHub `eugeneware/ffmpeg-static` release b6.1.1
  - 资产：`ffprobe-darwin-arm64`，改名 `ffprobe` 放入 `bin/`
- Windows x64：随 ffmpeg 同一构建包提供

## 四、渲染命令链

在 `template/` 目录下执行，`bin/` 需在 PATH 中：

```sh
npm ci

uv run adapter.py plan    --input ../my-video/input/user.json --out ../my-video/plan.json
uv run adapter.py prepare --input ../my-video/input/user.json --out ../my-video/instance
uv run adapter.py preview --instance ../my-video/instance --out ../my-video/preview.png --time 2
uv run adapter.py render  --instance ../my-video/instance --out ../my-video/silent.mp4
```

render 会自动调用 `mix.py` 混音，最终产出 `silent-with-audio.mp4`。

## 五、入库边界（详见 .gitignore）

入库：模板源码、配置、schema、文档、tts 脚本、词边界清单、小体积试音样例、模板自带静态素材。

不入库：
- `node_modules/`、`.venv/`、`__pycache__/`
- `bin/` 工具二进制
- `my-video/` 成片、实例、抽帧、预览和输入素材
- `bgm/` 音乐素材
- `tts/segments/` 下的 mp3、vtt 配音产物（`segments.json` 词边界清单保留）
- 系统文件、日志、IDE 配置、`.env`

## 六、跨端约定

- 脚本内路径全部相对工程根，用 `Path(__file__)` 解析，不写死盘符或绝对路径。
- `tts/segments/segments.json` 由 `make_voice.py` 生成；重新合成配音时会按脚本内 SEGMENTS 刷新。
- 文案与时间窗以第四版为准：B1 0.0–8.0，B2 8.0–16.2，B3 16.2–25.8，B4 25.8–35.0，结尾 C1 31.8–35.0。
