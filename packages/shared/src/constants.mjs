// 前后端共享的运行时常量；具体环境覆盖由各自配置层读取。

/** 接口协议版本，不兼容变更时递增。 */
export const PROTOCOL_VERSION = '1.0.0';

/** 接口路径版本段。 */
export const API_VERSION = 'v1';

/** 默认接口前缀，可被环境变量覆盖。 */
export const DEFAULT_API_PREFIX = `/api/${API_VERSION}`;

/** 服务名。 */
export const SERVICE_NAME = 'ai-motion-studio';
