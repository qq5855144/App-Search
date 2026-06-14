# PptxGenJS 教程

> 本文件是 API 速查参考。注意，各种有关布局陷阱、重叠/溢出修复、图表 Bug 见 [pitfalls.md](pitfalls.md)，这是你在撰写js文件之前的必读文档。

## 基础设置与结构

```javascript
const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';  // 或 'LAYOUT_16x10', 'LAYOUT_4x3', 'LAYOUT_WIDE'
pres.author = '作者姓名';
pres.title = '演示文稿标题';

let slide = pres.addSlide();
slide.addText("Hello World!", { x: 0.5, y: 0.5, fontSize: 36, color: "363636" });

pres.writeFile({ fileName: "Presentation.pptx" });
```

## 布局尺寸

幻灯片尺寸（坐标单位为英寸）：
- `LAYOUT_16x9`：10" × 5.625"（默认）
- `LAYOUT_16x10`：10" × 6.25"
- `LAYOUT_4x3`：10" × 7.5"
- `LAYOUT_WIDE`：13.3" × 7.5"

---

## 文字与格式

```javascript
// 基础文字
slide.addText("简单文字", {
  x: 1, y: 1, w: 8, h: 2, fontSize: 24, fontFace: "Arial",
  color: "363636", bold: true, align: "center", valign: "middle"
});

// 字符间距（使用 charSpacing，letterSpacing 会被静默忽略）
slide.addText("间距文字", { x: 1, y: 1, w: 8, h: 1, charSpacing: 6 });

// 富文本数组
slide.addText([
  { text: "加粗 ", options: { bold: true } },
  { text: "斜体 ", options: { italic: true } }
], { x: 1, y: 3, w: 8, h: 1 });

// 多行文字（需要 breakLine: true）
slide.addText([
  { text: "第一行", options: { breakLine: true } },
  { text: "第二行", options: { breakLine: true } },
  { text: "第三行" }
], { x: 0.5, y: 0.5, w: 8, h: 2 });

// 文本框内边距
slide.addText("标题", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  margin: 0  // 需要与形状或图标精确对齐时设为 0
});

// 防止文字换行：固定标签用 shrinkText，段落用 autoFit（详见 pitfalls.md）
slide.addText("标签", { x: 0.5, y: 1, w: 3, h: 0.4, fontSize: 12, shrinkText: true });
```

**提示：** 文本框默认有内边距。需要文字与形状、线条或图标在同一 x 位置精确对齐时，设置 `margin: 0`。

---

## 列表与项目符号

```javascript
// ✅ 正确：多个项目符号
slide.addText([
  { text: "第一项", options: { bullet: true, breakLine: true } },
  { text: "第二项", options: { bullet: true, breakLine: true } },
  { text: "第三项", options: { bullet: true } }
], { x: 0.5, y: 0.5, w: 8, h: 3 });

// ❌ 错误：不要使用 Unicode 项目符号
slide.addText("• 第一项", { ... });  // 会产生双重项目符号

// 子项和编号列表
{ text: "子项", options: { bullet: true, indentLevel: 1 } }
{ text: "第一", options: { bullet: { type: "number" }, breakLine: true } }
```

---

## 形状

```javascript
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 0.8, w: 1.5, h: 3.0,
  fill: { color: "FF0000" }, line: { color: "000000", width: 2 }
});

slide.addShape(pres.shapes.OVAL, { x: 4, y: 1, w: 2, h: 2, fill: { color: "0000FF" } });

slide.addShape(pres.shapes.LINE, {
  x: 1, y: 3, w: 5, h: 0, line: { color: "FF0000", width: 3, dashType: "dash" }
});

// 带透明度
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "0088CC", transparency: 50 }
});

// 圆角矩形（⚠️ 不要与强调边框叠加，详见 pitfalls.md）
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" }, rectRadius: 0.1
});

// 带阴影（offset 必须为非负数，否则损坏文件）
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" },
  shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.15 }
});
```

阴影参数说明：

| 属性 | 类型 | 范围 | 备注 |
|----------|------|-------|-------|
| `type` | 字符串 | `"outer"`、`"inner"` | |
| `color` | 字符串 | 6位十六进制（如 `"000000"`） | 不加 `#` 前缀，不用 8 位十六进制——见常见陷阱 |
| `blur` | 数字 | 0-100 pt | |
| `offset` | 数字 | 0-200 pt | **必须为非负数**——负值会损坏文件 |
| `angle` | 数字 | 0-359 度 | 阴影投射方向（135 = 右下，270 = 向上） |
| `opacity` | 数字 | 0.0-1.0 | 用此属性控制透明度，不要编码在颜色字符串中 |

