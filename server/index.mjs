import http from 'node:http';
import { URL } from 'node:url';
import { collectEnvironment } from './env.mjs';
import { listTemplates, getTemplate } from './templates.mjs';
import { listVideos, getVideo } from './videos.mjs';
import { listSamples, listSegments } from './tts.mjs';
import { serveAsset } from './assets.mjs';

const PORT = Number(process.env.PORT || 5199);
const HOST = '127.0.0.1';

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function handleApi(req, res, pathname, query) {
  const seg = pathname.split('/').filter(Boolean); // ['api', ...]

  if (req.method !== 'GET') return sendJson(res, 405, { error: '仅支持 GET（一期只读）' });

  switch (seg[1]) {
    case 'health':
      return sendJson(res, 200, { ok: true, service: 'ai-motion-studio', time: Date.now() });

    case 'environment':
      return sendJson(res, 200, await collectEnvironment());

    case 'templates': {
      if (seg[2] && seg[3] === 'redirect') {
        const tpl = getTemplate(seg[2]);
        if (!tpl) return sendJson(res, 404, { error: '模板不存在' });
        const source = tpl.extensions?.['motiongit.com:open-source']?.repository || null;
        return sendJson(res, 200, { id: tpl.id, redirectUrl: source });
      }
      if (seg[2]) {
        const tpl = getTemplate(seg[2]);
        return tpl ? sendJson(res, 200, tpl) : sendJson(res, 404, { error: '模板不存在' });
      }
      return sendJson(res, 200, { items: listTemplates() });
    }

    case 'videos': {
      if (seg[2]) {
        const video = await getVideo(seg[2]);
        return video ? sendJson(res, 200, video) : sendJson(res, 404, { error: '条目不存在' });
      }
      return sendJson(res, 200, { items: await listVideos() });
    }

    case 'tts': {
      if (seg[2] === 'samples') return sendJson(res, 200, { items: listSamples() });
      if (seg[2] === 'segments') return sendJson(res, 200, { items: listSegments() });
      return sendJson(res, 404, { error: '未知 TTS 接口' });
    }

    case 'assets':
      return serveAsset(res, query.get('path') || '');

    default:
      return sendJson(res, 404, { error: '未知接口' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname, url.searchParams).catch((e) => {
      sendJson(res, 500, { error: e.message || '服务内部错误' });
    });
  } else {
    sendJson(res, 404, { error: '前端请通过 Vite 开发服务器访问' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[ai-motion-studio] 后端已启动: http://${HOST}:${PORT}`);
});
