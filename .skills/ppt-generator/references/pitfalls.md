# 布局陷阱与修复指南

PptxGenJS 没有碰撞检测，元素重叠时不报错、不移位、完全无提示。本文件集中记录所有已知的布局问题、原因和修法。

---

## ⚠️ 高频问题（每次生成必查）

以下问题在每次生成中几乎必然出现，**在写任何幻灯片代码之前必须建立防御意识**。

### 1. 文字换行 / Text Wrapping

**根本原因**：`h` 是一个写死的数字，但实际文字行数由字号 × 内容长度 × 文本框宽度共同决定，运行时随内容变化。PptxGenJS 不会自动撑高文本框——文字超出 `h` 时直接被截断，或换行后挤压成多行。

**⚠️ 单行文本框尺寸警告**：任何预期只显示一行的文本框（**封面大标题、数字标注 `01`/`02`、卡片标题、图标标签等，不论字号大小**）都极易因 `w` 或 `h` 设置过小而意外换行。**最常见的错误是 `w = h`（正方形）——正方形对两位字符几乎总是不够宽，`0` 和 `1` 会各占一行。另一个常见错误是封面/章节大标题忘加 `margin: 0` 和 `shrinkText: true`，默认内边距会吃掉约 0.2" 有效宽度，大字号下极易换行。**

**⚠️ `shrinkText: true` 不能防止换行**：`shrinkText` 只收缩字号来适应**高度（h）**，不管**宽度（w）**。若 `w` 不够宽，文字会先换行（"0"/"2" 各占一行），然后两行都塞进 `h` 里，`shrinkText` 看到高度够就停止收缩——结果是字号正常但已换行。**防止换行的唯一手段是保证 `w` 足够宽。**

所有单行文本框必须同时满足：

- `h ≥ fontSize × 1.4 / 72 + 0.1`（经验值：14pt→0.37"，18pt→0.45"，24pt→0.57"，60pt→1.27"）
- `w ≥ 字符数 × fontSize × 0.75 / 72 + 0.2`（经验值：2字符18pt→0.53"，2字符24pt→0.65"，2字符60pt→1.45"）；**禁止 `w = h`**
- 必须加 `shrinkText: true`（防截断，但不防换行，前提是 w 已足够）
- **数字+单位组合（`95%`、`60%`、`$3B` 等）的 `w` 必须按完整字符串长度计算**，包含单位符号在内（`95%` = 3个字符）；漏算单位符号会导致 `%` 被挤到下一行

```javascript
// ❌ 错误：w = h = 0.5"，正方形，"01" 会断成两行
slide.addText("01", { w: 0.5, h: 0.5, fontSize: 24, ... });

// ✅ 正确：w 按字符公式算，明显宽于 h
slide.addText("01", {
  x: 0.3, y: 1.2,
  w: 0.75,   // 2字符×24pt：2×24×0.75/72+0.2 ≈ 0.70"，取 0.75" 留余量
  h: 0.55,   // 24pt×1.4/72+0.1 ≈ 0.57"
  fontSize: 24, bold: true, align: "center", valign: "middle",
  shrinkText: true, margin: 0,
});
```

**三档防御策略，必须选一档明确使用，不允许缺省**：

```javascript
// ① 固定位置标签（数字标注、卡片标题、图例）→ shrinkText
//    超出时自动缩小字号，保证单行不换行
slide.addText("可能偏长的标签", {
  x: 0.5, y: 1, w: 3, h: 0.4, fontSize: 12,
  shrinkText: true,   // ← 必须显式写
});

// ② 正文/说明段落 → autoFit
//    文本框高度随内容自动扩展，但要确保下方有足够空间
slide.addText("可能有很多行的正文内容...", {
  x: 0.5, y: 1.5, w: 8, h: 0.5, fontSize: 12,
  autoFit: true,      // ← 必须显式写
});

// ③ 已知行数的固定布局 → 手动计算 h
// 经验值：fontSize 10pt ≈ 0.19"/行，12pt ≈ 0.22"/行，14pt ≈ 0.26"/行
// 公式：h = 行数 × 行高 + 0.1（内边距余量）
const lines = 3, lineH = 0.26;   // fontSize 14pt
slide.addText("三行内容", { x: 0.5, y: 1, w: 8, h: lines * lineH + 0.1, fontSize: 14 });
```

