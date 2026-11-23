# MotionGit 模板目录与素材 / 台词 / 音频 / 成片放置约定（对照官方）

> 目的：分清哪些目录与放置规则是官方既定契约，哪些只是本平台面板的收纳层；跨模板兼容时以模板自身契约为准，不自创固定目录约定。
> 证据来源：公开格式规范 `https://motiongit.com/spec`；各模板包内 `00-START-HERE.md`、`README.md`、`CREATION.md`、`motion.json`、`params.schema.json`、`core/catalog.json`；云端包 `assistant/guide.json`。

## 一、官方既定约定

### 1. 模板包内部（只读，解压目录）

- 根 `motion.json`：模板身份、运行时入口、参数引用、输出规格（画幅 / 帧率 / 时长策略）。
- `README.md` / `SKILL.md` / `guide.json`：人与助手指引；`params.schema.json`：可替换内容的 JSON Schema；`motion.lock.json`：依赖版本与测试环境；`asset-manifest.json`：素材 / 字体来源、哈希与许可；`src/`、`assets/`、`presets/`、`previews/`、`licenses/`。
- 权限边界（`motion.json.permissions`）：模板只读 `package` 与 `instance-inputs`，只写 `instance-output`。受保护的 `personal/`、`content/`、`release.bin`、`core.enc` 不展开、不修改、不复制进交付目录。

### 2. 输入：参数契约是唯一绑定入口

- **官方不规定统一的「素材文件夹名」。** 素材是否被使用，看参数对象里的角色槽绑定，不看它被收纳在哪个文件夹。
- 素材角色分类（spec 第 6 节）：

  | 类别 | 角色 |
  | --- | --- |
  | 视频 | `video.presenter`、`video.footage`、`video.screen` |
  | 图片 | `image.photo`、`image.product`、`image.logo`、`image.screenshot` |
  | 音频 | `audio.voiceover`（旁白）、`audio.music`（配乐） |
  | 文本 | `text.subtitles`、`text.script`、`text.facts` |
  | 自定义 | 当前 guide 角色用 `x-` 前缀 |

- 本机适配器（`adapter.py`）：入参是模板 runner 外部工程目录里的 `user.json`（按 `params.schema.json`）。素材路径写在 `media.<role>.file`，相对输入目录且不得逃逸到输入目录之外；`voice` / `music` 同样按槽绑定，配乐需显式 `license` 字段。
- 云端包（`assistant/motion.mjs`）：`new <original.motion>` 返回私有 canonical 实例目录；params、media、plans、projects、rendering 都放在该实例内，相对输出路径在其中解析。具体输入槽以 `contract <workflow> <control>` 返回的公开 schema 为准——受保护包内不暴露固定 schema。

### 3. 产物：输入与输出分离

- 本机适配器命令链：`doctor → check-params → plan → prepare → preview → render`。
  - `plan.json`、`instance/`（prepare 拷贝 core 与 `user-assets/<role>/`）、`preview.png`、`silent.mp4`，最终 `silent-with-audio.mp4`。
  - 输入与产物放在模板 runner 之外的独立可写实例 / 工程目录；模板包目录保持只读。
- 云端包：文件、回执、实际规格留在新生产实例内；核验成片后，只把成片与公开制作记录拷到用户指定交付目录；任务所属临时工作区可清理；受保护代码不复制进交付目录。
- 本机最终成片以 `-with-audio.mp4` 结束。

### 4. 兼容不同模板的原则

- 入参槽位、字段容量、时长策略、画幅，以所选模板自己的 `params.schema.json` / `guide.json` / `catalog.json` / 运行时 contract 为准。面板不写死「素材必须放某固定目录」这类跨模板约定。
- 模板缺某角色槽时，对应素材不强行绑定；收纳在目录里但未写进参数槽的文件，不算已使用素材。

## 二、本平台现状（studio/ 收纳层，不是模板输入契约）

