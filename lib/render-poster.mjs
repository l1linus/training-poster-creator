import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launchBrowser } from './browser.mjs';
import { closeServer, startServer } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(HERE, '..');
export const INDEX_FILE = '培训海报生成器.html';

const IMAGE_MIME = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
]);

const COURSE_FORMATS = new Set(['线上培训', '线下培训']);

/** 读取 PNG 的 IHDR, 得到真实像素尺寸 */
function readPngSize(file) {
  const buffer = readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`输出文件不是有效 PNG: ${file}`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** 本地图片路径 -> dataURL; 路径不存在时返回空串并记录 warning */
function resolveImage(value, label, warnings, baseDir) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('data:')) return value;
  if (/^https?:\/\//i.test(value)) {
    warnings.push(`${label} 使用了外链图片, 离线模式不支持, 请改为本地文件或 dataURL: ${value}`);
    return '';
  }

  const filePath = path.resolve(baseDir, value);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    warnings.push(`${label} 指向的文件不存在, 已按未提供处理: ${value}`);
    return '';
  }
  const mime = IMAGE_MIME.get(path.extname(filePath).toLowerCase());
  if (!mime) {
    warnings.push(`${label} 不是受支持的图片格式(png/jpg/webp/gif/bmp), 已按未提供处理: ${value}`);
    return '';
  }
  return `data:${mime};base64,${readFileSync(filePath).toString('base64')}`;
}

function normalizeJob(raw, baseDir) {
  if (!raw || typeof raw !== 'object') throw new Error('渲染数据必须是 JSON 对象');
  const source = raw.form ? raw : { form: raw };
  const warnings = [];
  const form = { ...(source.form ?? {}) };
  const template = { ...(source.template ?? {}) };

  form.highlights = Array.isArray(form.highlights) ? form.highlights.map(String) : [];
  form.instructorPhoto = resolveImage(form.instructorPhoto, 'instructorPhoto', warnings, baseDir);
  form.qrcodeImage = resolveImage(form.qrcodeImage, 'qrcodeImage', warnings, baseDir);
  template.assetImage = resolveImage(template.assetImage, 'template.assetImage', warnings, baseDir);

  return { form, template, warnings };
}

function validateJob(job) {
  const { form } = job;
  const warnings = [];

  if (!String(form.topic ?? '').trim()) throw new Error('缺少必填字段 form.topic(培训主题)');
  if (String(form.topic).length > 40) warnings.push('topic 超过 40 字, 海报标题会换行并明显变高');
  if (!String(form.trainingDate ?? '').trim()) warnings.push('未填写 trainingDate, 海报日期区将为空');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.trainingDate))) {
    warnings.push('trainingDate 建议使用 YYYY-MM-DD 格式, 否则不做时区换算');
  }
  if (!String(form.timeBeijing ?? '').trim()) warnings.push('未填写 timeBeijing, 海报时间区将为空');
  if (!String(form.instructorName ?? '').trim()) warnings.push('未填写 instructorName, 讲师姓名将为空');
  if (form.courseFormat && !COURSE_FORMATS.has(form.courseFormat)) {
    warnings.push(`courseFormat 只支持“线上培训/线下培训”, 收到“${form.courseFormat}”, 按线上培训渲染`);
  }
  if (form.courseFormat === '线下培训' && !String(form.trainingLocation ?? '').trim()) {
    throw new Error('courseFormat 为“线下培训”时必须填写 trainingLocation(培训地点)');
  }
  if (form.courseFormat !== '线下培训' && !form.qrcodeImage) {
    warnings.push('未提供 qrcodeImage, 海报右下角显示“待上传二维码”占位');
  }
  if (form.highlights.length > 5) warnings.push(`highlights 有 ${form.highlights.length} 条, 超过 5 条海报会很长, 建议精简`);
  if (form.highlights.some((item) => item.length > 60)) warnings.push('存在超过 60 字的 highlight, 会换行撑高卡片');
  return warnings;
}

/**
 * 渲染一张海报 PNG。
 * @param {object} options
 * @param {object} options.job       表单数据 { form, template? }
 * @param {string} options.out       输出 PNG 路径
 * @param {number} [options.scale]   像素倍率 1-4, 默认 2
 * @param {string} [options.browser] msedge / chrome / 可执行文件路径
 * @param {number} [options.timeout] 毫秒
 * @param {string} [options.baseDir] 图片相对路径的基准目录, 默认 process.cwd()
 */
export async function renderPoster({ job: rawJob, out, scale = 2, browser: browserOption, timeout = 60000, baseDir = process.cwd() } = {}) {
  if (!out) throw new Error('缺少输出路径 out');
  const { form, template, warnings: imageWarnings } = normalizeJob(rawJob, baseDir);
  const warnings = [...imageWarnings, ...validateJob({ form, template })];

  const numericScale = Number(scale);
  const ratio = Number.isFinite(numericScale) ? Math.min(4, Math.max(1, numericScale)) : 2;
  if (ratio !== numericScale) warnings.push(`scale 已限制到 ${ratio} (允许 1-4)`);

  const outPath = path.resolve(process.cwd(), out);
  if (statSync(path.dirname(outPath), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`输出目录不是文件夹: ${path.dirname(outPath)}`);
  }
  mkdirSync(path.dirname(outPath), { recursive: true });
  if (path.extname(outPath).toLowerCase() !== '.png') {
    warnings.push('输出格式固定为 PNG, 文件扩展名建议使用 .png');
  }

  const { server, port } = await startServer({ root: APP_DIR, indexFile: INDEX_FILE, job: { form, template } });
  let browser;
  try {
    const launched = await launchBrowser(browserOption);
    browser = launched.browser;

    const page = await browser.newPage({
      viewport: { width: 750, height: 4000 },
      deviceScaleFactor: ratio,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      colorScheme: 'light',
    });
    page.setDefaultTimeout(timeout);

    const pageErrors = [];
    const noise = [
      /Failed to init time offset/,
      /Permissions policy violation/,
      /Error fetching published app info/,
      /Failed to load resource/,
    ];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (noise.some((pattern) => pattern.test(text))) return;
      pageErrors.push(text);
    });

    await page.goto(`http://127.0.0.1:${port}/#/render`, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForFunction(
      () => window.__POSTER_READY__ === true || Boolean(window.__POSTER_ERROR__),
      null,
      { timeout },
    );

    const renderError = await page.evaluate(() => window.__POSTER_ERROR__ ?? null);
    if (renderError) throw new Error(`页面渲染失败: ${renderError}`);

    const cssSize = await page.evaluate(() => window.__POSTER_SIZE__ ?? null);
    await page.locator('#poster-root').screenshot({
      path: outPath,
      type: 'png',
      animations: 'disabled',
      caret: 'hide',
      timeout,
    });

    const size = readPngSize(outPath);
    const result = {
      ok: true,
      out: outPath,
      width: size.width,
      height: size.height,
      cssWidth: cssSize?.width ?? null,
      cssHeight: cssSize?.height ?? null,
      scale: ratio,
      bytes: statSync(outPath).size,
      browser: launched.browserLabel,
    };
    if (warnings.length) result.warnings = warnings;
    if (pageErrors.length) result.pageErrors = pageErrors.slice(0, 3);
    return result;
  } finally {
    if (browser) {
      await Promise.race([browser.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 5000))]);
    }
    await closeServer(server);
  }
}