| 场景                           | 必须用                                       |
| ------------------------------ | -------------------------------------------- |
| 单行标签（标题、编号、图例等） | `shrinkText: true` + `h ≥ fontSize×1.4+0.1"` |
| 正文、说明、动态内容           | `autoFit: true`                              |
| 已知行数的固定卡片             | 手动算 `h`                                   |

---

### 2. 文字超出背景方框 / Text Overflowing Background Shape

**根本原因**：PptxGenJS 里文字和背景形状是两个完全独立的元素，不存在"父子包含"关系。背景矩形只是视觉装饰，对文本框没有任何裁剪约束——文字超出文本框后会直接渲染到矩形外面。

**正确做法：文本框尺寸必须与背景形状严格绑定**：

```javascript
// ── 定义卡片尺寸（单一来源）──────────────────────────
const card = { x: 1, y: 1.5, w: 3.5, h: 1.8 };
const PADDING = 0.15;   // 文字与边框的内边距

// ── 背景形状 ─────────────────────────────────────────
slide.addShape(pres.shapes.RECTANGLE, {
  ...card,
  fill: { color: "F0F9FF" },
  line: { color: "BAE6FD", width: 1 },
});

// ── 文本框：从 card 尺寸减去内边距推导，不单独写数字 ─
slide.addText("卡片内容文字", {
  x: card.x + PADDING,
  y: card.y + PADDING,
  w: card.w - PADDING * 2,
  h: card.h - PADDING * 2,   // ← 必须从 card.h 推导，不写死
  fontSize: 11,
  shrinkText: true,           // ← 兜底保护，防止内容偶尔超长
});
```

**批量卡片时（网格、时间轴标注等）**：

```javascript
const cards = [
  { x: 0.5, y: 1.5, label: "项目A", value: "120%" },
  { x: 4.0, y: 1.5, label: "项目B", value: "89%" },
];
const CARD_W = 3.2, CARD_H = 1.6, PAD = 0.15;

cards.forEach(c => {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: c.x, y: c.y, w: CARD_W, h: CARD_H,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.08 },
  });
  slide.addText(c.label, {
    x: c.x + PAD, y: c.y + PAD,
    w: CARD_W - PAD * 2, h: 0.3,
    fontSize: 10, color: "64748B", shrinkText: true,
  });
  slide.addText(c.value, {
    x: c.x + PAD, y: c.y + PAD + 0.35,
    w: CARD_W - PAD * 2, h: CARD_H - PAD * 2 - 0.35,
    fontSize: 28, bold: true, color: "0F172A", shrinkText: true,
  });
});
```

**核查清单**：

- [ ] 每个文本框的 `x/y/w/h` 都从对应背景形状的变量推导，没有独立写死的数字
- [ ] 所有文本框都有 `shrinkText: true` 或 `autoFit: true` 兜底
- [ ] 生成后用 `markitdown` 抽取文本，确认内容完整没有截断

---

## 版面规划：写坐标之前必读

**所有元素的 `x`/`y` 坐标必须从命名变量推导，禁止写魔法数字。**

```javascript
// ── 页面常量 ──────────────────────────────────────────
const SW = 10;      // 幻灯片宽度
const SH = 5.625;   // 幻灯片高度（LAYOUT_16x9）
const PAD = 0.4;    // 页面边距

// ── 区域划分 ──────────────────────────────────────────
const TITLE_Y = PAD;
const TITLE_H = 0.6;
const BODY_Y  = TITLE_Y + TITLE_H + 0.2;       // 标题下方留间距
const BODY_H  = SH - BODY_Y - PAD - 0.35;      // 底部留给页码徽章
const BODY_X  = PAD;
const BODY_W  = SW - PAD * 2;

// ── 分栏时 ────────────────────────────────────────────
const GAP   = 0.3;
const COL_W = (BODY_W - GAP) / 2;
const COL1_X = BODY_X;
const COL2_X = BODY_X + COL_W + GAP;
```

