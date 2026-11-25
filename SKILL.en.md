---
name: training-poster
description: Renders a vertical training/course promo poster PNG (training poster, course poster, event poster, promotion poster), or opens the poster Web UI for manual editing. Use when the user says "开始生成培训海报 / 做一张培训海报 / 做张海报 / 生成宣传图 / 导出 PNG / 改配色再出一版", or asks to "打开海报编辑器 / 工作台 / 预览界面自己调". By default open the Web UI and let the user adjust; render unattended only when batch output is explicitly requested. Supports online and in-person sessions, automatic Beijing-time conversion to Central Europe / US West / US East, custom brand colors, and exports a 750px-wide PNG at 2x (1500px wide) by default.
---

# Training Poster Generator (local rendering) · [🌐 中文](SKILL.md)

Renders structured training information into a single vertical, tech-style poster PNG. **No Feishu Miaoda runtime, no login, no network API** — it only starts a temporary local static server and screenshots the result with a headless browser.

## Default behavior (important)

When the user says "开始生成培训海报", "make me a training poster" or "open the poster workbench", **open the Web UI by default**. Do not call `render_poster` and do not ask for parameters first.

**Startup (same idempotent entry point every time):**

- Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`
- macOS / Linux: `bash scripts/bootstrap.sh`

The script detects Node (downloading a portable build into `.runtime/` if missing) → starts the workbench → returns `{ ok, url }`. Open `url` for the user; if that fails, send them the link.

Only use `render_poster` / `render.mjs` when the user explicitly asks for batch output, asks for images without looking at the UI, or wants N posters at once.

## What it does

- **Full Web UI**: `npm run ui` (or `node scripts/open-ui.mjs`) starts the server in the background and returns a URL; users pick a template/colors, fill the form, crop a photo, preview live and export a PNG. This is the first choice whenever a human needs to adjust something.
- JSON in, PNG out: `node scripts/render.mjs --data job.json --out poster.png` (batch / unattended)
- Speaker photo and sign-up QR code: pass local image paths, the script converts them to data URLs
- Converts Beijing time to Central Europe / US West / US East automatically, labeled with DST or standard time
- Three color modes: built-in dark blue tech (default), colors sampled from an artwork image, or a manual primary/accent pair
- Interactive Web UI for humans: `node scripts/preview.mjs`
- MCP server: `node scripts/mcp.mjs` (plug into Claude Desktop / Cursor / DSH, etc.)

## Ways to integrate

1. Any agent that can run commands: call `bootstrap.ps1` / `bootstrap.sh` first and give the user the workbench URL; use `render.mjs` only for batch or unattended runs.
2. MCP clients: `open_editor` opens the workbench, `render_poster` renders in batch (see below).
3. Runtimes that read `SKILL.md` (DSH / Claude Code, etc.): drop the whole folder into the skills directory.

## When to open the workbench

| User intent | Action |
|---|---|
| Wants to pick a template, change colors, preview, fine-tune | `open_editor` / `open-ui.mjs`, hand over the URL |
| Batch, scheduled or unattended rendering | `render_poster` / `render.mjs` |
| Only asking "can it do this / how do I use it" | Explain both paths, recommend opening the workbench |

After the workbench is open, **do not** call `render_poster` on the user's behalf and do not edit `培训海报生成器 Training Poster Generator.html`; wait for the user to export.

## Privacy

- No account, no database; form content, photos and QR codes stay in local memory and the temporary `127.0.0.1` server.
- The build has removed the Miaoda-injected Slardar / Tea / performance-monitoring scripts and adds a CSP that blocks external resources and external `connect`.
- No remote fonts; system fonts only. `http(s)` remote images are rejected and logged to `warnings`.
- Opening the workbench needs no network. Only the first `bootstrap` downloads the portable Node build when Node is missing, and `npm install` downloads playwright-core.

## Requirements

- Node.js ≥ 20: **it does not need to be pre-installed**; the first `bootstrap` run downloads a portable build into `.runtime/` when Node is missing
- To open the workbench you only need a system browser (Edge / Chrome / Safari)
- Batch rendering and the MCP `render_poster` additionally need `npm install` (playwright-core) plus Edge or Chrome

## First run (someone else's machine)

```powershell
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

```bash
# macOS / Linux
bash scripts/bootstrap.sh
```

