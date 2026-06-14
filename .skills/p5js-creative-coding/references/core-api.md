# 核心 API 参考

## Canvas 设置

### createCanvas()

```javascript
// 2D (default renderer)
createCanvas(1920, 1080);

// WebGL (3D, shaders)
createCanvas(1920, 1080, WEBGL);

// Responsive
createCanvas(windowWidth, windowHeight);
```

### 像素密度

高 DPI 显示器默认以 2x 渲染。这会加倍内存使用并减半性能。

```javascript
// Force 1x for consistent export and performance
pixelDensity(1);

// Match display (default) — sharp on retina but expensive
pixelDensity(displayDensity());

// ALWAYS call before createCanvas()
function setup() {
  pixelDensity(1);        // first
  createCanvas(1920, 1080); // second
}
```

导出时，始终使用 `pixelDensity(1)` 并采用精确的目标分辨率。永远不要依赖设备缩放作为最终输出。

### 响应式调整大小

```javascript
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Recreate offscreen buffers at new size
  bgLayer = createGraphics(width, height);
  // Reinitialize any size-dependent state
}
```

## 坐标系

### P2D (默认)
- Origin: top-left (0, 0)
- X increases rightward
- Y increases downward
- Angles: radians by default, `angleMode(DEGREES)` to switch

### WEBGL
- Origin: center of canvas
- X increases rightward, Y increases **upward**, Z increases toward viewer
- To get P2D-like coordinates in WEBGL: `translate(-width/2, -height/2)`

## Draw 循环

```javascript
function preload() {
  // Load assets before setup — fonts, images, JSON, CSV
  // Blocks execution until all loads complete
  font = loadFont('font.otf');
  img = loadImage('texture.png');
  data = loadJSON('data.json');
}

function setup() {
  // Runs once. Create canvas, initialize state.
  createCanvas(1920, 1080);
  colorMode(HSB, 360, 100, 100, 100);
  randomSeed(CONFIG.seed);
  noiseSeed(CONFIG.seed);
}

function draw() {
  // Runs every frame (default 60fps).
  // Set frameRate(30) in setup() to change.
  // Call noLoop() for static sketches (render once).
}
```

### Frame Control

```javascript
frameRate(30);           // set target FPS
noLoop();                // stop draw loop (static pieces)
loop();                  // restart draw loop
redraw();                // call draw() once (manual refresh)
frameCount              // frames since start (integer)
deltaTime               // milliseconds since last frame (float)
millis()                // milliseconds since sketch started
```

## 变换栈

每次变换都是累积的。使用 `push()`/`pop()` 来隔离。

```javascript
push();
  translate(width / 2, height / 2);
  rotate(angle);
  scale(1.5);
  // draw something at transformed position
  ellipse(0, 0, 100, 100);
pop();
// back to original coordinate system
```

### 变换函数

| Function | Effect |
|----------|--------|
| `translate(x, y)` | Move origin |
| `rotate(angle)` | Rotate around origin (radians) |
| `scale(s)` / `scale(sx, sy)` | Scale from origin |
| `shearX(angle)` | Skew X axis |
| `shearY(angle)` | Skew Y axis |
| `applyMatrix(a, b, c, d, e, f)` | Arbitrary 2D affine transform |
| `resetMatrix()` | Clear all transforms |

### 合成模式: 围绕中心旋转

```javascript
push();
  translate(cx, cy);       // move origin to center
  rotate(angle);           // rotate around that center
  translate(-cx, -cy);     // move origin back
  // draw at original coordinates, but rotated around (cx, cy)
  rect(cx - 50, cy - 50, 100, 100);
pop();
```

## 离屏缓冲 (createGraphics)

离屏缓冲是独立的画布，你可以在上面绘制并进行合成。适用于:
- **分层合成** — 背景、中景、前景
- **持久拖尾** — 绘制到缓冲，用半透明矩形渐隐，从不完全清除
- **遮罩** — 将遮罩绘制到缓冲，用 `image()` 或像素操作应用
- **后处理** — 将场景渲染到缓冲，应用效果，绘制到主画布

```javascript
let layer;

function setup() {
  createCanvas(1920, 1080);
  layer = createGraphics(width, height);
}

function draw() {
  // Draw to offscreen buffer
  layer.background(0, 10);  // semi-transparent clear = trails
  layer.fill(255);
  layer.ellipse(mouseX, mouseY, 20);

  // Composite to main canvas
  image(layer, 0, 0);
}
```

### 拖尾效果模式

```javascript
let trailBuffer;

function setup() {
  createCanvas(1920, 1080);
  trailBuffer = createGraphics(width, height);
  trailBuffer.background(0);
}

function draw() {
  // Fade previous frame (lower alpha = longer trails)
  trailBuffer.noStroke();
  trailBuffer.fill(0, 0, 0, 15);  // RGBA — 15/255 alpha
  trailBuffer.rect(0, 0, width, height);

  // Draw new content
  trailBuffer.fill(255);
  trailBuffer.ellipse(mouseX, mouseY, 10);

  // Show
  image(trailBuffer, 0, 0);
}
```

### 多层合成

```javascript
let bgLayer, contentLayer, fxLayer;

function setup() {
  createCanvas(1920, 1080);
  bgLayer = createGraphics(width, height);
  contentLayer = createGraphics(width, height);
  fxLayer = createGraphics(width, height);
}

function draw() {
  // Background — drawn once or slowly evolving
  renderBackground(bgLayer);

  // Content — main visual elements
  contentLayer.clear();
  renderContent(contentLayer);

  // FX — overlays, vignettes, grain
  fxLayer.clear();
  renderEffects(fxLayer);

  // Composite with blend modes
  image(bgLayer, 0, 0);
  blendMode(ADD);
  image(contentLayer, 0, 0);
  blendMode(MULTIPLY);
  image(fxLayer, 0, 0);
  blendMode(BLEND);  // reset
}
```

