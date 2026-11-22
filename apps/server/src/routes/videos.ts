import type { FastifyInstance } from 'fastify';
import { listVideos, getVideo } from '../services/videos.js';
import { notFound } from '../core/errors.js';
import { ok, list } from '../core/response.js';
import { envelope, listEnvelope, errorStatuses, idParam, type JsonSchema } from '../core/schemas.js';

const videoSummary: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    duration: { type: ['number', 'null'], description: '时长（秒）' },
    layout: { type: ['string', 'null'], description: '横竖屏布局' },
    sceneCount: { type: 'integer' },
    captionCount: { type: 'integer' },
    videoCount: { type: 'integer' },
    instanceCount: { type: 'integer' },
    preview: {
      type: ['object', 'null'],
      additionalProperties: true,
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        rel: { type: 'string' },
        url: { type: 'string' },
      },
    },
  },
};

const mediaRef: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    role: { type: 'string' },
    file: { type: 'string' },
    type: { type: 'string' },
    exists: { type: 'boolean' },
    url: { type: ['string', 'null'] },
  },
};

const artifact: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    rel: { type: 'string' },
    url: { type: 'string' },
    probe: { type: ['object', 'null'], additionalProperties: true },
  },
};

const videoDetail: JsonSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    inputFile: { type: 'string', description: '相对工程根的输入文件路径' },
    meta: { type: 'object', additionalProperties: true, description: '渲染输入 user.json 原字段' },
    mediaRefs: { type: 'array', items: mediaRef },
    extraAssets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          rel: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    artifacts: { type: 'array', items: artifact },
    instanceDirs: { type: 'array', items: { type: 'string' } },
  },
};

type IdParams = { id: string };

export function registerVideos(app: FastifyInstance, prefix: string): void {
  app.get(`${prefix}/videos`, {
    schema: {
      tags: ['videos'],
      summary: '视频条目列表',
      response: { 200: listEnvelope(videoSummary), ...errorStatuses },
    },
  }, async () => list(await listVideos()));

  app.get(`${prefix}/videos/:id`, {
    schema: {
      tags: ['videos'],
      summary: '视频条目详情：工程信息、引用素材、字幕、分段与产物探测结果',
      params: idParam,
      response: { 200: envelope(videoDetail), ...errorStatuses },
    },
  }, async (request) => {
    const { id } = request.params as IdParams;
    const video = await getVideo(id);
    if (!video) throw notFound('条目不存在');
    return ok(video);
  });
}
