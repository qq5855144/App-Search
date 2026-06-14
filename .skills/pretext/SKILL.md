---
name: pretext
description: 使用 @chenglou/pretext 创建浏览器创意文本布局 demo，适用于 ASCII art、文本绕障碍流动、text-as-geometry 游戏、kinetic typography、文本粒子和单文件 HTML generative art。
license: MIT
---

# Pretext Skill

## 能力概述

使用 `@chenglou/pretext` 创建浏览器里的创意文本布局 demo。它不是通用排版引擎，也不是富文本编辑器；它专注于 DOM-free multiline text measurement and layout：给定 text、font、width，返回 line breaks、line widths、per-grapheme positions 和 height，避免 DOM reflow。

默认输出单文件 HTML demo：无构建步骤，通过 Canvas 2D、`Intl.Segmenter` 和 raw DOM events 实现可打开、可交互的文本视觉实验。

## When to Use

适合用户请求：

- “pretext demo” / “cool pretext thing” / “text-as-X”
- 文本围绕移动形状、光球、sprite、ASCII object 流动
- 使用真实文字或 prose 做 ASCII-art / typography generative art
- text-as-geometry games，例如 word bricks、Tetris-from-letters、Breakout-of-prose
- kinetic typography、逐 glyph physics、shatter、scatter、flock、flow
- editorial layout、多列文章、pull quote 周围绕排
- multiline shrink-wrap UI、quote card、chat bubble tight sizing
- 需要在渲染前知道 line breaks、line widths 或 per-grapheme positions

不适合：

- 静态 SVG/HTML 页面且 CSS 已足够解决布局
- 富文本编辑器或通用 inline formatting engine
- 图片转文本/视频转 ASCII
- 没有文本参与的纯 canvas generative art

## Prerequisites

默认使用 CDN 引入，不需要本地安装：

```html
<script type="module">
import {
  prepare,
  layout,
  prepareWithSegments,
  layoutWithLines,
  layoutNextLineRange,
  materializeLineRange,
  measureLineStats,
  walkLineRanges,
} from "https://esm.sh/@chenglou/pretext@0.0.6";
</script>
```

保持版本 pinned。默认使用 `@chenglou/pretext@0.0.6`；如果 demo 行为异常，再检查 npm 最新版本。

## Quick Reference

| 需求 | API / 文件 |
|------|------------|
| 只测量高度、行数 | `prepare()` + `layout()` |
| 自己渲染文本行 | `prepareWithSegments()` + `layoutWithLines()` |
| 每一行宽度不同、文本绕障碍 | `layoutNextLineRange()` + `materializeLineRange()` |
| 无字符串分配地遍历行 | `walkLineRanges()` |
| tight quote card / chat bubble | `measureLineStats()` |
| 常见创意模式 | `references/patterns.md` |
| 最小可运行 starter | `templates/hello-orb-flow.html` |
| 高级 ASCII obstacle demo | `templates/donut-orbit.html` |

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Core | `@chenglou/pretext` via `esm.sh` | 文本测量和 line layout |
| Render | HTML5 Canvas 2D | glyph rendering、composition、animation |
| Segmentation | `Intl.Segmenter` | emoji、CJK、combining marks 的 grapheme splitting |
| Interaction | Raw DOM events | mouse、touch、wheel，无框架 |

## 核心用法

### Use-case 1：measure, then render with CSS/DOM

让浏览器负责渲染，Pretext 只告诉你给定宽度下盒子会有多高、多少行。

```js
const prepared = prepare(text, "16px Inter");
const { height, lineCount } = layout(prepared, 320, 20);
```

适合 virtualized lists、masonry height、label fit checks、避免 remote text 造成 layout shift。

关键点：`font` 和 `letterSpacing` 必须与 CSS 渲染完全同步，否则测量漂移。

### Use-case 2：measure and render yourself

你自己画文本，因此可以把每一行、每个 glyph 当作几何数据使用。

```js
const prepared = prepareWithSegments(text, FONT);
const { lines } = layoutWithLines(prepared, 320, 26);

for (let i = 0; i < lines.length; i++) {
  ctx.fillText(lines[i].text, 0, i * 26);
}
```

### Variable-width flow

