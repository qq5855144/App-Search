---
name: p5js-creative-coding
description: "Use when users request: p5.js sketches, creative coding, generative art, interactive visualizations, canvas animations, browser-based visual art, data viz, shader effects, or any p5.js project."
license: MIT
metadata:
  version: "1.0.0"
  category: creative-coding
---

# p5.js 创意编码生产流水线

## 何时使用

当用户请求以下内容时激活：p5.js 草图、创意编码、生成艺术、交互式可视化、Canvas 动画、浏览器视觉艺术、数据可视化、着色器效果，或任何 p5.js 项目。

## 能力概述

使用 p5.js 构建交互式与生成式视觉艺术的生产流水线。可创建浏览器端草图、生成艺术、数据可视化、交互体验、3D 场景、音频响应式视觉和动态图形 —— 导出为 HTML、PNG、GIF、MP4 或 SVG。涵盖：2D/3D 渲染、噪声与粒子系统、流场、GLSL 着色器、像素操作、动态文字、WebGL 场景、音频分析、鼠标/键盘交互，以及无头高分辨率导出。

## 创意标准

这是浏览器中渲染的视觉艺术。画布是媒介，算法是画笔。

**在写下第一行代码之前**，先阐明创意概念。这件作品传达什么？是什么让观众停下来？什么让它区别于代码教程示例？用户的提示只是起点 —— 用创意野心去诠释它。

**首次渲染即 excellence。** 首次加载时必须在视觉上令人震撼。如果它看起来像 p5.js 教程练习、默认配置或"AI 生成的创意编码"，那就是错的。在交付前重新思考。

**超越参考词汇。** 参考中的噪声函数、粒子系统、调色板和着色器效果只是起步词汇。对每个项目，都要组合、分层和创新。目录是颜料盘 —— 你创作的是画作。

**主动创意。** 如果用户要求"一个粒子系统"，交付一个带有涌现群体行为、拖尾幽灵回声、调色板变换深度雾，以及呼吸的背景噪声场的粒子系统。包含至少一个用户没要求但会欣赏的视觉细节。

**密集、分层、经过思考。** 每一帧都应值得反复观看。从不使用纯白背景。始终有构图层次。始终有意图性的颜色。始终有只在仔细观察时才会出现的微观细节。

**统一美学胜过功能数量。** 所有元素必须服务于统一的视觉语言 —— 共享的色温、一致的描边粗细词汇、和谐的运动速度。一个有十个无关效果的草图，不如一个有三个相互呼应效果的草图。

## 工作模式

| 模式 | 输入 | 输出 | 参考文档 |
|------|------|------|----------|
| **生成艺术** | 种子 / 参数 | 程序化视觉构图（静态或动画） | `references/visual-effects.md` |
| **数据可视化** | 数据集 / API | 交互式图表、自定义数据展示 | `references/interaction.md` |
| **交互体验** | 无（用户驱动） | 鼠标/键盘/触摸驱动的草图 | `references/interaction.md` |
| **动画 / 动态图形** | 时间线 / 分镜 | 定时序列、动态文字、过渡 | `references/animation.md` |
| **3D 场景** | 概念描述 | WebGL 几何体、光照、相机、材质 | `references/webgl-and-3d.md` |
| **图像处理** | 图像文件 | 像素操作、滤镜、马赛克、点彩 | `references/visual-effects.md` § 像素操作 |
| **音频响应式** | 音频文件 / 麦克风 | 声音驱动的生成式视觉 | `references/interaction.md` § 音频输入 |

## 技术栈

每个项目使用单个自包含 HTML 文件。无需构建步骤。

| 层级 | 工具 | 用途 |
|------|------|------|
| 核心 | p5.js 1.11.3 (CDN) | Canvas 渲染、数学、变换、事件处理 |
| 3D | p5.js WebGL 模式 | 3D 几何体、相机、光照、GLSL 着色器 |
| 音频 | p5.sound.js (CDN) | FFT 分析、振幅、麦克风输入、振荡器 |
| 导出 | 内置 `saveCanvas()` / `saveGif()` / `saveFrames()` | PNG、GIF、帧序列输出 |
| 捕获 | CCapture.js（可选） | 确定性帧率视频捕获（WebM、GIF） |
| 无头 | Puppeteer + Node.js（可选） | 自动化高分辨率渲染、MP4（通过 ffmpeg） |
| SVG | p5.js-svg 1.6.0（可选） | 矢量输出用于印刷 —— 需要 p5.js 1.x |
| 自然媒介 | p5.brush（可选） | 水彩、炭笔、钢笔 —— 需要 p5.js 2.x + WEBGL |
| 纹理 | p5.grain（可选） | 胶片颗粒、纹理叠加 |
| 字体 | Google Fonts / `loadFont()` | 通过 OTF/TTF/WOFF2 的自定义字体 |

