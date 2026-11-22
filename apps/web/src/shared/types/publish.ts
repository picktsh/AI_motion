/** 作品发布配置（独立 publish.json，与渲染输入 user.json 解耦；结构对多平台通用） */
export interface PublishCoverSet {
  horizontal?: string;
  vertical?: string;
}

export interface PublishConfig {
  /** 发布标题 */
  title?: string;
  /** 正文文案 */
  body?: string;
  /** 话题标签（不含 # 前缀亦可，展示时补 #） */
  hashtags?: string[];
  /** 横屏 / 竖屏封面文件名或相对路径 */
  covers?: PublishCoverSet;
  /** 备注与发布注意事项 */
  notes?: string;
  /** 目标平台预留标识，默认按通用结构呈现 */
  platform?: string;
}
