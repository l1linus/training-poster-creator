---
name: training-poster
description: 生成竖版培训/课程宣传海报 PNG（培训海报、课程海报、活动海报、promotion poster），或打开海报编辑 Web UI 供人工调整。当用户说“开始生成培训海报 / 做一张培训海报 / 做张海报 / 生成宣传图 / 导出 PNG / 改配色再出一版”，或要求“打开海报编辑器 / 工作台 / 预览界面自己调”时使用。默认打开 Web UI 让用户自己调，只有明确批量/无人值守才直接出图。支持线上与线下培训、北京时间自动换算欧中/美西/美东、按主色自定义配色；输出 750px 宽、默认 2 倍图（1500px 宽）的 PNG。
---

# 培训海报生成器（本地渲染）

把结构化培训信息渲染成一张竖版科技风海报 PNG。**不依赖飞书妙搭运行时，不需要登录、不需要网络接口**；只在本机起一个临时静态服务，用无头浏览器截图。

## 默认行为（重要）

用户说「开始生成培训海报」「做一张培训海报」「打开海报工作台」时，**默认打开 Web UI**，不要调用 `render_poster`，也不要先追问参数。

**启动流程（每次都用同一个入口，幂等）：**

- Windows：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`
- macOS / Linux：`bash scripts/bootstrap.sh`

脚本会检测 Node（缺失时下载便携版到 `.runtime/`）→ 启动工作台 → 返回 `{ ok, url }`。把 `url` 打开给用户；打不开就把链接发给他。

只有用户明确说「批量 / 不用看界面 / 直接给我图片 / 生成 N 张」时，才用 `render_poster` / `render.mjs`。

## 能做什么

- **打开完整 Web UI**：`npm run ui`（或 `node scripts/open-ui.mjs`）在后台起服务、返回 URL；用户在界面里选模板/配色、填表、裁剪照片、实时预览、导出 PNG。这是需要人工调整时的首选。
- 输入 JSON → 输出 PNG：`node scripts/render.mjs --data job.json --out poster.png`（批量/无人值守用）
- 讲师照片、报名二维码：直接传本地图片路径，脚本自动转 dataURL
- 北京时间自动换算欧中/美西/美东，并标注夏令时/冬令时
- 三种配色：内置深蓝科技（默认）、按素材图配色、手动指定主色/强调色
- 给人用的交互式 Web UI：`node scripts/preview.mjs`
- MCP server：`node scripts/mcp.mjs`（Claude Desktop / Cursor / DSH 等可直接挂载）

## 接入方式

1. 能执行命令的 agent：先跑 `bootstrap.ps1` / `bootstrap.sh` 把工作台 URL 给用户；只有批量/无人值守才跑 `render.mjs`。
2. 支持 MCP 的客户端：`open_editor` 打开工作台，`render_poster` 批量出图（见文末）。
3. 支持 `SKILL.md` 的运行时（DSH / Claude Code 等）：把整个目录放进 skills 目录。

## 何时打开工作台

| 用户意图 | 动作 |
|---|---|
| 想挑模板、改配色、看预览、自己微调 | `open_editor` / `open-ui.mjs`，把 URL 给用户 |
| 批量、定时、无人值守出图 | `render_poster` / `render.mjs` |
| 只问“能不能做/怎么用” | 说明两种方式，默认推荐打开工作台 |

打开工作台后**不要**再调用 `render_poster` 替用户出图，也不要修改 `培训海报生成器.html`；等用户自己导出。

## 隐私

- 无账号、无数据库；表单内容、照片、二维码只在本机内存和 `127.0.0.1` 临时服务中处理。
- 构建产物已移除妙搭注入的 Slardar / Tea / 性能监控脚本，并加 CSP 禁止外部资源与外部 connect。
- 不请求远程字体，使用系统字体；`http(s)` 外链图片会被拒绝并写入 `warnings`。
- 打开工作台不需要联网；只有首次 `bootstrap` 在缺 Node 时需要下载便携版，`npm install` 需要下载 playwright-core。

## 前置条件

- Node.js ≥ 20：**可以不预装**，首次运行 `bootstrap` 会在缺失时下载便携版到 `.runtime/`
- 打开工作台只需要系统浏览器（Edge/Chrome/Safari 均可）
- 批量出图 / MCP 的 `render_poster` 才需要 `npm install`（playwright-core）和 Edge/Chrome

## 首次使用（别人电脑）

```powershell
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