### 版本说明

**p5.js 1.x** (1.11.3) 是默认版本 —— 稳定、文档完善、库兼容性最广。除非项目需要 2.x 特性，否则使用此版本。

**p5.js 2.x** (2.2+) 新增：`async setup()` 替代 `preload()`、OKLCH/OKLAB 颜色模式、`splineVertex()`、着色器 `.modify()` API、可变字体、`textToContours()`、指针事件。需要 p5.brush 时使用。详见 `references/core-api.md` § p5.js 2.0。

## 生产流水线

每个项目遵循相同的 6 阶段路径：

```
概念 → 设计 → 编码 → 预览 → 导出 → 验证
```

1. **概念** —— 阐明创意愿景：情绪、色彩世界、运动词汇、独特之处
2. **设计** —— 选择模式、画布尺寸、交互模型、颜色系统、导出格式。将概念映射到技术决策
3. **编码** —— 编写内联 p5.js 的单个 HTML 文件。结构：全局变量 → `preload()` → `setup()` → `draw()` → 辅助函数 → 类 → 事件处理器
4. **预览** —— 在浏览器中打开，验证视觉质量。在目标分辨率下测试。检查性能
5. **导出** —— 捕获输出：`saveCanvas()` 导出 PNG、`saveGif()` 导出 GIF、`saveFrames()` + ffmpeg 导出 MP4、Puppeteer 无头批量导出
6. **验证** —— 输出是否符合概念？在目标显示尺寸下是否视觉震撼？你会把它装裱起来吗？

## 创意指导

### 美学维度

| 维度 | 选项 | 参考文档 |
|------|------|----------|
| **颜色系统** | HSB/HSL、RGB、命名调色板、程序化和声、渐变插值 | `references/color-systems.md` |
| **噪声词汇** | Perlin 噪声、simplex、分形（八度）、域扭曲、curl 噪声 | `references/visual-effects.md` § 噪声 |
| **粒子系统** | 基于物理、群体行为、拖尾绘制、吸引子驱动、流场跟随 | `references/visual-effects.md` § 粒子 |
| **形状语言** | 几何基础图形、自定义顶点、贝塞尔曲线、SVG 路径 | `references/shapes-and-geometry.md` |
| **运动风格** | 缓动、基于弹簧、噪声驱动、物理模拟、lerp、步进 | `references/animation.md` |
| **字体** | 系统字体、加载的 OTF、`textToPoints()` 粒子文字、动态文字 | `references/typography.md` |
| **着色器效果** | GLSL 片段/顶点、滤镜着色器、后处理、反馈循环 | `references/webgl-and-3d.md` § 着色器 |
| **构图** | 网格、径向、黄金比例、三分法则、有机散点、平铺 | `references/core-api.md` § 构图 |
| **交互模型** | 鼠标跟随、点击生成、拖拽、键盘状态、滚动驱动、麦克风输入 | `references/interaction.md` |
| **混合模式** | `BLEND`、`ADD`、`MULTIPLY`、`SCREEN`、`DIFFERENCE`、`EXCLUSION`、`OVERLAY` | `references/color-systems.md` § 混合模式 |
| **分层** | `createGraphics()` 离屏缓冲、Alpha 合成、遮罩 | `references/core-api.md` § 离屏缓冲 |
| **纹理** | Perlin 表面、点描、排线、半色调、像素排序 | `references/visual-effects.md` § 纹理生成 |

### 每项目变化规则

绝不使用默认配置。对每个项目：

- **自定义调色板** —— 从不使用原始 `fill(255, 0, 0)`。始终使用包含 3-7 种颜色的设计调色板
- **自定义描边粗细词汇** —— 细点缀 (0.5)、中等结构 (1-2)、粗强调 (3-5)
- **背景处理** —— 从不使用纯 `background(0)` 或 `background(255)`。始终使用纹理、渐变或分层
- **运动多样性** —— 不同元素以不同速度运动。主体 1x、次要 0.3x、环境 0.1x
- **至少一个 invented 元素** —— 自定义粒子行为、新颖的噪声应用、独特的交互响应

