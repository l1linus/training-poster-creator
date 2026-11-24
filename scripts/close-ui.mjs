#!/usr/bin/env node
/**
 * 关闭由 open-ui.mjs 启动的海报工作台。
 *
 *   node scripts/close-ui.mjs
 */
import { stopUi } from '../lib/ui.mjs';

try {
  const result = await stopUi();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
  );
  process.exitCode = 1;
}
