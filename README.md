# 培训海报生成器 · Training Poster Generator

填表即出竖版培训海报：主题、讲师、时间填进模板，主色与强调色按品牌色自定义，全程本地渲染，素材不出机器。

> Fill in a form, get a vertical training poster. Topic, speaker and time drop into a template, the primary and accent colors can match your brand, and everything renders on your own machine — nothing is uploaded.

| | |
| --- | --- |
| 在线介绍页 · Landing page | <https://l1linus.github.io/training-poster-creator/> · [English](https://l1linus.github.io/training-poster-creator/index-en.html) |
| 在线生成器 · Generator | <https://l1linus.github.io/training-poster-creator/generator.html> · [English UI](https://l1linus.github.io/training-poster-creator/generator-en.html) |
| 单文件版 · Single file | `培训海报生成器 Training Poster Generator.html`<br>`training-poster-generator-en.html` |

单文件版双击用浏览器打开即可，无需安装、无需联网；两版右上角的地球按钮可互相切换。

> Either single file runs in a browser on its own: no install, no connection. The globe button in the top-right corner switches between Chinese and English.

## 下载 · Download

推荐从 Releases 下载安装包：打开[最新版本](https://github.com/l1linus/training-poster-creator/releases/latest)，下载 `training-poster-creator-v1.2.0.zip`，解压得到 `training-poster-creator` 文件夹，整个放进 skills 目录即可使用。也可以点仓库右上角 `Code` → `Download ZIP`，内容相同，只是没有版本说明。

> The release package is the easiest route: open the [latest release](https://github.com/l1linus/training-poster-creator/releases/latest), download `training-poster-creator-v1.2.0.zip`, unzip it, and drop the whole `training-poster-creator` folder into your skills directory. `Code` → `Download ZIP` gives you the same files, minus the release notes.

## 用 Skill 方式启动 · Start it as a Skill

由 WorkBuddy 等 agent 启动本地工作台（模板、配色、讲师照片、预览、导出），用户在界面里完成创作。技能说明见 `SKILL.md`，英文版见 [`SKILL.en.md`](SKILL.en.md)。

> An agent such as WorkBuddy starts the local workbench — templates, colors, speaker photo, live preview, export — and you finish the poster in the interface. The skill guide is `SKILL.md` (Chinese) or [`SKILL.en.md`](SKILL.en.md).

## 首次使用 · First run

对方电脑可能没有 Node，跑一次下面的命令即可（Windows / macOS / Linux 各一条）：

> The other machine may not have Node yet. Run one of these once:

```powershell
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

```bash
# macOS / Linux
bash scripts/bootstrap.sh
```

脚本自动检测 Node；缺失时下载便携版到 `.runtime/`（约 35 MB，不写入系统），然后启动工作台并返回 `{ ok, url, pid }`。

> The script checks for Node. If it is missing, it downloads a portable build into `.runtime/` (about 35 MB, nothing installed system-wide), starts the workbench, and returns `{ ok, url, pid }`.

## 日常启动 · Daily start

```bash
node scripts/open-ui.mjs --no-open   # 返回 / returns http://127.0.0.1:4173/
node scripts/close-ui.mjs            # 关闭 / stop
```

支持 MCP：`scripts/mcp.mjs` 提供 `open_editor` / `close_editor` / `status` / `render_poster`。

> MCP is supported: `scripts/mcp.mjs` exposes `open_editor`, `close_editor`, `status` and `render_poster`.

## 目录 · Layout

```
培训海报生成器 Training Poster Generator.html  中文界面 · single-file web UI
training-poster-generator-en.html              英文界面 · English UI
使用说明 Read Me.txt                           快速上手 · quick start
scripts/bootstrap.ps1 / .sh                    首次一键 · one-shot first run
scripts/open-ui.mjs                            日常启动 · daily start
scripts/mcp.mjs                                MCP server
lib/                                           服务 / UI 生命周期 / 渲染 · server, lifecycle, rendering
templates/                                     示例与字段说明 · sample job and field reference
USAGE.md                                       完整使用指引 · full walkthrough (Chinese)
SKILL.md / SKILL.en.md                         agent 技能说明 · agent skill guide (中 / EN)
```

## 说明 · Notes

- 主路径是把整个目录作为 skill 使用；单文件 HTML 作为离线、应急的打开方式。
- 打开工作台不需要 `npm install`；只有 MCP 的 `render_poster` 需要。
- 隐私：页面带 CSP，禁止外部资源与连接，`npm run audit` 可验证。

> The main path is using the whole folder as a skill; the single-file HTML is the offline fallback.
> Opening the workbench needs no `npm install` — only the MCP `render_poster` call does.
> Privacy: the page ships a CSP that blocks external resources and connections. Verify it with `npm run audit`.
