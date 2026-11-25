#!/usr/bin/env node
/**
 * 培训海报渲染器: JSON -> PNG(无头浏览器)。
 *
 * 用法:
 *   node scripts/render.mjs --data job.json --out poster.png
 *   node scripts/render.mjs --json '{"form":{"topic":"..."}}' --out poster.png --scale 2
 *   cat job.json | node scripts/render.mjs --data - --out poster.png
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { renderPoster } from '../lib/render-poster.mjs';

function output(payload, code = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const args = { scale: 2, out: 'poster.png' };
  const requireValue = (flag, value) => {
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} 缺少参数值`);
    return value;
  };
  const requireNumber = (flag, value) => {
    const numeric = Number(requireValue(flag, value));
    if (!Number.isFinite(numeric)) throw new Error(`${flag} 需要数字, 收到 ${value}`);
    return numeric;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--data':
        args.data = requireValue(flag, value);
        index += 1;
        break;
      case '--json':
        args.json = requireValue(flag, value);
        index += 1;
        break;
      case '--out':
        args.out = requireValue(flag, value);
        index += 1;
        break;
      case '--scale':
        args.scale = requireNumber(flag, value);
        index += 1;
        break;
      case '--browser':
        args.browser = requireValue(flag, value);
        index += 1;
        break;
      case '--timeout':
        args.timeout = requireNumber(flag, value);
        index += 1;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (flag.startsWith('--')) throw new Error(`未知参数: ${flag}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    output({
      ok: true,
      usage: 'node scripts/render.mjs --data job.json --out poster.png [--scale 2] [--browser msedge]',
      fields: '见 SKILL.md 或 templates/example.json',
    });
    return;
  }

  let raw;
  let baseDir = process.cwd();
  const parse = (text, source) => {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`${source} 不是合法 JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (args.json) {
    raw = parse(args.json, '--json');
  } else if (args.data === '-') {
    raw = parse(readFileSync(0, 'utf8'), 'stdin');
  } else if (args.data) {
    const filePath = path.resolve(process.cwd(), args.data);
    if (!existsSync(filePath)) throw new Error(`找不到数据文件: ${filePath}`);
    raw = parse(readFileSync(filePath, 'utf8'), filePath);
    // 图片相对路径按数据文件所在目录解析, 迁移目录时不用改 JSON
    baseDir = path.dirname(filePath);
  } else {
    throw new Error('缺少 --data <job.json> 或 --json <字符串>');
  }

  const result = await renderPoster({
    job: raw,
    out: args.out,
    scale: args.scale,
    browser: args.browser,
    timeout: args.timeout,
    baseDir,
  });
  output(result);
}

main().catch((error) => {
  output({ ok: false, error: error instanceof Error ? error.message : String(error) }, 1);
});