Flow: detect Node → download the portable build if missing (about 35 MB, nothing installed system-wide) → start the workbench → print `{ ok, url, pid }`.
Hand the `url` to the user's browser or the WorkBuddy preview panel.

## Self-checks

```bash
npm install                        # only needed for batch rendering / MCP
node scripts/doctor.mjs            # environment check: Node / app / playwright-core / browser
node scripts/doctor.mjs --render   # additionally render one test poster
node scripts/test.mjs              # end to end: sample render + MCP handshake
node scripts/audit.mjs             # privacy: no monitoring scripts, no successful outbound requests
```

All of them print JSON; `ok: true` means ready, and on failure `checks` names the item that did not pass.

## Quick start

```bash
# 1. Open the workbench (preferred when a human needs to adjust)
npm run ui

# 2. Render the sample (batch / unattended)
node scripts/render.mjs --data templates/example.json --out out/poster.png

# 2b. Inline JSON (handy for a single agent call)
node scripts/render.mjs --json '{"form":{"topic":"读懂客户","trainingDate":"2026-12-16","timeBeijing":"19:00","timeBeijingEnd":"20:00"}}' --out out/poster.png

# 3. 3x output
node scripts/render.mjs --data job.json --out poster.png --scale 3

# 4. Open the interactive workbench (form on the left, preview on the right, export PNG)
node scripts/preview.mjs --port 4173
```

Scripts print JSON to stdout:

```json
{
  "ok": true,
  "out": "E:\\...\\poster.png",
  "width": 1500,
  "height": 2740,
  "cssWidth": 750,
  "cssHeight": 1370,
  "scale": 2,
  "bytes": 1657563,
  "browser": "channel:msedge",
  "warnings": ["未提供 qrcodeImage, 海报右下角显示“待上传二维码”占位"]
}
```

On failure it prints `{ "ok": false, "error": "..." }` and exits with code 1. (`warnings` and `error` messages are emitted in Chinese.)

## Input format

```json
{
  "form": {
    "seriesName": "产品运营训练营-第18场",
    "topic": "用数据讲好业务故事",
    "courseFormat": "线上培训",
    "instructorName": "林晓",
    "instructorBio": "产品运营部",
    "instructorPhoto": "C:/photos/liming.jpg",
    "highlights": ["掌握客户沟通的关键方法", "梳理跨部门协作流程"],
    "targetAudience": "全体一线运营同事",
    "trainingDate": "2026-12-16",
    "timeBeijing": "19:00",
    "timeBeijingEnd": "20:00",
    "includeEuropeTime": true,
    "qrcodeImage": "C:/photos/qr.png"
  },
  "template": { "mode": "blue" }
}
```

### `form` fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `topic` | string | **yes** | Main headline, 10–20 characters is ideal; longer text wraps and the poster grows taller |
| `seriesName` | string | no | Series name at the top, e.g. `产品运营训练营-第18场` |
| `courseFormat` | string | no | `线上培训` (online, default) / `线下培训` (in person) — these two values are data, keep them in Chinese |
| `trainingLocation` | string | in-person only | Shown bottom-right instead of the QR code for in-person sessions |
| `instructorName` | string | no | Speaker name |
| `instructorBio` | string | no | Speaker title / department |
| `instructorPhoto` | string | no | Local path or data URL (remote URLs unsupported); leave empty for the built-in silhouette |
| `highlights` | string[] | no | One card per item; 2–4 items, ≤ 30 characters each |
| `targetAudience` | string | no | Who should attend |
| `trainingDate` | string | no | `YYYY-MM-DD`; shown on the poster and used for time-zone conversion |
| `timeBeijing` | string | no | `HH:mm`, Beijing time start |
| `timeBeijingEnd` | string | no | `HH:mm`, Beijing time end |
| `includeEuropeTime` | boolean | no | Defaults to `true`, shows Central Europe |
| `includeUsWestTime` | boolean | no | Defaults to `false`, shows US West |
| `includeUsEastTime` | boolean | no | Defaults to `false`, shows US East |
| `qrcodeImage` | string | no | Local path or data URL (remote URLs unsupported); online sessions show a placeholder when empty |
| `signupLink` | string | no | Promo copy only, never printed on the poster |

### `template` fields (optional)

- `{"mode":"blue"}`: built-in dark blue tech palette (default)
- `{"mode":"manual","manualStyle":{"primaryColor":"#1A2F4A","secondaryColor":"#45E2EA"}}`: manual colors
- `{"mode":"custom","style":{...}}`: palette sampled from an artwork image (`style` has the same shape)

