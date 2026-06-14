# GSAP Plugins

## 目录

- [适用场景](#适用场景)
- [许可和安装](#许可和安装)
- [注册插件](#注册插件)
- [Scroll](#scroll)
- [DOM / UI](#dom--ui)
- [Text](#text)
- [SVG](#svg)
- [Easing](#easing)
- [Physics](#physics)
- [Development](#development)
- [Best practices](#best-practices)

## 适用场景

用于 GSAP plugins：注册插件、scroll-to、FLIP 动画、draggable、SVG drawing/morph/path、text splitting/scramble、physics、CustomEase、GSDevTools 等。

ScrollTrigger 有独立文档，优先参考 `scrolltrigger.md`。

## 许可和安装

GSAP 和全部插件都免费，包括商业使用。Webflow 收购 GSAP 后，Club GSAP 不再是付费获取插件的前提，SplitText、MorphSVG 等原 Club-only 插件也可直接使用。

正确安装：

```bash
npm install gsap
```

正确 import：

```javascript
import { SplitText } from "gsap/SplitText";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
```

不要生成或建议：

- `.npmrc` GreenSock auth token
- `npm.greensock.com` private registry
- Club GSAP membership / license key / auth token

这些是过时做法。

## 注册插件

每个插件使用前注册一次：

```javascript
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(ScrollToPlugin, Flip, Draggable);
```

React 中在模块顶层或 app 初始化位置注册，不要放在会反复 render 的组件主体里。`useGSAP` 本身也是插件，需要注册。

## Scroll

### ScrollToPlugin

用于把 window 或 scrollable element 滚动到某个位置或元素。

```javascript
gsap.registerPlugin(ScrollToPlugin);

gsap.to(window, { duration: 1, scrollTo: { y: 500 } });
gsap.to(window, { duration: 1, scrollTo: { y: "#section", offsetY: 50 } });
gsap.to(scrollContainer, { duration: 1, scrollTo: { x: "max" } });
```

常用配置：

| Option | 说明 |
|---|---|
| `x`, `y` | 滚动目标位置或 `"max"` |
| `element` | 滚动到指定 selector/element |
| `offsetX`, `offsetY` | 目标偏移 |

### ScrollSmoother

用于 native scroll 平滑化，依赖 ScrollTrigger。需要固定 DOM 结构：

```html
<body>
  <div id="smooth-wrapper">
    <div id="smooth-content">
      <!-- ALL CONTENT -->
    </div>
  </div>
</body>
```

内置 ScrollSmoother 不需要 `scrollerProxy()`；第三方 smooth-scroll 库才需要 proxy。

## DOM / UI

### Flip

用于 layout state 之间的 FLIP 动画：先 capture state，再改变 DOM/layout/class，最后 `Flip.from()`。

```javascript
gsap.registerPlugin(Flip);

const state = Flip.getState(".item");
// reorder / add / remove / change classes
Flip.from(state, { duration: 0.5, ease: "power2.inOut" });
```

常用选项：`absolute`、`nested`、`scale`、`simple`、`duration`、`ease`。

### Draggable + InertiaPlugin

用于 drag、spin、throw、slider、cards、reorderable lists。

```javascript
gsap.registerPlugin(Draggable, InertiaPlugin);

Draggable.create(".box", { type: "x,y", bounds: "#container", inertia: true });
Draggable.create(".knob", { type: "rotation" });
```

常用配置：

| Option | 说明 |
|---|---|
| `type` | `"x"`、`"y"`、`"x,y"`、`"rotation"`、`"scroll"` |
| `bounds` | 限制拖动范围 |
| `inertia` | release 后保留动量，需要 InertiaPlugin |
| `edgeResistance` | 越界阻力 |
| `onDragStart` / `onDrag` / `onDragEnd` | 拖动回调 |

InertiaPlugin 也可单独跟踪属性速度：

```javascript
InertiaPlugin.track(".box", "x");
gsap.to(obj, { inertia: { x: "auto" } });
```

### Observer

统一 pointer、touch、wheel 输入，适合 swipe、scroll direction、自定义手势。

```javascript
gsap.registerPlugin(Observer);

Observer.create({
  target: "#area",
  type: "touch,pointer,wheel",
  tolerance: 10,
  onUp: () => {},
  onDown: () => {},
  onLeft: () => {},
  onRight: () => {}
});
```

## Text

### SplitText

把文本拆成 chars、words、lines，用于逐字/逐词/逐行动画。组件卸载或重排时需要 revert，或交给 `gsap.context()` / `useGSAP()` cleanup。

```javascript
gsap.registerPlugin(SplitText);

const split = SplitText.create(".heading", { type: "words, chars" });
gsap.from(split.chars, { opacity: 0, y: 20, stagger: 0.03, duration: 0.4 });

// later
split.revert();
```

`onSplit()` / `autoSplit` 场景：

```javascript
SplitText.create(".split", {
  type: "lines",
  autoSplit: true,
  onSplit(self) {
    return gsap.from(self.lines, { y: 100, opacity: 0, stagger: 0.05, duration: 0.5 });
  }
});
```

关键配置：

- `type`: `"chars"`、`"words"`、`"lines"` 组合。
- `aria`: 默认 `"auto"`，有助于辅助技术读取原始文本。
- `autoSplit`: 字体加载或宽度变化时重 split；动画必须在 `onSplit()` 内创建并返回。
- `mask`: `"lines"`、`"words"`、`"chars"`。
- `tag`: wrapper 元素，默认 `div`。
- `ignore`: 保持某些子元素不拆分。

只拆需要动画的粒度，避免过度拆分。SplitText 不支持 SVG `<text>`。

### ScrambleTextPlugin

用于 scramble/glitch reveal。

```javascript
gsap.registerPlugin(ScrambleTextPlugin);

gsap.to(".text", {
  duration: 1,
  scrambleText: { text: "New message", chars: "01", revealDelay: 0.5 }
});
```

## SVG

### DrawSVGPlugin

通过 animating `stroke-dashoffset` / `stroke-dasharray` 绘制或擦除 SVG stroke。元素必须有可见 `stroke` 和 `stroke-width`。

```javascript
gsap.registerPlugin(DrawSVGPlugin);

gsap.from("#path", { duration: 1, drawSVG: 0 });
gsap.fromTo("#path", { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1 });
gsap.to("#path", { duration: 1, drawSVG: "20% 80%" });
```

`drawSVG` 表示可见 stroke segment，不是“从 A 到 B”的语法。只影响 stroke，不影响 fill。

### MorphSVGPlugin

用于 SVG shape morph。支持 `<path>`、`<polyline>`、`<polygon>`；`circle`、`rect`、`ellipse`、`line` 可先 convertToPath。

```javascript
gsap.registerPlugin(MorphSVGPlugin);

MorphSVGPlugin.convertToPath("circle, rect, ellipse, line");

gsap.to("#diamond", { duration: 1, morphSVG: "#lightning", ease: "power2.inOut" });
gsap.to("#diamond", {
  duration: 1,
  morphSVG: { shape: "#lightning", type: "rotational", shapeIndex: 2 }
});
```

关键配置：`shape`、`type`、`map`、`shapeIndex`、`smooth`、`curveMode`、`origin`、`precision`、`precompile`。

### MotionPathPlugin

沿 SVG path 移动物体。

```javascript
gsap.registerPlugin(MotionPathPlugin);

gsap.to(".dot", {
  duration: 2,
  motionPath: { path: "#path", align: "#path", alignOrigin: [0.5, 0.5] }
});
```

常用配置：`path`、`align`、`alignOrigin`、`autoRotate`、`curviness`。

### MotionPathHelper

开发期可视化编辑 MotionPath：

```javascript
gsap.registerPlugin(MotionPathPlugin, MotionPathHelper);

const helper = MotionPathHelper.create(".dot", "#path", { end: 0.5 });
```

## Easing

### CustomEase

自定义 cubic-bezier 或 SVG path ease：

```javascript
gsap.registerPlugin(CustomEase);

const ease = CustomEase.create("name", ".17,.67,.83,.67");
gsap.to(".el", { x: 100, ease, duration: 1 });
```

### EasePack / CustomWiggle / CustomBounce

- EasePack：增加 SlowMo、RoughEase、ExpoScaleEase 等。
- CustomWiggle：wiggle/shake easing。
- CustomBounce：可配置 bounce easing。

## Physics

### Physics2DPlugin

```javascript
gsap.registerPlugin(Physics2DPlugin);

gsap.to(".ball", {
  duration: 2,
  physics2D: {
    velocity: 250,
    angle: 80,
    gravity: 500
  }
});
```

### PhysicsPropsPlugin

```javascript
gsap.registerPlugin(PhysicsPropsPlugin);

gsap.to(".obj", {
  duration: 2,
  physicsProps: {
    x: { velocity: 100, end: 300 },
    y: { velocity: -50, acceleration: 200 }
  }
});
```

## Development

### GSDevTools

开发期调试 timeline，不要发布到生产。

```javascript
gsap.registerPlugin(GSDevTools);
GSDevTools.create({ animation: tl });
```

### PixiPlugin

用于 PixiJS 对象动画：

```javascript
gsap.registerPlugin(PixiPlugin);

gsap.to(sprite, { pixi: { x: 200, y: 100, scale: 1.5 }, duration: 1 });
```

## Best practices

- 每个用到的插件都先 `gsap.registerPlugin()`。
- Layout transition 用 `Flip.getState()` → DOM change → `Flip.from()`。
- Drag momentum 用 `Draggable` + `InertiaPlugin`。
- SplitText 等会修改 DOM 的插件在组件卸载时 revert。
- 不要把 GSDevTools 或开发辅助插件发到生产。
- 不要使用过时的私有 registry、`.npmrc`、GreenSock token 或 Club GSAP 付费访问说明。