### 项目特定创新

对每个项目，至少创新以下之一：

- 匹配情绪的自定义调色板（不是预设）
- 新颖的噪声场组合（例如 curl 噪声 + 域扭曲 + 反馈）
- 独特的粒子行为（自定义力、自定义拖尾、自定义生成）
- 用户没要求但能提升作品的交互机制
- 创造视觉层次的构图技巧

### 参数设计哲学

参数应从算法中涌现，而不是来自通用菜单。问自己："*这个*系统的哪些属性应该是可调的？"

**好的参数**暴露算法的特性：
- **数量** —— 多少粒子、分支、单元（控制密度）
- **尺度** —— 噪声频率、元素大小、间距（控制纹理）
- **速率** —— 速度、生长速率、衰减（控制能量）
- **阈值** —— 行为何时改变？（控制戏剧性）
- **比例** —— 比例、力之间的平衡（控制和谐）

**坏的参数**是与算法无关的通用控制：
- "color1"、"color2"、"size" —— 没有上下文就无意义
- 无关效果的切换开关
- 只改变外观不改变行为的参数

每个参数都应该改变算法*如何思考*，而不仅仅是*如何看*。改变噪声八度的"湍流"参数是好的。只改变 `ellipse()` 半径的"粒子大小"滑块是浅薄的。

## 工作流步骤

### 步骤 1：创意愿景

在写任何代码之前，阐明：

- **情绪 / 氛围**：观众应该感受到什么？沉思？振奋？不安？ playful？
- **视觉故事**：随着时间（或交互）发生什么？构建？衰减？变换？振荡？
- **色彩世界**：暖/冷？单色？互补？主色调是什么？强调色是什么？
- **形状语言**：有机曲线？锐利几何？点？线？混合？
- **运动词汇**：缓慢漂移？爆发？呼吸脉动？机械精确？
- **是什么让 THIS 不同**：是什么让这个草图独一无二？

将用户的提示映射到美学选择。"放松的生成背景"与"故障数据可视化"需要完全不同的处理。

### 步骤 2：技术设计

- **模式** —— 上面表格中的 7 种模式之一
- **画布尺寸** —— 横版 1920x1080、竖版 1080x1920、方形 1080x1080，或响应式 `windowWidth/windowHeight`
- **渲染器** —— `P2D`（默认）或 `WEBGL`（用于 3D、着色器、高级混合模式）
- **帧率** —— 60fps（交互式）、30fps（环境动画），或 `noLoop()`（静态生成式）
- **导出目标** —— 浏览器显示、PNG 静态图、GIF 循环、MP4 视频、SVG 矢量
- **交互模型** —— 被动（无输入）、鼠标驱动、键盘驱动、音频响应式、滚动驱动
- **查看器 UI** —— 对于交互式生成艺术，从 `templates/viewer.html` 开始，它提供种子导航、参数滑块和下载。对于简单草图或视频导出，使用裸 HTML

### 步骤 3：编写草图

对于**交互式生成艺术**（种子探索、参数调优）：从 `templates/viewer.html` 开始。先阅读模板，保留固定部分（种子导航、操作），替换算法和参数控制。这为用户提供种子 上一页/下一页/随机/跳转、参数滑块实时更新和 PNG 下载 —— 全部已连接好。

对于**动画、视频导出或简单草图**：使用裸 HTML：

单个 HTML 文件。结构：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>项目名称</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
</head>
<body>
<script>
// 全局变量
const CONFIG = { seed: 42, particleCount: 1000 };
const PALETTE = ['#2E0854', '#850E35', '#EE6C4D', '#F5E663'];

function setup() {
  createCanvas(1920, 1080);
  colorMode(HSB, 360, 100, 100, 100);
  randomSeed(CONFIG.seed);
  noiseSeed(CONFIG.seed);
}

function draw() {
  background(0);
  // 绘制内容
}