```bash
# macOS / Linux
bash scripts/bootstrap.sh
```

流程：检测 Node → 缺失则下载便携版（约 35 MB，不装进系统）→ 启动工作台 → 输出 `{ ok, url, pid }`。
拿到 `url` 后交给用户的浏览器/WorkBuddy 预览面板打开。

## 自检

```bash
npm install                        # 仅批量出图/MCP 需要
node scripts/doctor.mjs            # 环境检查: Node / app / playwright-core / 浏览器
node scripts/doctor.mjs --render   # 再真实渲染一张自检图
node scripts/test.mjs              # 端到端: 渲染示例 + MCP 握手
node scripts/audit.mjs             # 隐私: 无监控脚本、无成功的外网请求
```

两者都输出 JSON，`ok: true` 表示可用；失败时 `checks` 里会指出哪一项不满足。

## 快速开始

```bash
# 1. 打开工作台（需要人工调整时优先）
npm run ui

# 2. 渲染示例（批量/无人值守）
node scripts/render.mjs --data templates/example.json --out out/poster.png

# 2. 内联 JSON（适合 agent 一次调用）
node scripts/render.mjs --json '{"form":{"topic":"读懂客户","trainingDate":"2026-12-16","timeBeijing":"19:00","timeBeijingEnd":"20:00"}}' --out out/poster.png

# 3. 3 倍图
node scripts/render.mjs --data job.json --out poster.png --scale 3

# 4. 打开交互式工作台（左侧填表、右侧预览、导出 PNG）
node scripts/preview.mjs --port 4173
```

脚本向 stdout 输出 JSON：

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

失败时输出 `{ "ok": false, "error": "..." }` 并以退出码 1 结束。

## 输入格式

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

### form 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `topic` | string | **是** | 主标题，建议 10–20 字；过长会换行、海报变高 |
| `seriesName` | string | 否 | 顶部系列名，如「产品运营训练营-第18场」 |
| `courseFormat` | string | 否 | `线上培训`（默认）/ `线下培训` |
| `trainingLocation` | string | 线下必填 | 线下培训时显示在右下角（替代二维码） |
| `instructorName` | string | 否 | 讲师姓名 |
| `instructorBio` | string | 否 | 讲师简介/部门 |
| `instructorPhoto` | string | 否 | 本地路径或 dataURL（不支持外链）；留空用内置剪影 |
| `highlights` | string[] | 否 | 每条一张卡片，建议 2–4 条、单条 ≤ 30 字 |
| `targetAudience` | string | 否 | 适合对象 |
| `trainingDate` | string | 否 | `YYYY-MM-DD`，海报显示「M月d日」并用于时区换算 |
| `timeBeijing` | string | 否 | `HH:mm`，北京时间开始 |
| `timeBeijingEnd` | string | 否 | `HH:mm`，北京时间结束 |
| `includeEuropeTime` | boolean | 否 | 默认 `true`，显示欧中时间 |
| `includeUsWestTime` | boolean | 否 | 默认 `false`，显示美西时间 |
| `includeUsEastTime` | boolean | 否 | 默认 `false`，显示美东时间 |
| `qrcodeImage` | string | 否 | 本地路径或 dataURL（不支持外链）；线上培训留空会显示占位 |
| `signupLink` | string | 否 | 仅用于宣传文案，不出现在海报 |

### template 字段（可选）

- `{"mode":"blue"}`：内置深蓝科技配色（默认）
- `{"mode":"manual","manualStyle":{"primaryColor":"#1A2F4A","secondaryColor":"#45E2EA"}}`：手动配色
- `{"mode":"custom","style":{...}}`：按素材图识别出的配色（`style` 结构同上）

