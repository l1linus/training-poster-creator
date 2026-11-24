# 培训海报生成器

填表即出竖版培训海报：主题、讲师、时间填进模板，主题色与强调色按品牌色自定义，本地渲染、不上传素材。

- 在线介绍页：https://l1linus.github.io/training-poster-creator/
- 单文件网页版：下载仓库里的 `培训海报生成器.html`，双击用浏览器打开即可，无需安装、无需联网。

## 用 Skill 方式启动（推荐）

由 WorkBuddy 等 agent 启动本地 Web UI（模板、配色、照片、预览、导出），用户在界面里完成创作。

## 首次使用（对方电脑可能没有 Node）

```powershell
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

```bash
# macOS / Linux
bash scripts/bootstrap.sh
```

自动检测 Node；缺失时下载便携版到 `.runtime/`（约 35 MB，不写系统），然后启动工作台并返回 `{ ok, url, pid }`。

## 日常启动（非首次）

```bash
node scripts/open-ui.mjs --no-open   # 返回 http://127.0.0.1:4173/
node scripts/close-ui.mjs
```

支持 MCP：`scripts/mcp.mjs` 提供 `open_editor` / `close_editor` / `status` / `render_poster`。

## 批量出图（可选）

```bash
npm install
node scripts/render.mjs --data templates/example.json --out poster.png
```

## 目录

```
培训海报生成器.html      单文件 Web UI（服务端直接托管它）
scripts/bootstrap.*      首次一键：Node 自检 + 便携版 + 启动
scripts/open-ui.mjs      日常启动，返回 URL
scripts/mcp.mjs          MCP server
scripts/render.mjs       批量出图
lib/                     服务 / UI 生命周期 / 渲染
templates/               示例与字段说明
USAGE.md                 WorkBuddy 两个场景的完整指引
SKILL.md                 agent 技能说明
```

## 说明

- 主路径是把整个目录作为 skill 使用；`培训海报生成器.html` 作为离线/应急的单文件方式。
- 打开工作台不需要 `npm install`；只有批量出图/MCP 的 render 需要。
- 隐私：页面带 CSP，禁止外部资源与连接；`npm run audit` 可验证。