function keyPressed() {
  if (key === 's') saveCanvas('output', 'png');
  if (key === 'g') saveGif('output', 5);
}
</script>
</body>
</html>
```

关键实现模式：
- **种子随机性**：始终 `randomSeed()` + `noiseSeed()` 以保证可重现性
- **颜色模式**：使用 `colorMode(HSB, 360, 100, 100, 100)` 进行直观的颜色控制
- **状态分离**：CONFIG 用于参数，PALETTE 用于颜色，全局变量用于可变状态
- **基于类的实体**：粒子、代理、形状作为带有 `update()` + `display()` 方法的类
- **离屏缓冲**：`createGraphics()` 用于分层合成、拖尾、遮罩

### 步骤 4：预览与迭代

- 直接在浏览器中打开 HTML 文件 —— 基础草图不需要服务器
- 对于从本地文件加载的 `loadImage()`/`loadFont()`：使用 `scripts/serve.sh` 或 `python3 -m http.server`
- Chrome DevTools Performance 标签页验证 60fps
- 在目标导出分辨率下测试，而不仅仅是窗口大小
- 调整参数直到视觉匹配步骤 1 的概念

### 步骤 5：导出

| 格式 | 方法 | 命令 |
|------|------|------|
| **PNG** | `saveCanvas('output', 'png')` 在 `keyPressed()` 中 | 按 's' 保存 |
| **高分辨率 PNG** | Puppeteer 无头捕获 | `node scripts/export-frames.js sketch.html --width 3840 --height 2160 --frames 1` |
| **GIF** | `saveGif('output', 5)` —— 捕获 N 秒 | 按 'g' 保存 |
| **帧序列** | `saveFrames('frame', 'png', 10, 30)` —— 10 秒 30fps | 然后 `ffmpeg -i frame-%04d.png -c:v libx264 output.mp4` |
| **MP4** | Puppeteer 帧捕获 + ffmpeg | `bash scripts/render.sh sketch.html output.mp4 --duration 30 --fps 30` |
| **SVG** | `createCanvas(w, h, SVG)` 配合 p5.js-svg | `save('output.svg')` |

### 步骤 6：质量验证

- **是否符合愿景？** 将输出与创意概念对比。如果看起来通用，回到步骤 1
- **分辨率检查**：在目标显示尺寸下是否清晰？没有锯齿伪影？
- **性能检查**：浏览器中是否保持 60fps？（动画最低 30fps）
- **颜色检查**：颜色是否协调？在亮暗显示器上都测试
- **边界情况**：画布边缘发生什么？调整大小时？运行 10 分钟后？

## 关键实现注意事项

### 性能 —— 首先禁用 FES

Friendly Error System (FES) 会增加高达 10 倍的开销。在每个生产草图中禁用它：

```javascript
p5.disableFriendlyErrors = true; // 在 setup() 之前
function setup() {
  pixelDensity(1); // 防止 retina 上的 2x-4x 过度绘制
  createCanvas(1920, 1080);
}
```

在热循环（粒子、像素操作）中，使用 `Math.*` 替代 p5 包装器 —— 明显更快：

```javascript
// 在 draw() 或 update() 热路径中：
let a = Math.sin(t); // 不是 sin(t)
let r = Math.sqrt(dx*dx+dy*dy); // 不是 dist() —— 或更好：跳过 sqrt，比较 magSq
let v = Math.random(); // 不是 random() —— 当不需要种子时
let m = Math.min(a, b); // 不是 min(a, b)
```

绝不在 `draw()` 中使用 `console.log()`。绝不在 `draw()` 中操作 DOM。详见 `references/troubleshooting.md` § 性能。

### 种子随机性 —— 始终使用

每个生成式草图必须是可重现的。相同种子，相同输出。

```javascript
function setup() {
  randomSeed(CONFIG.seed);
  noiseSeed(CONFIG.seed);
  // 所有 random() 和 noise() 调用现在是确定性的
}
```

绝不用 `Math.random()` 处理生成式内容 —— 仅用于性能关键的非视觉代码。视觉元素始终使用 `random()`。如果需要随机种子：`CONFIG.seed = floor(random(99999))`。

### 生成艺术平台支持（fxhash / Art Blocks）

对于生成艺术平台，将 p5 的 PRNG 替换为平台的确定性随机：

```javascript
// fxhash 约定
const SEED = $fx.hash; // 每个铸造唯一
const rng = $fx.rand; // 确定性 PRNG
$fx.features({ palette: 'warm', complexity: 'high' });
// 在 setup() 中：
randomSeed(SEED); // 用于 p5 的 noise()
noiseSeed(SEED);
// 用 rng() 替换 random() 以实现平台确定性
let x = rng() * width; // 替代 random(width)
```

详见 `references/export-pipeline.md` § 平台导出。

### 颜色模式 —— 使用 HSB

HSB（色相、饱和度、亮度）对于生成艺术比 RGB 更容易操作：

```javascript
colorMode(HSB, 360, 100, 100, 100);
// 现在：fill(hue, sat, bri, alpha)
// 旋转色相：fill((baseHue + offset) % 360, 80, 90)
// 去饱和：fill(hue, sat * 0.3, bri)
// 变暗：fill(hue, sat, bri * 0.5)
```

绝不硬编码原始 RGB 值。定义调色板对象，程序化生成分支。详见 `references/color-systems.md`。

### 噪声 —— 多八度，不是原始

原始 `noise(x, y)` 看起来像平滑的斑点。叠加八度以获得自然纹理：

```javascript
function fbm(x, y, octaves = 4) {
  let val = 0, amp = 1, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise(x * freq, y * freq) * amp;
    sum += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / sum;
}
```

对于流动的有机形态，使用**域扭曲**：将噪声输出反馈为噪声输入坐标。详见 `references/visual-effects.md`。

### createGraphics() 用于图层 —— 不是可选的

平面单次渲染看起来是平的。使用离屏缓冲进行合成：

```javascript
let bgLayer, fgLayer, trailLayer;
function setup() {
  createCanvas(1920, 1080);
  bgLayer = createGraphics(width, height);
  fgLayer = createGraphics(width, height);
  trailLayer = createGraphics(width, height);
}
function draw() {
  renderBackground(bgLayer);
  renderTrails(trailLayer); // 持久的，渐隐
  renderForeground(fgLayer); // 每帧清除
  image(bgLayer, 0, 0);
  image(trailLayer, 0, 0);
  image(fgLayer, 0, 0);
}
```

### 性能 —— 尽可能矢量化

p5.js 绘制调用很昂贵。对于数千个粒子：

```javascript
// 慢：单独形状
for (let p of particles) {
  ellipse(p.x, p.y, p.size);
}
// 快：单个形状使用 beginShape()
beginShape(POINTS);
for (let p of particles) {
  vertex(p.x, p.y);
}
endShape();
// 最快：像素缓冲用于大规模数量
loadPixels();
for (let p of particles) {
  let idx = 4 * (floor(p.y) * width + floor(p.x));
  pixels[idx] = r; pixels[idx+1] = g; pixels[idx+2] = b; pixels[idx+3] = 255;
}
updatePixels();
```

详见 `references/troubleshooting.md` § 性能。

### 实例模式用于多个草图

全局模式污染 `window`。对于生产环境，使用实例模式：

```javascript
const sketch = (p) => {
  p.setup = function() {
    p.createCanvas(800, 800);
  };
  p.draw = function() {
    p.background(0);
    p.ellipse(p.mouseX, p.mouseY, 50);
  };
};
new p5(sketch, 'canvas-container');
```

在单个页面上嵌入多个草图或与框架集成时需要。

### WebGL 模式注意事项

- `createCanvas(w, h, WEBGL)` —— 原点在中心，不是左上角
- Y 轴是反转的（WEBGL 中正 Y 向上，P2D 中向下）
- 要获得 P2D 般的坐标：`translate(-width/2, -height/2)`
- 每次变换周围使用 `push()`/`pop()` —— 矩阵栈静默溢出
- `texture()` 在 `rect()`/`plane()` 之前 —— 不是之后
- 自定义着色器：`createShader(vert, frag)` —— 在多个浏览器上测试

### 导出 —— 快捷键约定

每个草图应在 `keyPressed()` 中包含这些：

```javascript
function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('output', 'png');
  if (key === 'g' || key === 'G') saveGif('output', 5);
  if (key === 'r' || key === 'R') { randomSeed(millis()); noiseSeed(millis()); }
  if (key === ' ') CONFIG.paused = !CONFIG.paused;
}
```

### 无头视频导出 —— 使用 noLoop()

对于通过 Puppeteer 的无头渲染，草图**必须**在 setup 中使用 `noLoop()`。没有它，p5 的 draw 循环会自由运行，而截图很慢 —— 草图会超前运行，你会得到跳过/重复的帧。

```javascript
function setup() {
  createCanvas(1920, 1080);
  pixelDensity(1);
  noLoop(); // 捕获脚本控制帧推进
  window._p5Ready = true; // 向捕获脚本发出就绪信号
}
```

绑定的 `scripts/export-frames.js` 检测 `_p5Ready` 并为每次捕获调用 `redraw()`，以实现精确的 1:1 帧对应。详见 `references/export-pipeline.md` § 确定性捕获。

对于多场景视频，使用每片段架构：每个场景一个 HTML，独立渲染，用 `ffmpeg -f concat` 拼接。详见 `references/export-pipeline.md` § 每片段架构。

## Agent 工作流

构建 p5.js 草图时：

1. **编写 HTML 文件** —— 单个自包含文件，所有代码内联
2. **在浏览器中打开** —— `open sketch.html`（macOS）或 `xdg-open sketch.html`（Linux）
3. **本地资源**（字体、图像）需要服务器：在项目目录中 `python3 -m http.server 8080`，然后打开 `http://localhost:8080/sketch.html`
4. **导出 PNG/GIF** —— 添加上面显示的 `keyPressed()` 快捷键，告诉用户按哪个键
5. **无头导出** —— `node scripts/export-frames.js sketch.html --frames 300` 用于自动化帧捕获（草图必须使用 `noLoop()` + `_p5Ready`）
6. **MP4 渲染** —— `bash scripts/render.sh sketch.html output.mp4 --duration 30`
7. **迭代优化** —— 编辑 HTML 文件，用户刷新浏览器查看更改
8. **按需加载参考** —— 使用 `skill_view(name="p5js-creative-coding", file_path="references/...")` 在实现期间按需加载特定参考文件

