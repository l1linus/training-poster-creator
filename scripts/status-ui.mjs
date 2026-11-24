#!/usr/bin/env node
/**
 * 查看海报工作台是否在运行。
 *
 *   node scripts/status-ui.mjs
 */
import { statusUi } from '../lib/ui.mjs';

try {
  process.stdout.write(`${JSON.stringify(await statusUi(), null, 2)}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
  );
  process.exitCode = 1;
}
