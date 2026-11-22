// 运行配置：读取环境变量并给缺省值；业务代码不从裸环境变量取配置。
const DEFAULTS = {
  host: '127.0.0.1',
  port: 5199,
  apiPrefix: '/api/v1',
  service: 'ai-motion-studio',
};

function readPort(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULTS.port;
}

export const config = {
  host: process.env.HOST || DEFAULTS.host,
  port: readPort(process.env.PORT),
  apiPrefix: (process.env.API_PREFIX || DEFAULTS.apiPrefix).replace(/\/+$/, ''),
  service: process.env.SERVICE_NAME || DEFAULTS.service,
};
