import { listSamples, listSegments } from '../tts.mjs';
import { notFound } from '../errors.mjs';
import { list } from '../response.mjs';
import { listEnvelope, errorStatuses } from '../schemas.mjs';

const sample = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    file: { type: 'string' },
    voice: { type: 'string', description: '音色标识' },
    label: { type: 'string' },
    style: { type: 'string' },
    text: { type: 'string' },
    rate: { type: 'string' },
    pitch: { type: 'string' },
    duration_s: { type: 'number', description: '时长（秒）' },
    exists: { type: 'boolean' },
    url: { type: ['string', 'null'] },
  },
};

const wordBound = {
  type: 'object',
  additionalProperties: true,
  properties: {
    text: { type: 'string' },
    start: { type: 'number' },
    end: { type: 'number' },
  },
};

const segment = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    windowStart: { type: 'number' },
    windowEnd: { type: 'number' },
    text: { type: 'string' },
    audio: { type: 'string' },
    exists: { type: 'boolean' },
    url: { type: ['string', 'null'] },
    bounds: { type: 'array', items: wordBound },
  },
};

export function registerTts(app, prefix) {
  app.get(`${prefix}/tts/samples`, {
    schema: {
      tags: ['tts'],
      summary: '音色试音样例清单',
      response: { 200: listEnvelope(sample), ...errorStatuses },
    },
  }, () => list(listSamples()));

  app.get(`${prefix}/tts/segments`, {
    schema: {
      tags: ['tts'],
      summary: '配音分段与词边界清单',
      response: { 200: listEnvelope(segment), ...errorStatuses },
    },
  }, () => list(listSegments()));

  // 兜底：未匹配的 TTS 子路径；不在 OpenAPI 文档中展示。
  app.get(`${prefix}/tts/:unknown`, {
    schema: { hide: true, response: { 404: errorStatuses[404] } },
  }, () => {
    throw notFound('未知 TTS 接口');
  });
}
