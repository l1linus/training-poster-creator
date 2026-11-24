#!/usr/bin/env node
/**
 * 打开海报工作台(完整 Web UI): 在后台启动本地服务并打开浏览器。
 * 适合让 WorkBuddy / 其他 agent 帮助用户打开界面做手工调整。
 *
 *   node scripts/open-ui.mjs [--port 4173] [--host 127.0.0.1] [--no-open]
 *
 * 服务以 detached 方式常驻, 命令本身立即返回; 用 close-ui.mjs 关闭。
 */
import { startUi } from '../lib/ui.mjs';

function parseArgs(argv) {
  const args = { port: 4173, host: '127.0.0.1', open: true };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--port') {
      args.port = Number(argv[index + 1]);
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

const args = parseArgs(process.argv.slice(2));

try {
  const result = await startUi(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
  );
  process.exitCode = 1;
}
