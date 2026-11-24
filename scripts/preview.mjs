#!/usr/bin/env node
/**
 * 打开可交互的海报工作台(浏览器 Web UI): 左侧填表、右侧预览、导出 PNG。
 *
 *   node scripts/preview.mjs [--port 4173] [--host 127.0.0.1] [--no-open]
 *
 * 默认只监听 127.0.0.1。需要给别人看时用 --host 0.0.0.0, 并注意网络暴露。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer } from '../lib/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..');
const INDEX_FILE = '培训海报生成器.html';

function parseArgs(argv) {
  const args = { port: 4173, host: '127.0.0.1', open: true };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--port') {
      const port = Number(argv[index + 1]);
      args.port = Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 4173;
      index += 1;
    } else if (flag === '--host') {
      args.host = argv[index + 1] ?? '127.0.0.1';
      index += 1;
    } else if (flag === '--no-open') {
      args.open = false;
    }
  }
  return args;
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // 打不开浏览器不影响服务, URL 已经打印
  }
}

const args = parseArgs(process.argv.slice(2));

let started;
try {
  started = await startServer({ root: APP_DIR, indexFile: INDEX_FILE, host: args.host, port: args.port });
} catch (error) {
  if (error?.code === 'EADDRINUSE') {
    console.error(`端口 ${args.port} 已被占用, 换一个端口: --port 4174`);
  } else {
    console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}

const { server, port } = started;
const localHost = args.host === '0.0.0.0' || args.host === '::' ? '127.0.0.1' : args.host;
const url = `http://${localHost}:${port}/`;
console.log(`海报工作台已启动: ${url}`);
if (args.host !== '127.0.0.1' && args.host !== 'localhost') {
  console.warn(`注意: 当前绑定在 ${args.host}, 同网段的其他设备也能访问`);
}
console.log('按 Ctrl+C 停止。');
if (args.open && !process.env.POSTER_NO_OPEN) openBrowser(url);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000);
  });
}
