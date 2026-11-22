// 统一错误类型、机器可读错误码与错误处理器收口。
import type { FastifyInstance } from 'fastify';
import { ErrorCode } from '@ai-motion/shared/errors';

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const FALLBACK_MESSAGE = '服务内部错误';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCodeValue, message?: string, details?: unknown) {
    super(message || FALLBACK_MESSAGE);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message?: string, details?: unknown) =>
  new AppError(400, ErrorCode.INVALID_PARAMETER, message, details);
export const forbidden = (message?: string, details?: unknown) =>
  new AppError(403, ErrorCode.PATH_OUT_OF_SCOPE, message, details);
export const notFound = (message?: string, details?: unknown) =>
  new AppError(404, ErrorCode.RESOURCE_NOT_FOUND, message, details);
export const conflict = (message?: string, details?: unknown) =>
  new AppError(409, ErrorCode.INVALID_PARAMETER, message, details);
export const unauthorized = (message?: string, details?: unknown) =>
  new AppError(401, ErrorCode.UNAUTHORIZED, message, details);

interface ErrorBody {
  ok: false;
  error: { code: ErrorCodeValue; message: string; details?: unknown };
}

function errorBody(code: ErrorCodeValue, message: string, details?: unknown): ErrorBody {
  const body: ErrorBody = { ok: false, error: { code, message } };
  if (details && Object.keys(details).length > 0) body.error.details = details;
  return body;
}

// 把各类异常收敛成统一错误体；内部堆栈不外泄给前端。
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    const err = error as { statusCode?: number; validation?: unknown };
    if (err.statusCode === 405) {
      return reply.status(405).send(errorBody(ErrorCode.METHOD_NOT_ALLOWED, '请求方法不被允许'));
    }
    if (err.validation) {
      return reply.status(400).send(errorBody(ErrorCode.INVALID_PARAMETER, '请求参数校验未通过', err.validation));
    }
    request.log.error(error);
    return reply.status(500).send(errorBody(ErrorCode.INTERNAL, FALLBACK_MESSAGE));
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET') {
      return reply.status(405).send(errorBody(ErrorCode.METHOD_NOT_ALLOWED, '请求方法不被允许'));
    }
    reply.status(404).send(errorBody(ErrorCode.RESOURCE_NOT_FOUND, '接口不存在'));
  });
}