Relative image paths: with `--data job.json` they resolve against the **directory of job.json**; with `--json` and inline calls they resolve against the **current working directory**. On Windows prefer forward slashes (`C:/photos/a.jpg`) to avoid JSON escaping issues.

## Rules and limits

- **At most 2 extra time zones**, in priority order: Central Europe → US West → US East
- With `courseFormat=线下培训`, `trainingLocation` is required, otherwise rendering fails
- Poster width is fixed at 750px; height follows the content (roughly 1100–1700) and is not a fixed 9:16 — crop or pad yourself if you need a fixed ratio
- System fonts only (PingFang SC / Microsoft YaHei); no network requests; glyphs differ slightly between systems
- Output is PNG without transparency; an extension other than `.png` only produces a warning, the bytes are still PNG
- Images must be local paths or data URLs; `http(s)` URLs are rejected and logged to `warnings`
- A missing or unsupported image does not fail the run: it is treated as "not provided" and logged to `warnings`

## Common errors

| Error | Fix |
|---|---|
| `缺少必填字段 form.topic` | add `topic` |
| `courseFormat 为“线下培训”时必须填写 trainingLocation` | add a location, or switch to `线上培训` |
| `ERR_MODULE_NOT_FOUND: playwright-core` | run `npm install` in the skill directory |
| `没有可用的浏览器` | install Edge/Chrome, or set `POSTER_BROWSER` / pass `--browser` with a path |
| The image turns into a text path | the path is missing, the format is unsupported, or a remote URL was used; check `warnings` and switch to a local file |

## MCP (optional)

```bash
node scripts/mcp.mjs
```

Five tools:

- `open_editor({ port?, host? })`: start the full Web UI and return `url` / `pid`; use this when a human needs to adjust
- `close_editor()`: close the workbench
- `editor_status()`: check whether it is running
- `render_poster({ job, out?, scale? })`: batch rendering; without `out` it writes to the system temp directory
- `describe_poster_fields()`: return the field reference

`open_editor` requires the MCP client and the tool to run on the same machine; cloud clients cannot reach the returned `127.0.0.1` address.

Configure it as a stdio server in any MCP-capable client (use an absolute path in `args`):

```json
{
  "mcpServers": {
    "training-poster": {
      "command": "node",
      "args": ["<absolute path to the skill folder>/scripts/mcp.mjs"]
    }
  }
}
```

On Windows, if the client cannot find `node`, point `command` at the absolute path of `node.exe`.

## Layout

```
SKILL.md                                       this guide (Chinese)
SKILL.en.md                                    this guide (English)
培训海报生成器 Training Poster Generator.html  single-file web app (double-click to run; the server uses /#/render)
training-poster-generator-en.html              English UI (also a single file)
lib/index-file.mjs                             finds the Chinese UI file (also accepts the old name)
lib/server.mjs                                 static file server (exposes /__job.json, /__health)
lib/open-browser.mjs                           opens a URL in the system browser
lib/ui.mjs                                     start / reuse / stop the workbench
lib/browser.mjs                                locates Edge or Chrome across platforms
lib/render-poster.mjs                          rendering core (validate + screenshot + PNG size check)
scripts/render.mjs                             CLI: JSON -> PNG
scripts/bootstrap.ps1                          one-shot first run (Windows): check/download Node + start
scripts/bootstrap.sh                           one-shot first run (macOS/Linux)
scripts/preview.mjs                            start the web UI in the foreground (blocking)
scripts/open-ui.mjs                            start the workbench in the background, return a URL
scripts/close-ui.mjs                           stop the workbench
scripts/status-ui.mjs                          report workbench status
scripts/mcp.mjs                                MCP stdio server
scripts/doctor.mjs                             environment self-check
scripts/test.mjs                               end-to-end self-test
scripts/audit.mjs                              privacy self-check (no external scripts, no successful outbound calls)
使用说明 Read Me.txt                           quick start for both ways of using it
USAGE.md                                       full walkthrough (WorkBuddy included)
templates/example.json                         a sample you can run as-is
templates/fields.json                          field reference
```

The UI is a single-file build (Vite standalone, hash routing). Layout changes require regenerating `培训海报生成器 Training Poster Generator.html` from the original Miaoda source.
