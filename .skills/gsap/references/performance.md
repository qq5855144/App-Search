# GSAP Performance

## 适用场景

用于优化 GSAP 动画性能、减少 jank、保持 60fps、排查 layout thrashing、ScrollTrigger 性能问题，以及用户问动画卡顿、FPS、smoothness 时。

## 优先 transform 和 opacity

浏览器最容易高性能处理的是 transform 和 opacity。GSAP 的 `x`、`y` 等是 transform aliases，应优先使用。

优先：

- `x`
- `y`
- `scale`
- `rotation`
- `opacity`
- `autoAlpha`

尽量避免高频动画：

- `width`
- `height`
- `top`
- `left`
- `margin`
- `padding`

移动元素时：

```javascript
// 推荐
gsap.to(".box", { x: 200, duration: 0.6 });

// 尽量避免用于高频动画
gsap.to(".box", { left: 200, duration: 0.6 });
```

`autoAlpha` 在 opacity 为 0 时还会设置 `visibility: hidden`，可避免不可见元素阻挡点击。

## will-change

只给确实会动画的元素使用：

```css
.card {
  will-change: transform;
}
```

不要给大量元素或全站元素“以防万一”设置 `will-change`，这会浪费内存和图层资源。

## 避免 layout thrashing

GSAP 会批量处理内部更新。若混合直接 DOM reads/writes，避免交错读写：

```javascript
// 不推荐：循环中读写交错，可能反复触发布局
items.forEach((item) => {
  const height = item.offsetHeight;
  item.style.transform = `translateY(${height}px)`;
});

// 推荐：先读，后写
const heights = items.map((item) => item.offsetHeight);
items.forEach((item, i) => {
  gsap.set(item, { y: heights[i] });
});
```

## 多元素动画

相同动画作用到很多元素时，用一个 tween + `stagger`，不要创建大量手写 delay 的独立 tween。

```javascript
gsap.from(".item", {
  autoAlpha: 0,
  y: 20,
  stagger: 0.08,
  duration: 0.4,
  ease: "power2.out"
});
```

长列表考虑 virtualization，或只动画可见元素。避免一次创建几百个同时运行的复杂 tween。

## 高频更新使用 quickTo()

鼠标跟随、drag、pointer move 等高频事件中，不要每次事件都创建新 tween。用 `gsap.quickTo()` 复用 tween。

```javascript
const xTo = gsap.quickTo("#cursor", "x", { duration: 0.4, ease: "power3" });
const yTo = gsap.quickTo("#cursor", "y", { duration: 0.4, ease: "power3" });

document.querySelector("#container").addEventListener("mousemove", (event) => {
  xTo(event.pageX);
  yTo(event.pageY);
});
```

## ScrollTrigger 性能

- `pin: true` 只用于需要 pin 的区域。
- 不要直接动画 pinned element；动画其子元素。
- `scrub` 可用数字如 `scrub: 1` 增加平滑感，但需要在低端设备测试。
- `ScrollTrigger.refresh()` 只在布局实际变化后调用，不要每个 resize/mousemove 都调用。
- 动态内容变化频繁时 debounce refresh。
- 创建 ScrollTrigger 时尽量按页面从上到下顺序，或设置 `refreshPriority`。

```javascript
let refreshTimeout;

function scheduleRefresh() {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => ScrollTrigger.refresh(), 100);
}
```

## 减少同时工作量

- 不可见、离屏或已卸载区域的动画应 pause、kill 或 revert。
- SPA route change 时清理旧页面动画和 ScrollTriggers。
- 简化复杂 SVG、减少同时 morph 的路径数量。
- SplitText 只拆分需要动画的 chars/words/lines。
- 对 prefers-reduced-motion 用户跳过或缩短动画。

```javascript
const mm = gsap.matchMedia();

mm.add("(prefers-reduced-motion: reduce)", () => {
  gsap.set(".animated", { clearProps: "all" });
});
```

## 常见问题定位

### 动画移动卡顿

检查是否动画了 `left/top/width/height`。能用 `x/y/scale` 实现时改用 transform。

### 滚动动画触发点错位

检查图片、字体、动态内容加载后是否调用 `ScrollTrigger.refresh()`。

### React/Vue 页面切换后仍在运行

检查是否用了 `useGSAP()` / `gsap.context()`，卸载时是否 `ctx.revert()`。

### 鼠标跟随掉帧

检查是否在 `mousemove` 中反复 `gsap.to()`，改用 `gsap.quickTo()`。

### 文本动画卡顿

检查 SplitText 是否拆了过多字符，是否只动画需要的粒度；大量文字优先按 words/lines，而不是 chars。

## Best practices

- 首选 transform 和 opacity。
- 用 `autoAlpha` 处理隐藏/显示。
- 用 `stagger` 处理批量相似动画。
- 高频更新用 `quickTo()`。
- 谨慎使用 `will-change`。
- 动态布局变化后再 `ScrollTrigger.refresh()`，必要时 debounce。
- 组件卸载和 route change 时 cleanup。
- 不要把调试 markers、GSDevTools 发到生产。