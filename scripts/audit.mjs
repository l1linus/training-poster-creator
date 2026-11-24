#!/usr/bin/env node
/**
 * 隐私自检: 确认构建产物没有监控脚本, 且渲染过程不会真正访问外网。
 *
 *   node scripts/audit.mjs
 *
 * 说明: 本机安全软件(如 Kaspersky)可能向浏览器注入请求, 不属于本工具, 统计时忽略。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launchBrowser } from '../lib/browser.mjs';
import { APP_DIR, INDEX_FILE } from '../lib/render-poster.mjs';
import { closeServer, startServer } from '../lib/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IGNORED_HOST = /(^|\.)kaspersky-labs\.com$/i;
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail ? { detail } : {}) });
}

function isLocal(url) {
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
}

async function main() {
  const indexPath = path.join(APP_DIR, INDEX_FILE);
  const html = readFileSync(indexPath, 'utf8');
  check('csp', html.includes('Content-Security-Policy'), '限制外部资源与 connect');
  const externalScript = /<script[^>]+src=["']https?:/i.test(html);
  const loaderUrl = /lf3-short\.ibytedapm\.com|lf3-cdn-tos\.bytescm\.com|performance\.iife\.js/i.test(html);
  check('no-telemetry', !externalScript && !loaderUrl, '无外部脚本 / 监控加载器');
  check('no-remote-fonts', !/miaoda\.feishu\.cn\/fonts|fonts\.googleapis|gstatic/i.test(html), '字体不再走远程');

  const example = JSON.parse(readFileSync(path.join(HERE, '..', 'templates', 'example.json'), 'utf8'));
  const { server, port } = await startServer({ root: APP_DIR, indexFile: INDEX_FILE, job: example });
  let browser;
  try {
    const launched = await launchBrowser();
    browser = launched.browser;
    const page = await browser.newPage({ viewport: { width: 750, height: 2000 }, deviceScaleFactor: 1 });

    const finished = [];
    page.on('requestfinished', (request) => {
      const url = new URL(request.url());
      if (!isLocal(url) && !IGNORED_HOST.test(url.hostname)) finished.push(request.url());
    });

    await page.goto(`http://127.0.0.1:${port}/#/render`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(
      () => window.__POSTER_READY__ === true || Boolean(window.__POSTER_ERROR__),
      null,
      { timeout: 45000 },
    );
    const error = await page.evaluate(() => window.__POSTER_ERROR__ ?? null);

    check('render', !error, error ?? 'ok');
    check('no-external-success', finished.length === 0, finished.join(', ') || '没有成功的外网请求');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await closeServer(server);
  }

  const ok = checks.every((item) => item.ok);
  process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exitCode = 1;
});
