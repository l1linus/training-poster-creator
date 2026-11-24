#!/usr/bin/env node
/**
 * 端到端自测: 渲染一张示例海报 + 跑一遍 MCP 握手。
 *   node scripts/test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderPoster } from '../lib/render-poster.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), ...(detail ? { detail } : {}) });
}

function runMcp(requests, timeoutMs = 45000) {
  const expected = requests.filter((request) => request.id !== undefined).length;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(HERE, 'mcp.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP 响应超时; stderr=${stderr.slice(0, 300)}`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const lines = stdout.split('\n').filter(Boolean);
      if (lines.length >= expected) {
        clearTimeout(timer);
        child.kill();
        resolve(lines);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);
  });
}

async function main() {
  const example = JSON.parse(readFileSync(path.join(HERE, '..', 'templates', 'example.json'), 'utf8'));
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'poster-skill-test-'));

  try {
    const out = path.join(tempDir, 'poster.png');
    const result = await renderPoster({ job: example, out, scale: 1, timeout: 45000 });
    check('render', result.ok === true, `${result.width}x${result.height}`);
    check('width-750', result.width === 750, String(result.width));
    check('height-reasonable', result.height > 800, String(result.height));

    const buffer = readFileSync(out);
    check('png-signature', buffer.toString('ascii', 1, 4) === 'PNG');
    check('file-size', statSync(out).size > 10000, `${statSync(out).size} bytes`);

    const responses = await runMcp([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'describe_poster_fields', arguments: {} } },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'render_poster', arguments: { job: { form: { topic: 'MCP 自检', trainingDate: '2026-12-24', timeBeijing: '10:00' } }, scale: 1 } },
      },
    ]);
    const parsed = responses.map((line) => JSON.parse(line));
    const init = parsed.find((item) => item.id === 1);
    const list = parsed.find((item) => item.id === 2);
    const call = parsed.find((item) => item.id === 3);
    const renderCall = parsed.find((item) => item.id === 4);
    check('mcp-initialize', Boolean(init?.result?.serverInfo?.name), init?.result?.serverInfo?.name);
    check('mcp-tools', Array.isArray(list?.result?.tools) && list.result.tools.length >= 2, String(list?.result?.tools?.length));
    check('mcp-call', String(call?.result?.content?.[0]?.text ?? '').includes('"form"'), 'describe_poster_fields');

    const renderPayload = JSON.parse(renderCall?.result?.content?.[0]?.text ?? '{}');
    check('mcp-render', renderPayload.ok === true && existsSync(renderPayload.out), renderPayload.out);
    if (renderPayload.out) rmSync(renderPayload.out, { force: true });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  const ok = checks.every((item) => item.ok);
  process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), checks }, null, 2)}\n`);
  process.exitCode = 1;
});