**边界规则**：任何元素的 `y + h ≤ BODY_Y + BODY_H`，`x + w ≤ SW - PAD`。

### 开发期边界检查

```javascript
function assertBounds(label, x, y, w = 0, h = 0) {
  if (x + w > SW - PAD + 0.01) console.warn(`[overflow-x] ${label}`);
  if (y + h > SH - 0.3  + 0.01) console.warn(`[overflow-y] ${label}`);
}
// 放置每个元素前调用一次
assertBounds('chart', 0.5, 1, 9, 4);
```

---

## 文本框互相重叠

**根因**：同一区域内的多个文本框各自写死坐标，没有依存关系。任意一个框的尺寸调整后，相邻框的位置不跟着变，导致文字互相压住。PptxGenJS 不报错、不移位，直接叠加渲染。

**防御规则：同一行或同一列内，后一个框的起始坐标必须从前一个框推导。**

```javascript
// ── 横向并排（如徽章 + 标题）────────────────────────────
const A_X = 0.4, A_W = 0.75;   // 第一个框
const GAP = 0.15;
const B_X = A_X + A_W + GAP;   // ← 第二个框 x 从第一个推导，不写死
const B_W = containerW - B_X;  // 剩余宽度

// ── 进度条 + 右侧标签（超出右边界的典型场景）────────────
// ❌ 错误：barW 写死，没有为标签留空间，barX + barW + gap + labelW 超出 SW
const barW_wrong = 4.8;  // 飞出去

// ✅ 正确：先定右侧标签宽度，再倒推 barW
const BAR_X = 4.5, LABEL_W = 1.8, GAP2 = 0.15;
const BAR_W = SW - PAD - BAR_X - GAP2 - LABEL_W;  // 剩余空间全给 bar
// 标签：x = BAR_X + BAR_W + GAP2，w = LABEL_W，右边界 = SW - PAD ✓

// ── 纵向堆叠（如标题 + 副标题 + 正文）──────────────────
const TITLE_Y = 1.2, TITLE_H = 0.5;
const SUB_Y   = TITLE_Y + TITLE_H + 0.1;   // ← 从上一个框底部推导
const BODY_Y2 = SUB_Y + 0.3 + 0.1;

// ── 大数字卡片（数字 + 标签）────────────────────────────
// ❌ 常见错误：h 给不够 + 标签 y 独立写死，两者重叠
slide.addText("3,100", { y: cardY + 0.15, h: 0.45, fontSize: 48, shrinkText: true });
slide.addText("市场规模", { y: cardY + 0.55, h: 0.3 });  // 0.15+0.45=0.60，标签从0.55开始，重叠！

// ✅ 正确：h 给足，标签 y 从数字底部推导
const numY = cardY + 0.15;
const numH = 1.1;   // 48pt × 1.4/72 + 0.1 ≈ 1.03"，取 1.1"
slide.addText("3,100", { y: numY, h: numH, fontSize: 48, margin: 0, shrinkText: true });
const labelY = numY + numH + 0.05;   // ← 从底部推导，不写死
slide.addText("市场规模", { y: labelY, h: cardH - (labelY - cardY) - 0.05, ... });

// ── 批量元素（卡片、列表行）────────────────────────────
// 用循环 + 累积 y，不手动列出每个 y
let curY = BODY_Y;
items.forEach(item => {
  const itemH = 0.7;
  slide.addText(item.title, { x: BODY_X, y: curY, w: BODY_W, h: itemH, shrinkText: true });
  curY += itemH + 0.1;   // ← 每次累加，下一个自动避开
});
```

**核查清单**：

- [ ] 横向并排：右侧框的 `x = 左侧框x + 左侧框w + gap`
- [ ] 纵向堆叠：下方框的 `y = 上方框y + 上方框h + gap`
- [ ] 批量元素用累积变量 `curY`/`curX`，不手写每个坐标
- [ ] `gap ≥ 0.08"`（最小间距，低于此值视觉上几乎贴合）

