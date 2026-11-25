import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 工具目录（skill 根目录） */
export const APP_DIR = path.resolve(HERE, '..');

/**
 * 找到中文界面的单文件应用。
 * 文件名带中文和空格，为兼容旧版解压目录保留上一代名字做兜底。
 */
export function resolveIndexFile(dir = APP_DIR) {
  const candidates = ['培训海报生成器 Training Poster Generator.html', '培训海报生成器.html'];
  for (const name of candidates) {
    if (existsSync(path.join(dir, name))) return name;
  }
  const fallback = readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.html') && !/-en\.html$/i.test(name))
    .sort()[0];
  return fallback || candidates[0];
}

export const INDEX_FILE = resolveIndexFile();
