import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright-core';

/** 各平台常见浏览器安装位置(Playwright 的 channel 找不到时的兜底) */
const KNOWN_PATHS = {
  win32: [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(os.homedir(), 'AppData/Local/Microsoft/Edge/Application/msedge.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  ],
  darwin: [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(os.homedir(), 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ],
  linux: [
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
};

function existingFile(candidate) {
  return candidate && existsSync(candidate) ? candidate : null;
}

/** 供 doctor 使用: 只做本地探测, 不启动浏览器 */
export function detectBrowserPath() {
  const paths = KNOWN_PATHS[process.platform] ?? [];
  for (const candidate of paths) {
    const found = existingFile(candidate);
    if (found) return found;
  }
  return null;
}

function candidates(preferred) {
  const list = [];
  const push = (value, source) => {
    if (!value) return;
    if (typeof value !== 'string') return;
    if (value.includes('/') || value.includes('\\')) list.push({ label: `${source}:${value}`, executablePath: value });
    else list.push({ label: `${source}:${value}`, channel: value });
  };

  push(process.env.POSTER_BROWSER, 'POSTER_BROWSER');
  push(preferred, 'parameter');
  push('msedge', 'channel');
  push('chrome', 'channel');

  const known = detectBrowserPath();
  if (known) list.push({ label: `detected:${known}`, executablePath: known });

  const seen = new Set();
  return list.filter((candidate) => {
    const key = candidate.channel ?? candidate.executablePath;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 启动无头浏览器, 优先用系统已安装的 Edge/Chrome, 不下载 Chromium。
 * @returns {Promise<{browser: import('playwright-core').Browser, browserLabel: string}>}
 */
export async function launchBrowser(preferred) {
  const attempts = candidates(preferred);
  const failures = [];

  for (const candidate of attempts) {
    const { label, ...options } = candidate;
    if (options.executablePath && !existsSync(options.executablePath)) {
      failures.push(`${label}: 文件不存在`);
      continue;
    }
    try {
      const browser = await chromium.launch({
        headless: true,
        timeout: 30000,
        args: ['--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
        ...options,
      });
      return { browser, browserLabel: label };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      failures.push(`${label}: ${message}`);
    }
  }

  throw new Error(
    [
      '没有可用的浏览器。请安装 Microsoft Edge 或 Google Chrome, 然后重试;',
      '也可以用环境变量 POSTER_BROWSER 或 --browser 参数指定可执行文件路径。',
      '已尝试:',
      ...failures.map((line) => `  - ${line}`),
    ].join('\n'),
  );
}