## 性能目标

| 指标 | 目标 |
|------|------|
| 帧率（交互式） | 持续 60fps |
| 帧率（动画导出） | 最低 30fps |
| 粒子数（P2D 形状） | 60fps 下 5,000-10,000 |
| 粒子数（像素缓冲） | 60fps 下 50,000-100,000 |
| 画布分辨率 | 最高 3840x2160（导出），1920x1080（交互式） |
| 文件大小（HTML） | < 100KB（不包括 CDN 库） |
| 加载时间 | < 2 秒到第一帧 |

## 参考文档索引

| 文件 | 内容 |
|------|------|
| `references/core-api.md` | Canvas 设置、坐标系、draw 循环、`push()`/`pop()`、离屏缓冲、合成模式、`pixelDensity()`、响应式设计 |
| `references/shapes-and-geometry.md` | 2D 基础图形、`beginShape()`/`endShape()`、贝塞尔/Catmull-Rom 曲线、`vertex()` 系统、自定义形状、`p5.Vector`、有符号距离场、SVG 路径转换 |
| `references/visual-effects.md` | 噪声（Perlin、分形、域扭曲、curl）、流场、粒子系统（物理、群体、拖尾）、像素操作、纹理生成（点描、排线、半色调）、反馈循环、反应扩散 |
| `references/animation.md` | 基于帧的动画、缓动函数、`lerp()`/`map()`、弹簧物理、状态机、时间线排序、`millis()` 计时、过渡模式 |
| `references/typography.md` | `text()`、`loadFont()`、`textToPoints()`、动态文字、文字遮罩、字体度量、响应式文字大小 |
| `references/color-systems.md` | `colorMode()`、HSB/HSL/RGB、`lerpColor()`、`paletteLerp()`、程序调色板、色彩和声、`blendMode()`、渐变渲染、精选调色板库 |
| `references/webgl-and-3d.md` | WEBGL 渲染器、3D 基础图形、相机、光照、材质、自定义几何体、GLSL 着色器（`createShader()`、`createFilterShader()`）、帧缓冲、后处理 |
| `references/interaction.md` | 鼠标事件、键盘状态、触摸输入、DOM 元素、`createSlider()`/`createButton()`、音频输入（p5.sound FFT/振幅）、滚动驱动动画、响应式事件 |
| `references/export-pipeline.md` | `saveCanvas()`、`saveGif()`、`saveFrames()`、确定性无头捕获、ffmpeg 帧到视频、CCapture.js、SVG 导出、每片段架构、平台导出（fxhash）、视频注意事项 |
| `references/troubleshooting.md` | 性能分析、每像素预算、常见错误、浏览器兼容性、WebGL 调试、字体加载问题、像素密度陷阱、内存泄漏、CORS |
| `templates/viewer.html` | 交互式查看器模板：种子导航（上一页/下一页/随机/跳转）、参数滑块、下载 PNG、响应式画布。从此开始用于可探索的生成艺术 |