向上投影阴影（如底部栏）时，使用 `angle: 270` 加正数 offset——**不要**用负数 offset。

**注意**：不原生支持渐变填充。需要渐变时，用渐变图片作为背景。

---

## 图片

### 图片来源

```javascript
// 来自文件路径
slide.addImage({ path: "images/chart.png", x: 1, y: 1, w: 5, h: 3 });

// 来自 URL
slide.addImage({ path: "https://example.com/image.jpg", x: 1, y: 1, w: 5, h: 3 });

// 来自 base64（更快，无文件 I/O）
slide.addImage({ data: "image/png;base64,iVBORw0KGgo...", x: 1, y: 1, w: 5, h: 3 });
```

### 图片选项

```javascript
slide.addImage({
  path: "image.png",
  x: 1, y: 1, w: 5, h: 3,
  rotate: 45,              // 0-359 度
  rounding: true,          // 圆形裁剪
  transparency: 50,        // 0-100
  flipH: true,             // 水平翻转
  flipV: false,            // 垂直翻转
  altText: "描述文字",      // 无障碍
  hyperlink: { url: "https://example.com" }
});
```

### 图片尺寸模式

```javascript
// 包含——适应容器，保持比例
{ sizing: { type: 'contain', w: 4, h: 3 } }

// 覆盖——填满区域，保持比例（可能裁剪）
{ sizing: { type: 'cover', w: 4, h: 3 } }

// 裁剪——截取特定部分
{ sizing: { type: 'crop', x: 0.5, y: 0.5, w: 2, h: 2 } }
```

### 支持格式

- **标准格式**：PNG、JPG、GIF（动态 GIF 在 Microsoft 365 中有效）
- **SVG**：在现代 PowerPoint/Microsoft 365 中有效

**保持宽高比：**
```javascript
const origWidth = 1978, origHeight = 923, maxHeight = 3.0;
const calcWidth = maxHeight * (origWidth / origHeight);
slide.addImage({ path: "image.png", x: (10 - calcWidth) / 2, y: 1.2, w: calcWidth, h: maxHeight });
```

支持格式：PNG、JPG、GIF、SVG（现代 PowerPoint）。

---

## 图标

使用 react-icons 生成 SVG 图标，再光栅化为 PNG 以确保兼容性。

### 安装

```bash
npm install react-icons react react-dom sharp
```

```javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheckCircle, FaChartLine } = require("react-icons/fa");

function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}
```

### 添加图标到幻灯片

```javascript
const iconData = await iconToBase64Png(FaCheckCircle, "#4472C4", 256);

slide.addImage({
  data: iconData,
  x: 1, y: 1, w: 0.5, h: 0.5  // 单位英寸
});
```

**注意**：使用 256 或更高的 size 参数可获得清晰图标。size 控制光栅化分辨率，而非幻灯片上的显示大小（显示大小由 `w` 和 `h` 的英寸值决定）。

### 图标库

react-icons 中常用图标集：
- `react-icons/fa` — Font Awesome
- `react-icons/md` — Material Design
- `react-icons/hi` — Heroicons
- `react-icons/bi` — Bootstrap Icons

---

## 幻灯片背景

```javascript
slide.background = { color: "F1F1F1" };
slide.background = { color: "FF3399", transparency: 50 };
slide.background = { data: "image/png;base64,iVBORw0KGgo..." };
```

---

## 表格

```javascript
slide.addTable([
  ["标题1", "标题2"],
  ["单元格1", "单元格2"]
], {
  x: 0.5, y: 1.2, w: 9,
  rowH: 0.28,           // 必须传，否则行数多时溢出页面（详见 pitfalls.md）
  colW: [4.5, 4.5],     // 各列宽之和必须等于 w
  fontSize: 10,
  border: { pt: 0.5, color: "E2E8F0" },
  fill: { color: "F8FAFC" }
});

// 高级用法（含合并单元格）
let tableData = [
  [{ text: "标题", options: { fill: { color: "6699CC" }, color: "FFFFFF", bold: true } }, "单元格"],
  [{ text: "合并", options: { colspan: 2 } }]
];
slide.addTable(tableData, { x: 1, y: 3.5, w: 8, colW: [4, 4] });
```

---

## 图表