## 构图模式

### 网格布局

```javascript
let cols = 10, rows = 10;
let cellW = width / cols;
let cellH = height / rows;
for (let i = 0; i < cols; i++) {
  for (let j = 0; j < rows; j++) {
    let cx = cellW * (i + 0.5);
    let cy = cellH * (j + 0.5);
    // draw element at (cx, cy) within cell size (cellW, cellH)
  }
}
```

### 径向布局

```javascript
let n = 12;
for (let i = 0; i < n; i++) {
  let angle = TWO_PI * i / n;
  let r = 300;
  let x = width/2 + cos(angle) * r;
  let y = height/2 + sin(angle) * r;
  // draw element at (x, y)
}
```

### 黄金比例螺旋

```javascript
let phi = (1 + sqrt(5)) / 2;
let n = 500;
for (let i = 0; i < n; i++) {
  let angle = i * TWO_PI / (phi * phi);
  let r = sqrt(i) * 10;
  let x = width/2 + cos(angle) * r;
  let y = height/2 + sin(angle) * r;
  let size = map(i, 0, n, 8, 2);
  ellipse(x, y, size);
}
```

### 边距感知合成

```javascript
const MARGIN = 80;  // pixels from edge
const drawW = width - 2 * MARGIN;
const drawH = height - 2 * MARGIN;

// Map normalized [0,1] coordinates to drawable area
function mapX(t) { return MARGIN + t * drawW; }
function mapY(t) { return MARGIN + t * drawH; }
```

## 随机与噪声

### 种子随机

```javascript
randomSeed(42);
let x = random(100);        // always same value for seed 42
let y = random(-1, 1);      // range
let item = random(myArray);  // random element
```

### 高斯随机

```javascript
let x = randomGaussian(0, 1);  // mean=0, stddev=1
// Useful for natural-looking distributions
```

### Perlin 噪声

```javascript
noiseSeed(42);
noiseDetail(4, 0.5);  // 4 octaves, 0.5 falloff

let v = noise(x * 0.01, y * 0.01);  // returns 0.0 to 1.0
// Scale factor (0.01) controls feature size — smaller = smoother
```

## 数学工具

| Function | Description |
|----------|-------------|
| `map(v, lo1, hi1, lo2, hi2)` | Remap value between ranges |
| `constrain(v, lo, hi)` | Clamp to range |
| `lerp(a, b, t)` | Linear interpolation |
| `norm(v, lo, hi)` | Normalize to 0-1 |
| `dist(x1, y1, x2, y2)` | Euclidean distance |
| `mag(x, y)` | Vector magnitude |
| `abs()`, `ceil()`, `floor()`, `round()` | Standard math |
| `sq(n)`, `sqrt(n)`, `pow(b, e)` | Powers |
| `sin()`, `cos()`, `tan()`, `atan2()` | Trig (radians) |
| `degrees(r)`, `radians(d)` | Angle conversion |
| `fract(n)` | Fractional part |

## p5.js 2.0 变化

p5.js 2.0 (2025年4月发布，当前版本: 2.2) 引入了破坏性变更。p5.js 编辑器默认使用 1.x 直到 2026年8月。仅当需要 2.x 特性时才使用。

### async setup() 替代 preload()

```javascript
// p5.js 1.x
let img;
function preload() { img = loadImage('cat.jpg'); }
function setup() { createCanvas(800, 800); }

// p5.js 2.x
let img;
async function setup() {
  createCanvas(800, 800);
  img = await loadImage('cat.jpg');
}
```

### 新颜色模式

```javascript
colorMode(OKLCH);  // perceptually uniform — better gradients
// L: 0-1 (lightness), C: 0-0.4 (chroma), H: 0-360 (hue)
fill(0.7, 0.15, 200);  // medium-bright saturated blue

colorMode(OKLAB);  // perceptually uniform, no hue angle
colorMode(HWB);    // Hue-Whiteness-Blackness
```

### splineVertex() 替代 curveVertex()

不再需要重复第一个/最后一个控制点:

```javascript
// p5.js 1.x — must repeat first and last
beginShape();
curveVertex(pts[0].x, pts[0].y);  // doubled
for (let p of pts) curveVertex(p.x, p.y);
curveVertex(pts[pts.length-1].x, pts[pts.length-1].y);  // doubled
endShape();

// p5.js 2.x — clean
beginShape();
for (let p of pts) splineVertex(p.x, p.y);
endShape();
```

### 着色器 .modify() API

无需编写完整 GLSL 即可修改内置着色器:

```javascript
let myShader = baseMaterialShader().modify({
  vertexDeclarations: 'uniform float uTime;',
  'vec4 getWorldPosition': `(vec4 pos) {
    pos.y += sin(pos.x * 0.1 + uTime) * 20.0;
    return pos;
  }`
});
```

### 可变字体

```javascript
textWeight(700);  // dynamic weight without loading multiple files
```

### textToContours() 和 textToModel()

```javascript
let contours = font.textToContours('HELLO', 0, 0, 200);
// Returns array of contour arrays (closed paths)

let geo = font.textToModel('HELLO', 0, 0, 200);
// Returns p5.Geometry for 3D extruded text
```

### p5.js 2.x 的 CDN

```html
<script src="https://cdn.jsdelivr.net/npm/p5@2/lib/p5.min.js"></script>
```