---

## 文字换行与截断

**原因**：`h` 写死，但字号和内容长度在运行时浮动。

```javascript
// 固定位置标签（如数字标注、图例）→ shrinkText
slide.addText("较长标签", { x: 0.5, y: 1, w: 3, h: 0.4, fontSize: 12, shrinkText: true });

// 正文段落 → autoFit（文本框向下扩展）
slide.addText("较长内容...", { x: 0.5, y: 1, w: 8, h: 0.5, fontSize: 12, autoFit: true });

// 已知行数的固定布局 → 手动算 h
// 经验值：fontSize 12pt → 行高约 0.22"；14pt → 约 0.26"
// 公式：h = lineCount * lineHeight + 0.1
const h = 3 * 0.26 + 0.1;  // 14pt，3 行
slide.addText("三行文字", { x: 0.5, y: 1, w: 8, h, fontSize: 14 });
```

| 场景               | 方案               |
| ------------------ | ------------------ |
| 单行标签、数字标注 | `shrinkText: true` |
| 正文、说明段落     | `autoFit: true`    |
| 已知行数的固定布局 | 手动计算 `h`       |

---

## 表格溢出页面

**⚠️ `colW` 之和必须等于 `w`，否则表格超出右边界**：PptxGenJS 以 `colW` 为准渲染每列宽度，`w` 参数被忽略。若两者不一致，表格实际宽度 = `x + sum(colW)`，超出部分直接溢出幻灯片。

```javascript
// ❌ 错误：colW 合计 10.0"，但 w: 9.2"，表格右边界 = 0.4 + 10.0 = 10.4"，超出
s6.addTable(data, { x: 0.4, w: 9.2, colW: [3.2, 1.7, 1.7, 1.7, 1.7] });  // 3.2+1.7×4=10.0

// ✅ 正确：先定 w，再让 colW 之和等于 w
const TBL_W = SW - PAD * 2;  // 9.2"
s6.addTable(data, { x: PAD, w: TBL_W, colW: [3.0, 1.55, 1.55, 1.55, 1.55] });  // 合计 9.2"
```

**原因**：`addTable` 的 `h` 只是初始值，行数多时 PptxGenJS 自动撑高，不管页面边界。

```javascript
const ROW_H    = 0.28;   // 普通行（fontSize 10-11pt）
const HEADER_H = 0.35;   // 表头行
const startY   = 1.2;
const maxH     = SH - 0.35 - startY;   // 底部留页码徽章

// 生成前校验，超出则截断行数
const maxRows = Math.floor((maxH - HEADER_H) / ROW_H);
if (tableData.length - 1 > maxRows) {
  tableData = [tableData[0], ...tableData.slice(1, maxRows + 1)];
}

slide.addTable(tableData, {
  x: 0.5, y: startY, w: 9,
  rowH: ROW_H,          // 必须传，固定行高
  colW: [3, 3, 3],      // 各列之和等于 w
  fontSize: 10,
});
```

- 不传 `rowH` 时 PptxGenJS 按内容撑高，列多时极易超出
- 超过 8-10 行考虑缩小 `fontSize`（9-10pt）或拆成两张幻灯片

---

## 元素重叠通用规则

| 重叠类型       | 根因                                   | 修法                                |
| -------------- | -------------------------------------- | ----------------------------------- |
| 标题压正文     | `BODY_Y` 没从 `TITLE_Y + TITLE_H` 推导 | 用区域变量，不写死 y                |
| 正文超出底部   | `BODY_H` 没扣除底部徽章高度            | `BODY_H = SH - BODY_Y - PAD - 0.35` |
| 分栏元素互压   | 两栏 x 坐标重叠                        | `COL2_X = COL1_X + COL_W + GAP`     |
| 图表与标题重叠 | 图表 y 从 0 开始                       | 图表 y 必须 ≥ `BODY_Y`              |

---

## 时间轴：标注文字与轴线重叠

**根因**：轴线位置和标注 y 坐标各自写死，没有依存关系，改一个另一个不跟着动。

