# 提示词与路径口径（外部 AI 接入约定）

> 对应 roadmap #185。目录规划、路径约定、后端接入口径以本文为单一来源；项目/素材/模板引用只给编号或相对路径，提示词里不再复制绝对路径和 URL 转码串。外部 AI 动手前先读本文与 `observatory/context` 快照，不重复探测环境。

## 一、目录规划（相对工程根）

| 目录 | 职责 | 典型内容 |
| --- | --- | --- |
| `studio/projects/<id>/input/` | 项目输入与中间产物 | `script.txt` 文稿、`user.json` 渲染入参、`assets/` 项目素材、`voice.mp3` 配音、`voice.json` 音色时长、`studio-config.json` 素材与音色登记、字幕条/vtt |
| `studio/projects/<id>/output/` | 项目成品产物 | 成片 mp4、横竖封面、`publish.txt`/`publish.json` |
| `studio/projects/<id>/instance-*` | 渲染中间实例 | 模板渲染缓存，不进素材清单，不手工引用 |
| `studio/templates/<id>` | 导入的模板包 | 只读；含入口、schema、许可与文件树 |
| `studio/tts/samples/` | 公共音色试听样例 | 登记为 public 的样例才算可复用素材 |
| `studio/tts/segments/` | 配音分段缓存 | 中间产物，不进素材库 |
| `studio/assets/` | 公共素材（规划） | 跨项目复用的图片、视频、BGM |

input/output 归类细节见 [assets-classification.md](./assets-classification.md)；发布配置与渲染入参的职责边界见 [publish-schema.md](./publish-schema.md)。

## 二、路径约定

- 所有引用一律用相对工程根的正斜杠路径，例：`studio/projects/<id>/input/assets/cover.png`。
- 不给本机绝对路径（`/Volumes/...`）、不带 `file://`、不在提示词里粘贴 URL 编码后的中文目录串。
- 项目用项目 `id` 引用；模板用模板 `id` 与版本；素材给 `input/assets/` 下相对文件名。
- 写新文件先落对应目录；临时脚本与探索产物入 `.tmp/`，任务结束清理。

## 三、后端接入口径

- 基址：`http://127.0.0.1:5599/api/v1`；先拉 `GET /observatory/context` 一次性取环境就位、模板槽位、项目台账、素材与音色盘点。
- 鉴权：配置了 `ACCESS_KEY` 时请求头带 `x-access-key: <key>`；未配置则不带。
- 命令任务：`POST /jobs`，body `{ "command": "<白名单命令>", "params": {...} }`；参数里的路径必须相对工程根，拒绝绝对路径与 `..`。任务状态与日志可订阅 `GET /jobs/stream`（SSE，连接回任务表快照，随后推 `job`/`log` 事件）；REST 增量日志仍保留作补偿。
- 运行配置：`GET /config` 取监听地址、鉴权是否启用、读取/可写白名单目录与任务限额，不必猜端口与目录口径。
- 文本读写：`GET /files/text?path=<rel>` 读取；`PUT /files/text` 覆写（JSON 须可 parse，纯文本原文覆盖不 trim）。
- 盘点只读：`GET /projects`、`GET /observatory/assets`、`GET /observatory/activity`；项目详情用 `/projects/:id`、`/projects/:id/files`、`/projects/:id/steps`。
- 文件变动由后端 SSE `/events` 按域推送；面板只在对应域变化时重拉，外部 AI 不需要轮询目录。

## 四、写回约定

- 素材落 `input/assets/` 后，在 `input/studio-config.json` 的 `assets` 数组登记相对路径与类型。
- 配音落 `input/voice.mp3`，音色与时长记 `input/voice.json`；字幕时间码按语音词边界回写。
- 成片产出到 `output/` 后，把相对路径回写 `project.json` 的 `artifactRel`。
- 不改职责边界：调发布文案只动 `publish.json`；改分镜、素材、字幕只动 `user.json` 与输入目录。
- 归类有歧义的文件先按项目归属处理，登记为公共后再进全局素材库。