这是 Pretext 最重要的创意模式：每一行根据 `y` 位置得到不同可用宽度，让文字实时绕开移动形状。

```js
const prepared = prepareWithSegments(TEXT, FONT);
let cursor = { segmentIndex: 0, graphemeIndex: 0 };
let y = 0;

while (true) {
  const lineWidth = widthAtY(y);
  const range = layoutNextLineRange(prepared, cursor, lineWidth);
  if (!range) break;

  const line = materializeLineRange(prepared, range);
  ctx.fillText(line.text, leftEdgeAtY(y), y);

  cursor = range.end;
  y += lineHeight;
}
```

如果某一行的 corridor 太窄，不要传很小的 maxWidth；应跳过这一行，否则会出现 one-grapheme lines。

## Procedure

1. 先根据 brief 选 pattern，优先查 `references/patterns.md`。
2. 从模板起步：
   - `templates/hello-orb-flow.html`：文本围绕移动 orb 流动。
   - `templates/donut-orbit.html`：高级 ASCII logo obstacle / draggable wire shape / morphing fields。
3. 换成与用户主题相关的真实语料，避免 `lorem ipsum`。
4. 调整 aesthetic：font、palette、composition、motion、interaction。
5. 生成单文件 `.html`，放在用户 workspace 或指定路径。
6. 本地验证：

```bash
python3 -m http.server 8765
```

然后打开对应 HTML。交付时给用户文件路径，不要只贴代码。

## Creative Standard

- 不交付 “hello world” 级 demo；模板只是起点。
- first paint 必须可看，不要空白 loading。
- 使用有意义的真实文本：manifesto、poetry、source code、brief 相关材料。
- 明确 palette：dark background、warm core、editorial charcoal、risograph pastel 等，选一个并坚持。
- Pretext 的重点是 proportional text measurement；不要默认做成普通 monospace raster。
- 至少加入一个交互或自动运动：drag、hover、scroll、click、idle orbital motion。
- 加一个用户没明确要求但符合主题的细节，例如 vignette、scanline、cursor、particle trail、subtle glow。

## Performance

- `prepare()` / `prepareWithSegments()` 对同一个 text+font 只调用一次并缓存。
- resize 时只重新跑 `layout()` / `layoutWithLines()`。
- 几何障碍物每帧变化时，可以每帧跑 `layoutNextLineRange()`。
- Canvas `ctx.font` 设置较慢；同一帧字体不变时设置一次即可。
- ASCII masks 使用 `Uint8Array` 或 typed arrays 管理 cell buffer。
- 视觉动画和 layout geometry 要耦合；如果形状 morph，obstacle spans 也要同一个 mix 值 morph。
- fade 视觉层时，优先用独立 canvas/CSS opacity，不要让 collision geometry 看起来一起缩小。

## Pitfalls

1. **CSS/canvas font string 漂移**：`ctx.font` 与 CSS font 不一致会导致 line breaks 错位。
2. **动画循环里重复 prepare**：`prepare*` 昂贵，`layout*` 才适合反复跑。
3. **错误拆分 grapheme**：emoji、CJK、combining marks 不要用 `.split("")`，用 `Intl.Segmenter`。
4. **CDN 选择错误**：浏览器里用 `esm.sh`，不要用可能返回 raw TS 的 unpkg 入口。
5. **fallback font 破坏效果**：字体加载失败会让测量和视觉不一致。
6. **绕障碍时强行压窄行宽**：过窄时跳过行，而不是让 Pretext 输出单字行。
7. **demo 太冷**：没有颜色、构图、运动和交互时，看起来像 README 复刻。

## Verification

交付前检查：

- [ ] 是单文件 `.html` demo。
- [ ] 使用 `https://esm.sh/@chenglou/pretext@0.0.6` pinned import。
- [ ] 文本语料是真实内容，不是 lorem ipsum。
- [ ] `prepare()` / `prepareWithSegments()` 没有放在 animation loop 里。
- [ ] canvas `FONT` 与实际 CSS/font face 匹配。
- [ ] dark/considered palette，first paint 可看。
- [ ] 至少有交互或 idle motion。
- [ ] 本地打开无 console error。
- [ ] 给用户可打开的文件路径。