```javascript
// 条形图
slide.addChart(pres.charts.BAR, [{
  name: "销售额", labels: ["Q1", "Q2", "Q3", "Q4"], values: [4500, 5500, 6200, 7100]
}], { x: 0.5, y: 0.6, w: 6, h: 3, barDir: 'col' });

// 折线图（showPoint 默认关闭，必须显式开启，详见 pitfalls.md）
slide.addChart(pres.charts.LINE, [{
  name: "趋势", labels: ["一月", "二月", "三月"], values: [32, 35, 42]
}], { x: 0.5, y: 1, w: 9, h: 3.8, lineSize: 3, lineSmooth: true, showPoint: true });

// 饼图（values 中不能有 0，w:h 保持 1:1，详见 pitfalls.md）
slide.addChart(pres.charts.PIE, [{
  name: "占比", labels: ["A", "B", "其他"], values: [35, 45, 20]
}], { x: 2.5, y: 1, w: 4.5, h: 4.5, showPercent: true });

// 散点图（必须用 {x,y} 对象格式，详见 pitfalls.md）
slide.addChart(pres.charts.SCATTER, [{
  name: "系列1", values: [{ x: 1, y: 10 }, { x: 2, y: 25 }, { x: 3, y: 18 }]
}], { x: 0.5, y: 1, w: 9, h: 4, lineSize: 0, showPoint: true });
```

### 现代图表样式

```javascript
slide.addChart(pres.charts.BAR, chartData, {
  x: 0.5, y: 1, w: 9, h: 4, barDir: "col",
  chartColors: ["0D9488", "14B8A6", "5EEAD4"],
  chartArea: { fill: { color: "FFFFFF" }, roundedCorners: true },
  catAxisLabelColor: "64748B", valAxisLabelColor: "64748B",
  valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" },
  showValue: true, dataLabelPosition: "outEnd", dataLabelColor: "1E293B",
  showLegend: false,
});
```

关键样式选项：`chartColors`、`chartArea`、`catGridLine/valGridLine`、`lineSmooth`、`legendPos`（"b"/"t"/"l"/"r"/"tr"）。

---

## 幻灯片母版

```javascript
pres.defineSlideMaster({
  title: 'TITLE_SLIDE', background: { color: '283A5E' },
  objects: [{
    placeholder: { options: { name: 'title', type: 'title', x: 1, y: 2, w: 8, h: 2 } }
  }]
});

let titleSlide = pres.addSlide({ masterName: "TITLE_SLIDE" });
titleSlide.addText("我的标题", { placeholder: "title" });
```

---

## 常见陷阱（API 层）

更多视觉/布局类问题见 [pitfalls.md](pitfalls.md)。

1. **颜色不得有 `#` 前缀** — `"FF0000"` ✅ / `"#FF0000"` ❌（损坏文件）
2. **不得用 8 位颜色编码透明度** — 改用 `opacity` 属性
3. **项目符号用 `bullet: true`** — 不要用 Unicode `•`（双重符号）
4. **多行文字用 `breakLine: true`** 分隔数组项
5. **项目符号间距用 `paraSpaceAfter`** — `lineSpacing` 会产生过大间距
6. **每次演示使用新实例** — 不要复用 `pptxgen()` 对象
7. **不得跨调用复用 options 对象** — PptxGenJS 就地修改对象（如将阴影值转换为 EMU）。多次调用共享同一对象会损坏第二个形状。
   ```javascript
   const shadow = { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 };
   slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });  // ❌ 第二次调用获得的是已转换的值
   slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });

   const makeShadow = () => ({ type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 });
   slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });  // ✅ 每次使用新对象
   slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });
   ```
8. **`ROUNDED_RECTANGLE` 不要与强调边框叠加** — 矩形条无法盖住圆角，改用 `RECTANGLE`
   ```javascript
   // ❌ 错误：强调条无法覆盖圆角
   slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1, y: 1, w: 3, h: 1.5, fill: { color: "FFFFFF" } });
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 0.08, h: 1.5, fill: { color: "0891B2" } });

   // ✅ 正确：用 RECTANGLE 保持对齐整洁
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 3, h: 1.5, fill: { color: "FFFFFF" } });
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 0.08, h: 1.5, fill: { color: "0891B2" } });
   ```

---

## 快速参考

- **形状**：RECTANGLE、OVAL、LINE、ROUNDED_RECTANGLE
- **图表**：BAR、LINE、PIE、DOUGHNUT、SCATTER、BUBBLE、RADAR
- **布局**：LAYOUT_16x9（10"×5.625"）、LAYOUT_16x10、LAYOUT_4x3、LAYOUT_WIDE
- **对齐**："left"、"center"、"right"
- **图表数据标签位置**："outEnd"、"inEnd"、"center"