图片字段的相对路径规则：`--data job.json` 时按 **job.json 所在目录** 解析；`--json` 和内联调用按 **当前工作目录** 解析。Windows 路径建议用正斜杠 `C:/photos/a.jpg`，避免 JSON 转义问题。

## 规则与限制

- **附加时区最多 2 个**，优先顺序：欧中 → 美西 → 美东
- `courseFormat=线下培训` 时 `trainingLocation` 必填，否则直接报错
- 海报宽度固定 750px，高度随内容变化（约 1100–1700），不是固定 9:16；需要固定比例请自行裁切/留白
- 字体使用系统字体（PingFang SC / 微软雅黑），不请求外网；不同系统字形略有差异
- 输出为 PNG，无透明背景；扩展名不是 `.png` 时只给 warning，内容仍是 PNG
- 图片只支持本地路径或 dataURL；`http(s)` 外链会被拒绝并写入 `warnings`
- 图片路径不存在或格式不支持时不会报错，会按“未提供”处理并写入 `warnings`

## 常见错误

| 报错 | 处理 |
|---|---|
| `缺少必填字段 form.topic` | 补 `topic` |
| `courseFormat 为“线下培训”时必须填写 trainingLocation` | 补地点，或改成线上培训 |
| `ERR_MODULE_NOT_FOUND: playwright-core` | 在技能目录执行 `npm install` |
| `没有可用的浏览器` | 安装 Edge/Chrome；或设 `POSTER_BROWSER`、传 `--browser` 指定路径 |
| 图片变成文字路径 | 路径不存在、格式不支持或用了外链；看 `warnings` 并改成本地文件 |

## MCP（可选）

```bash
node scripts/mcp.mjs
```

提供五个工具：

- `open_editor({ port?, host? })`：启动完整 Web UI，返回 `url` / `pid`；需要人工调整时用这个
- `close_editor()`：关闭工作台
- `editor_status()`：查看是否在运行
- `render_poster({ job, out?, scale? })`：批量出图；省略 `out` 时写到系统临时目录
- `describe_poster_fields()`：返回字段说明

`open_editor` 要求 MCP 客户端与工具在同一台机器；云端客户端访问不到返回的 `127.0.0.1` 地址。

在支持 MCP 的客户端里配成 stdio server（`args` 用绝对路径）：

```json
{
  "mcpServers": {
    "training-poster": {
      "command": "node",
      "args": ["<技能目录绝对路径>/scripts/mcp.mjs"]
    }
  }
}
```

Windows 上如果客户端找不到 `node`，把 `command` 换成 `node.exe` 的绝对路径。

## 目录

```
SKILL.md                 本说明
培训海报生成器.html       单文件 Web 应用(双击可用; 服务端用 /#/render 渲染)
lib/server.mjs           单文件静态服务(暴露 /__job.json、/__health)
lib/open-browser.mjs     用系统浏览器打开 URL
lib/ui.mjs               工作台启动/复用/关闭
lib/browser.mjs          跨平台查找 Edge/Chrome
lib/render-poster.mjs    渲染核心(校验 + 截图 + PNG 尺寸校验)
scripts/render.mjs       CLI: JSON -> PNG
scripts/bootstrap.ps1    首次一键(Windows): 检测/下载 Node + 启动工作台
scripts/bootstrap.sh     首次一键(macOS/Linux)
scripts/preview.mjs      前台启动 Web UI(阻塞)
scripts/open-ui.mjs      后台启动工作台并返回 URL
scripts/close-ui.mjs     关闭工作台
scripts/status-ui.mjs    查看工作台状态
scripts/mcp.mjs          MCP stdio server
scripts/doctor.mjs       环境自检
scripts/test.mjs         端到端自测
scripts/audit.mjs        隐私自检(无外部脚本/无成功外网请求)
USAGE.md                 使用指引(含 WorkBuddy 接入)
templates/example.json   可直接跑的示例
templates/fields.json    字段说明
```

UI 是单文件构建（Vite standalone、hash 路由）。改版式后需从原妙搭源码重新生成 `培训海报生成器.html`。

