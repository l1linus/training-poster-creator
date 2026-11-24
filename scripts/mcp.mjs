#!/usr/bin/env node
/**
 * 极简 MCP stdio server: 让任意支持 MCP 的 agent(Claude Desktop / Cursor / DSH ...)调用海报渲染。
 *
 * 启动: node scripts/mcp.mjs
 * 工具: render_poster / describe_poster_fields
 *
 * 只依赖 Node 内置模块 + playwright-core。
 */
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { renderPoster } from '../lib/render-poster.mjs';
import { startUi, statusUi, stopUi } from '../lib/ui.mjs';

const VERSION = '1.0.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIELDS = JSON.parse(readFileSync(path.resolve(HERE, '../templates/fields.json'), 'utf8'));

const TOOLS = [
  {
    name: 'open_editor',
    title: '打开海报工作台',
    description:
      '在用户电脑上启动完整的海报编辑 Web UI 并返回地址。用户需要调整模板、配色、预览、上传讲师照片或二维码时优先用它；' +
      '只有批量/无人值守出图才用 render_poster。要求 MCP 客户端与工具运行在同一台机器。',
    inputSchema: {
      type: 'object',
      properties: {
        port: { type: 'number', description: '本地端口, 默认 4173。' },
        host: { type: 'string', description: '监听地址, 默认 127.0.0.1; 同网段访问可填 0.0.0.0。' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'close_editor',
    title: '关闭海报工作台',
    description: '关闭由 open_editor 启动的本地工作台。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'editor_status',
    title: '查看工作台状态',
    description: '返回工作台是否在运行、URL 和端口。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'render_poster',
    title: '渲染培训海报',
    description:
      '把结构化培训信息渲染成竖版海报 PNG(750px 宽, 默认 2 倍图)。返回文件路径与像素尺寸。' +
      '主题必填; 支持线上/线下培训、多时区时间、讲师照片与报名二维码。',
    inputSchema: {
      type: 'object',
      properties: {
        job: {
          type: 'object',
          description: '海报数据: { form: {...}, template?: {...} }。字段见 describe_poster_fields。',
          additionalProperties: true,
        },
        out: {
          type: 'string',
          description: '输出 PNG 路径。省略时写到系统临时目录 training-poster/ 下, 返回的 out 字段是绝对路径。',
        },
        scale: {
          type: 'number',
          description: '像素倍率 1-4, 默认 2(输出 1500px 宽)。',
          minimum: 1,
          maximum: 4,
        },
      },
      required: ['job'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'describe_poster_fields',
    title: '查看海报字段',
    description: '返回海报表单字段、类型、默认值与限制, 用于构造 render_poster 的 job。',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function textResult(payload, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

let queue = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function handle(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: params?.protocolVersion ?? '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'training-poster', title: '培训海报生成器', version: VERSION },
      instructions:
        '生成培训/课程海报。用户要手工调整模板、配色、预览或上传照片/二维码时, 先调用 open_editor 打开 Web UI; ' +
        '批量/无人值守出图才用 render_poster。字段见 describe_poster_fields。',
    });
    return;
  }
  if (method === 'notifications/initialized' || method === 'initialized' || method === 'notifications/cancelled') return;
  if (method === 'ping') {
    reply(id, {});
    return;
  }
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    try {
      if (name === 'open_editor') {
        const result = await startUi({
          port: Number.isInteger(args.port) ? args.port : 4173,
          host: typeof args.host === 'string' && args.host ? args.host : '127.0.0.1',
          open: true,
        });
        reply(id, textResult(result));
        return;
      }
      if (name === 'close_editor') {
        reply(id, textResult(await stopUi()));
        return;
      }
      if (name === 'editor_status') {
        reply(id, textResult(await statusUi()));
        return;
      }
      if (name === 'describe_poster_fields') {
        reply(id, textResult(FIELDS));
        return;
      }
      if (name === 'render_poster') {
        let job = args.job;
        if (typeof job === 'string') job = JSON.parse(job);
        if (!job || typeof job !== 'object') throw new Error('job 必须是对象');
        const out =
          typeof args.out === 'string' && args.out
            ? args.out
            : path.join(os.tmpdir(), 'training-poster', `poster-${Date.now()}.png`);
        const result = await renderPoster({
          job,
          out,
          scale: args.scale ?? 2,
        });
        reply(id, textResult(result));
        return;
      }
      reply(id, textResult({ ok: false, error: `未知工具: ${name}` }, true));
    } catch (error) {
      reply(id, textResult({ ok: false, error: error instanceof Error ? error.message : String(error) }, true));
    }
    return;
  }
  replyError(id, -32601, `未知方法: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const text = line.trim();
  if (!text) return;
  let request;
  try {
    request = JSON.parse(text);
  } catch {
    process.stderr.write(`[poster-mcp] invalid json: ${text.slice(0, 200)}\n`);
    return;
  }
  if (request.id === undefined) return; // 通知类消息不需要响应
  enqueue(async () => {
    try {
      await handle(request);
    } catch (error) {
      replyError(request.id, -32603, error instanceof Error ? error.message : String(error));
    }
  });
});
rl.on('close', () => {
  // stdin 关闭(例如一次性调用)时, 等队列里的渲染跑完再退出
  queue.then(
    () => process.exit(0),
    () => process.exit(0),
  );
});

process.stderr.write('[poster-mcp] ready\n');
