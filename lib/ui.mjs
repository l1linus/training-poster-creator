import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openBrowser } from './open-browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RUNTIME_FILE = path.join(ROOT, '.poster-ui.json');
const PREVIEW_SCRIPT = path.join(ROOT, 'scripts', 'preview.mjs');

function readRuntime() {
  try {
    if (!existsSync(RUNTIME_FILE)) return null;
    const parsed = JSON.parse(readFileSync(RUNTIME_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isHealthy(port, host = '127.0.0.1') {
  try {
    const response = await fetch(`http://${host}:${port}/__health`, {
      signal: AbortSignal.timeout(1200),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

function lanUrls(port) {
  const urls = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${port}/`);
      }
    }
  }
  return urls;
}

function writeRuntime(data) {
  writeFileSync(RUNTIME_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * 启动（或复用）海报工作台的本地 Web 服务, 返回可直接打开的 URL。
 * 服务以 detached 方式运行, 调用方退出后仍然可用。
 */
export async function startUi({ port = 4173, host = '127.0.0.1', open = true, timeout = 15000 } = {}) {
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error(`端口不合法: ${port}`);
  }

  const existing = readRuntime();
  if (existing) {
    if (await isHealthy(existing.port)) {
      const url = existing.url ?? `http://127.0.0.1:${existing.port}/`;
      if (open) openBrowser(url);
      return {
        ok: true,
        reused: true,
        url,
        pid: existing.pid ?? null,
        port: existing.port,
        host: existing.host ?? host,
      };
    }
    rmSync(RUNTIME_FILE, { force: true });
  }

  // 端口上已经有本工具的服务(例如手动启动过), 直接复用
  if (await isHealthy(numericPort)) {
    const url = `http://127.0.0.1:${numericPort}/`;
    writeRuntime({ pid: null, port: numericPort, host, url, startedAt: new Date().toISOString() });
    if (open) openBrowser(url);
    return { ok: true, reused: true, url, pid: null, port: numericPort, host };
  }

  const child = spawn(
    process.execPath,
    [PREVIEW_SCRIPT, '--port', String(numericPort), '--host', host, '--no-open'],
    {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    },
  );
  child.unref();

  const healthy = await waitForHealth(numericPort, timeout);
  if (!healthy) {
    try {
      process.kill(child.pid);
    } catch {
      // ignore
    }
    throw new Error(
      `工作台启动失败(端口 ${numericPort})。可能被占用, 换一个端口: --port 4174`,
    );
  }

  const localUrl = `http://127.0.0.1:${numericPort}/`;
  const runtime = {
    pid: child.pid,
    port: numericPort,
    host,
    url: localUrl,
    startedAt: new Date().toISOString(),
  };
  writeRuntime(runtime);
  if (open) openBrowser(localUrl);

  return {
    ok: true,
    reused: false,
    url: localUrl,
    pid: child.pid,
    port: numericPort,
    host,
    ...(host === '0.0.0.0' || host === '::' ? { lanUrls: lanUrls(numericPort) } : {}),
  };
}

export async function stopUi() {
  const runtime = readRuntime();
  if (!runtime) return { ok: true, stopped: false, message: '没有正在运行的工作台' };

  if (runtime.pid && isAlive(runtime.pid)) {
    try {
      process.kill(runtime.pid);
    } catch {
      // ignore
    }
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await isHealthy(runtime.port))) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  rmSync(RUNTIME_FILE, { force: true });
  return { ok: true, stopped: true, port: runtime.port };
}

export async function statusUi() {
  const runtime = readRuntime();
  if (!runtime) return { ok: true, running: false };
  const running = await isHealthy(runtime.port);
  return { ok: true, running, ...runtime, url: runtime.url ?? `http://127.0.0.1:${runtime.port}/` };
}