### 正确做法：全部从 AXIS_Y 推导

```javascript
const N       = 5;
const AXIS_Y  = 2.8;     // 轴线 y（垂直居中）
const AXIS_X1 = 0.8;
const AXIS_X2 = 9.2;
const DOT_R   = 0.12;    // 圆点半径
const STEM_H  = 0.35;    // 竖线长度（决定线与文字的间距，≥ 0.3"）
const LABEL_H = 0.5;     // 标注文字框高度
const LABEL_W = 1.4;     // 标注文字框宽度

const step = (AXIS_X2 - AXIS_X1) / (N - 1);

// 生成前校验：标注框不能比节点间距更宽
if (LABEL_W > step - 0.1) throw new Error(`LABEL_W ${LABEL_W} > step ${step}, 相邻标注会重叠`);

const nodes = Array.from({ length: N }, (_, i) => ({
  x: AXIS_X1 + i * step,
  year: `${2018 + i * 2}`,
  desc: "描述文字",
  above: i % 2 === 0,   // 奇偶交替，防相邻标注水平挤压
}));

// 轴线
slide.addShape(pres.shapes.LINE, {
  x: AXIS_X1, y: AXIS_Y, w: AXIS_X2 - AXIS_X1, h: 0,
  line: { color: "94A3B8", width: 2 },
});

nodes.forEach(node => {
  const dir = node.above ? -1 : 1;

  // 圆点
  slide.addShape(pres.shapes.OVAL, {
    x: node.x - DOT_R, y: AXIS_Y - DOT_R, w: DOT_R * 2, h: DOT_R * 2,
    fill: { color: "2563EB" }, line: { color: "2563EB" },
  });

  // 竖线：从圆边缘出发，终点 = 起点 + STEM_H
  const stemStart = AXIS_Y + dir * DOT_R;
  const stemEnd   = stemStart + dir * STEM_H;
  slide.addShape(pres.shapes.LINE, {
    x: node.x, y: Math.min(stemStart, stemEnd), w: 0, h: STEM_H,
    line: { color: "CBD5E1", width: 1 },
  });

  // 标注：紧接竖线终点，永远不会压线
  const labelY = node.above ? stemEnd - LABEL_H : stemEnd;
  slide.addText([
    { text: node.year, options: { bold: true, breakLine: true, fontSize: 11 } },
    { text: node.desc, options: { fontSize: 9 } },
  ], {
    x: node.x - LABEL_W / 2, y: labelY, w: LABEL_W, h: LABEL_H,
    align: "center", valign: node.above ? "bottom" : "top",
    shrinkText: true,
  });
});
```

### 时间轴重叠速查

| 重叠类型         | 原因             | 修法                                                  |
| ---------------- | ---------------- | ----------------------------------------------------- |
| 标注压在轴线上   | `STEM_H` 太小    | `STEM_H ≥ 0.3"`                                       |
| 相邻标注水平重叠 | `LABEL_W > step` | 缩小 `LABEL_W` 或减少节点数                           |
| 上方标注超出顶部 | `AXIS_Y` 太靠上  | `AXIS_Y ≥ BODY_Y + STEM_H + LABEL_H`                  |
| 下方标注超出底部 | `AXIS_Y` 太靠下  | `AXIS_Y + DOT_R + STEM_H + LABEL_H ≤ SH - PAD - 0.35` |

---

## 流程图 / 步骤图：节点、连线、箭头坐标必须联动

**根因**：节点圆圈、水平连线、箭头各自写死坐标，修改节点数量或间距时其他元素不跟着动，导致连线与节点错位、箭头悬空或穿透圆圈。

**正确做法：全部从同一组命名变量推导**：