## 创意发散（仅当用户请求实验性/创意性/独特输出时使用）

如果用户要求创意、实验性、令人惊讶或非常规的输出，选择最适合的策略并在生成代码之前先推理其步骤。

- **概念混合** —— 当用户命名两个要组合的事物或想要混合美学时
- **SCAMPER** —— 当用户想要已知生成艺术模式的变体时
- **远距离联想** —— 当用户给出一个概念并想要探索时（"做关于时间的东西"）

### 概念混合

1. 命名两个不同的视觉系统（例如，粒子物理 + 手写）
2. 映射对应关系（粒子 = 墨滴，力 = 笔压，场 = 字母形态）
3. 选择性混合 —— 保留产生有趣涌现视觉的映射
4. 将混合编码为统一系统，而不是并排放置的两个系统

### SCAMPER 变换

获取一个已知的生成模式（流场、粒子系统、L-system、细胞自动机）并系统地变换它：

- **替代**：用文本字符替换圆形，用渐变替换线条
- **组合**：合并两个模式（流场 + voronoi）
- **适应**：将 2D 模式应用于 3D 投影
- **修改**：夸大尺度，扭曲坐标空间
- **用途**：将物理模拟用于字体，将排序算法用于颜色
- **消除**：移除网格、移除颜色、移除对称
- **反转**：反向运行模拟，反转参数空间

