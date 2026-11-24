#!/usr/bin/env node
/**
 * 自检: 检查运行环境, 可选跑一次真实渲染。
 *
 *   node scripts/doctor.mjs            # 环境检查
 *   node scripts/doctor.mjs --render   # 再渲染一张自检图
 *   node scripts/doctor.mjs --no-launch
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectBrowserPath, launchBrowser } from '../lib/browser.mjs';
import { APP_DIR, INDEX_FILE, renderPoster } from '../lib/render-poster.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail ? { detail } : {}) });
}

async function main() {
  const args = process.argv.slice(2);
  const skipLaunch = args.includes('--no-launch');
  const runRender = args.includes('--render');

  const major = Number(process.versions.node.split('.')[0]);
  check('node', major >= 20, `v${process.versions.node}${major >= 20 ? '' : ' (需要 >= 20)'}`);

  check('platform', true, `${process.platform} ${process.arch}`);

  check('app', existsSync(path.join(APP_DIR, INDEX_FILE)), path.join(APP_DIR, INDEX_FILE));

  const playwrightPackage = path.join(HERE, '..', 'node_modules', 'playwright-core', 'package.json');
  if (existsSync(playwrightPackage)) {
    const { version } = JSON.parse(readFileSync(playwrightPackage, 'utf8'));
    check('playwright-core', true, version);
  } else {
    check('playwright-core', false, '未安装, 先在技能目录执行 npm install');
  }

  const detected = detectBrowserPath();
  check('browser-detected', Boolean(detected), detected ?? '未在常见路径找到 Edge/Chrome');

  if (!skipLaunch) {
    try {
      const { browser, browserLabel } = await launchBrowser();
      await browser.close();
      check('browser-launch', true, browserLabel);
    } catch (error) {
      check('browser-launch', false, error instanceof Error ? error.message.split('\n')[0] : String(error));
    }
  }

  let renderInfo;
  if (runRender) {
    const out = path.join(os.tmpdir(), `poster-doctor-${Date.now()}.png`);
    try {
      renderInfo = await renderPoster({
        job: {
          form: {
            topic: '自检海报',
            seriesName: '环境自检',
            trainingDate: '2026-12-24',
            timeBeijing: '10:00',
            timeBeijingEnd: '11:00',
            highlights: ['检查渲染链路'],
            targetAudience: '本机',
          },
        },
        out,
        scale: 1,
        timeout: 45000,
      });
      check('render', renderInfo.ok === true, `${renderInfo.width}x${renderInfo.height}`);
    } catch (error) {
      check('render', false, error instanceof Error ? error.message.split('\n')[0] : String(error));
    } finally {
      rmSync(out, { force: true });
    }
  }

  const ok = checks.every((item) => item.ok);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok,
        summary: ok ? '环境可用' : '存在问题, 见 checks',
        node: process.versions.node,
        platform: `${process.platform} ${process.arch}`,
        checks,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exitCode = 1;
});