| 本平台路径 | 性质 | 对应官方概念 | 备注 |
| --- | --- | --- | --- |
| `studio/templates/<id>` | 模板落地目录 | 模板包（只读） | 跟随官方包结构 |
| `studio/projects/<id>/project.json` | 面板台账 | 无（面板自加） | 项目元数据、状态、任务号 |
| `input/script.txt` | 面板留存的口播全文 | `text.script` | 供面板轻编辑；真正进模板的是参数槽 |
| `input/user.json` | 本机模板入参文件 | 官方入参参数对象 | 位置在项目 input 下，属本平台收纳 |
| `input/assets/` | 素材归集目录 | 无固定目录 | 面板归集地；绑定与否看 `user.json` 槽位 |
| `input/voice.mp3`、`voice.json` | 本机 TTS 旁白产物 | `audio.voiceover` | 路径自创；尚未绑定进渲染输入 |
| `input/studio-config.json` | 素材顺序 / 音色偏好台账 | 无（面板自加） | 不进模板严格校验 |
| `instance/`、`instance-N/`、`instance-quote/` | prepare / 云端 new 实例 | 官方 instance | 命名后缀为本平台加 |
| `output/` | 成片、封面、`publish.json/txt` 归集 | 官方成片 + 面板发布配置 | `publish` 概念为本平台作品页自加 |
| `run.log`、`*.mp4.json` | 任务 / 产物台账 | 无（面板自加） | |
| `studio/tts/samples` | 音色试听样例库 | 无（面板自加） | |
| `studio/videos` | 旧链路产物 | 待下线 | 历史遗留，下线范围另立步骤 |

## 三、待复核 / 调整项

- `input/assets` 作为归集地可保留，但不得在提示词或后端被写死为模板唯一素材目录；跨模板素材绑定应读模板槽位。
- 旁白若要进入渲染，应按模板 `audio.voiceover` 槽位写进参数对象，而不是靠固定文件名约定。
- 旧 `studio/videos`、`studio/tts/segments` 属旧链路，下线范围另立步骤。

## 四、同类参照：阿杜导演开源与 MEP 协议

> 参照对象：阿杜导演桌面版（adudir.com，闭源内测）；其开源组织 `adunext` 公开了格式说明、剪辑器框架示例与协议。本面板定位是其只读观测台的简化网页版。

### 可查到的开源资料（GitHub `adunext`）

| 仓库 | 内容 |
| --- | --- |
| `adudir-open` | .motion 格式说明、代码式剪辑器框架与一个模板结构示例（MIT） |
| `mep` | Motion Edit Protocol：让 AI 助手与软件协作的文件式开放协议（`mep/1`） |
| `motiongit-skill` | 把已完成视频工程提炼打包成 .motion 模板的官方 Skill |
| `adu-motion-video` | 阿杜系列模板与创作 Skill |

桌面端 App 本体未开源，以下功能与规划来自官网、开源文档与模板示例。

### 阿杜工程目录规划（开源 `motion-format.md` 第 8 节）

从模板新建的工程是一个普通文件夹，保存时打成 ZIP：

| 文件 | 内容 |
| --- | --- |
| `motion.json` | 工程名、版本、修订号、来自哪个模板 |
| `composition.html` | 整部片子的剪辑：轨道、片段引用、时间点、大小位置、参数、转场、音量 |
| `*.html` | 动效页面 |
| `cues.json` | 时间线线索点命名 |
| `*.vtt` | 字幕 |
| `assets/` | 素材、配音、音乐、音效（同一目录归集，按引用绑定） |

要点：素材只被引用、不被改动，片段记录「原文件第几秒到第几秒」，同一文件可被多片段引用；字幕 `.vtt` 放在对应配音或素材旁边；模板 `assets/` 自带素材由 `asset-manifest.json` 登记来源与许可。

### MEP 协作模式（与本面板定位对照）

- 软件把工程开放成一个文件夹：助手读文件了解工程、写文件提交修改，软件校验后执行并写回执。
- 每单带版本号，不覆盖用户新修改；每单有回执，可整单撤销。
- 助手可请软件把成片某几秒画出来自检，再交回核对。
- 对照本面板：观测台只做读取盘点与纯文本轻编辑；重动作以提示词交外部 AI 落盘，与 MEP「助手读写工程文件、软件按确定规则执行」的方向一致，但本面板暂不实现写回校验与撤销回执。

### 阿杜功能清单（参照，非本面板承诺）

选题 → 脚本 → 素材 → 出片 → 发布；模板中心海报墙、悬停预览、一键带入新创作；批量排产工作台；复制命令交给自带 AI 助手；样例图与超容文字只提醒不拦截；画面改字、参数面板调色、拖图替换样例；每一步可撤回。