```javascript
const N        = 5;       // 步骤数
const ROW_Y    = 1.6;     // 圆圈圆心 y（横向流程图）
const START_X  = 0.9;     // 第一个圆心 x
const END_X    = 9.1;     // 最后一个圆心 x
const CIRCLE_R = 0.35;    // 圆圈半径
const ARROW_W  = 0.18;    // 箭头图标宽度（若用图片/形状）

const step = (END_X - START_X) / (N - 1);   // 节点间距

// ── 连线 + 箭头（必须在圆圈之前绘制，否则会盖住圆圈）──
for (let i = 0; i < N - 1; i++) {
  const lineX1 = START_X + i * step + CIRCLE_R;        // 从圆边缘出发
  const lineX2 = START_X + (i + 1) * step - CIRCLE_R; // 到下一个圆边缘
  const lineW  = lineX2 - lineX1;
  const midX   = lineX1 + lineW / 2 - ARROW_W / 2;    // 箭头居中

  // 连线
  slide.addShape(pres.shapes.LINE, {
    x: lineX1, y: ROW_Y, w: lineW, h: 0,
    line: { color: "94A3B8", width: 2 },
  });

  // 箭头（用形状三角形或图标）
  slide.addShape(pres.shapes.TRIANGLE, {   // 或换成图标图片
    x: midX, y: ROW_Y - 0.08, w: ARROW_W, h: 0.16,
    fill: { color: "94A3B8" }, line: { color: "94A3B8", width: 0 },
    rotate: 90,
  });
}

// ── 圆圈节点（在连线之后绘制，覆盖多余线段）──
for (let i = 0; i < N; i++) {
  const cx = START_X + i * step;
  slide.addShape(pres.shapes.OVAL, {
    x: cx - CIRCLE_R, y: ROW_Y - CIRCLE_R,
    w: CIRCLE_R * 2, h: CIRCLE_R * 2,
    fill: { color: "1E3A5F" }, line: { color: "F4A300", width: 3 },
  });
  slide.addText(String(i + 1), {
    x: cx - CIRCLE_R, y: ROW_Y - CIRCLE_R,
    w: CIRCLE_R * 2, h: CIRCLE_R * 2,
    fontSize: 18, bold: true, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0,
    shrinkText: true,
  });
}
```

**核查清单**：

- [ ] 连线的 `x` 起止点从 `CIRCLE_R` 推导，不写死
- [ ] 箭头/分隔符的 x 从连线中点推导，不单独写数字
- [ ] 节点下方说明文字的 x 从圆心 x 推导（`cx - LABEL_W / 2`）
- [ ] 增减节点数（N）后，所有坐标自动适应
- [ ] 连线和箭头在圆圈**之前**绘制（Z 轴顺序）

---

## 图表已知 Bug

### 饼图缺块

`values` 中有 `0` 时 PptxGenJS 生成面积为 0 的扇区，PowerPoint 渲染为缺口。

```javascript
// 生成前过滤 0 值
const data = rawData.filter(d => d.value > 0);
slide.addChart(pres.charts.PIE, [{
  name: "占比",
  labels: data.map(d => d.label),
  values: data.map(d => d.value),
}], { x: 2.5, y: 1, w: 4.5, h: 4.5, showPercent: true });
// w:h 保持 1:1，否则圆形压扁成椭圆
```

### 折线图点线质量差

```javascript
slide.addChart(pres.charts.LINE, chartData, {
  lineSize: 3,       // 默认太细，用 2-4
  lineSmooth: true,  // 消除锯齿
  showPoint: true,   // ⚠️ 默认关闭，不设则线条"悬空"无端点
  valAxisMinVal: 0,  // 防止 y 轴范围过大压平趋势
});
```

### 散点图点线分离/错位

`SCATTER` 的数据格式与其他图表不同，`labels` 字段被忽略，必须用 `{x, y}` 对象数组。

```javascript
// ❌ 错误：labels+values 格式在 SCATTER 中 x 坐标丢失，点全落在 x=0
slide.addChart(pres.charts.SCATTER, [{ labels: ["1","2"], values: [10, 20] }], {});

// ✅ 正确
slide.addChart(pres.charts.SCATTER, [{
  name: "系列1",
  values: [{ x: 1, y: 10 }, { x: 2, y: 25 }, { x: 3, y: 18 }]
}], {
  lineSize: 0,      // 0 = 纯散点；> 0 = 点+线
  showPoint: true,
});
```