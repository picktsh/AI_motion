# AGENTS.local.md

项目特有约定（团队共享并提交；上游契约见根 AGENTS.md，勿手改）。

- 目录与路径口径、后端接入口径以 `docs/prompt-conventions.md` 为准；引用只给编号或相对路径，不给绝对路径与转码串。
- 素材 input/output 归类口径见 `docs/assets-classification.md`；发布配置与渲染入参边界见 `docs/publish-schema.md`。
- 前端：Naive UI 按需引入，静态表 `NTable`、业务表 `NDataTable`；错误提示用 NMessage 或输入框标红，不写内联 Alert；主题色走 n-config-provider，不硬编码色值；setup 外弹窗用 createDiscreteApi。
- 后端任务参数路径必须相对工程根，拒绝绝对路径与 `..`；文本写入走 `/files/text`，JSON 须可 parse。
