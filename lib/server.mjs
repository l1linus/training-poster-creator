import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'],
]);

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function sendText(response, status, text, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { ...BASE_HEADERS, 'content-type': type, 'content-length': Buffer.byteLength(text) });
  response.end(text);
}

/**
 * 起一个只读静态服务: 托管构建后的海报应用, 并在 /__job.json 暴露本次渲染数据。
 * 默认只监听 127.0.0.1 的随机端口。
 */
export function startServer({ root, job = null, host = '127.0.0.1', port = 0, indexFile = 'index.html' }) {
  const rootDir = path.resolve(root);
  const indexPath = path.join(rootDir, indexFile);
  if (!existsSync(indexPath)) {
    throw new Error(`静态资源目录不完整: ${indexPath} 不存在`);
  }

  const server = http.createServer((request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendText(response, 405, 'Method Not Allowed');
        return;
      }

      const url = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (url.pathname === '/__job.json') {
        const body = JSON.stringify(job ?? null);
        response.writeHead(200, {
          ...BASE_HEADERS,
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(body),
        });
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      }

      if (url.pathname === '/__health') {
        sendText(response, 200, '{"ok":true}', 'application/json; charset=utf-8');
        return;
      }

      let decoded;
      try {
        decoded = decodeURIComponent(url.pathname);
      } catch {
        sendText(response, 400, 'Bad Request');
        return;
      }
      if (decoded.startsWith('/api/') || decoded.startsWith('/runtime/') || decoded.startsWith('/spark/') || decoded.includes('{')) {
        // 平台的接口在本地不存在, 返回 JSON 404 而不是回退成 HTML
        sendText(response, 404, '{"error":"not available in local renderer"}', 'application/json; charset=utf-8');
        return;
      }

      let filePath = path.resolve(rootDir, `.${decoded}`);
      const insideRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);
      if (!insideRoot) {
        sendText(response, 403, 'Forbidden');
        return;
      }

      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        // 静态资源缺失返回 404, 页面路由回退到 index.html(SPA)
        if (path.extname(filePath)) {
          sendText(response, 404, 'Not Found');
          return;
        }
        filePath = indexPath;
      }

      const extension = path.extname(filePath).toLowerCase();
      const type = MIME.get(extension) ?? 'application/octet-stream';

      const size = statSync(filePath).size;
      response.writeHead(200, { ...BASE_HEADERS, 'content-type': type, 'content-length': size });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const stream = createReadStream(filePath);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendText(response, 500, `Internal Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({ server, host, port: typeof address === 'object' && address ? address.port : port });
    });
  });
}

export function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    // 截图后浏览器可能还留着 keep-alive 连接, 主动断开避免 server.close 卡住
    server.closeAllConnections?.();
    server.close(() => resolve());
    // 兜底: 3 秒后强制放行, 但不拖住进程退出
    setTimeout(resolve, 3000).unref?.();
  });
}