### 远距离联想

1. 锚定用户的概念（例如，"孤独"）
2. 在三个距离上生成联想：
   - 近（明显）：空房间、单人、寂静
   - 中（有趣）：鱼群中朝错误方向游的一条鱼、没有通知的手机、地铁车厢之间的缝隙
   - 远（抽象）：质数、渐近曲线、凌晨 3 点的颜色
3. 发展中距离联想 —— 它们足够具体可以可视化，但又足够出乎意料可以有趣

## 禁止事项

- 绝不生成看起来像教程练习的代码。每个输出必须是原创的艺术作品
- 绝不使用默认配置：纯白/纯黑背景、默认描边粗细、原始 RGB 填充
- 绝不在 `draw()` 中使用 `console.log()` 或在热循环中进行 DOM 操作
- 绝不用 `Math.random()` 处理生成式视觉内容（性能关键的非视觉代码除外）
- 绝不交付未经验证的草图。始终在浏览器中预览
- 绝不忽视性能。粒子数超过 10,000 时矢量化或使用像素缓冲
- 绝不在 WebGL 中忘记 `push()`/`pop()` —— 矩阵栈静默溢出
- 绝不将生成艺术平台（fxhash 等）的 PRNG 与普通 p5 `random()` 混淆
- 绝不硬编码颜色值而不通过调色板系统。始终使用设计好的调色板
- 绝不交付没有导出快捷键（'s' 保存 PNG，'g' 保存 GIF）的草图

## 质量验收标准

一个**好的输出**必须满足：

- 视觉震撼：首次加载时引人注目，不是"看起来像 AI 生成的"
- 可重现：相同种子产生相同输出（使用 `randomSeed()` + `noiseSeed()`）
- 性能良好：交互式 60fps，动画最低 30fps
- 有意图的调色板：3-7 种颜色，不是原始 RGB 或默认颜色
- 分层构图：至少使用一个离屏缓冲或混合模式进行合成
- 自定义参数：暴露控制算法行为的参数，而不仅仅是外观
- 完整的 HTML 文件：单个自包含文件，通过 CDN 加载 p5.js
- 导出就绪：包含 's'（PNG）和 'g'（GIF）快捷键

一个**坏的输出**表现为：

- 看起来像默认 p5.js 示例或教程练习
- 使用 `background(0)` 或 `background(255)` 没有任何纹理或处理
- 所有元素以相同速度和相同颜色移动
- 没有种子控制，每次刷新都不同
- 在合理粒子数下低于 30fps
- 硬编码颜色如 `fill(255, 0, 0)` 没有调色板上下文
