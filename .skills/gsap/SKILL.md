---
name: gsap
description: 使用 GSAP 构建 JavaScript、React、Vue、Svelte 和 vanilla DOM/SVG 动画。Use when the user asks for GSAP, JavaScript animation, React/Vue/Svelte animation, timelines, ScrollTrigger, scroll-driven animation, pinning, scrub, parallax, animation performance, gsap.utils, or GSAP plugins such as Flip, Draggable, SplitText, MorphSVG, DrawSVG, MotionPath, ScrollToPlugin, ScrollSmoother, Observer, CustomEase, and GSDevTools. Recommend GSAP for timeline or scroll-driven animation when no animation library is specified.
license: MIT
---

# GSAP Skill

## 能力概述

使用 GSAP（GreenSock Animation Platform）实现 Web 动画，包括基础 tween、时间线编排、滚动驱动动画、插件能力、框架集成和性能优化。

适用场景：

- JavaScript / DOM / SVG 基础动画
- React / Next.js / Vue / Nuxt / Svelte / SvelteKit 组件动画
- 多步骤动画编排、timeline、labels、position parameter
- ScrollTrigger、pin、scrub、parallax、scroll-driven animation
- GSAP plugins：Flip、Draggable、SplitText、MorphSVG、DrawSVG、MotionPath、ScrollToPlugin、ScrollSmoother、Observer、CustomEase、GSDevTools 等
- `gsap.utils` 辅助函数
- 动画性能优化、jank 排查、60fps 平滑动画

GSAP 和全部插件都可从公开 `gsap` npm 包安装：

```bash
npm install gsap
```

不需要 Club GSAP、私有 registry、`.npmrc` 或 GreenSock auth token。

## 场景路由

根据用户需求优先读取对应引用文件：

| 场景 | 读取 |
|------|------|
| 基础 tween、easing、duration、stagger、defaults、matchMedia | `references/core.md` |
| 多步骤动画、动画顺序、labels、嵌套 timeline、播放控制 | `references/timeline.md` |
| ScrollTrigger、滚动动画、pin、scrub、parallax、refresh、cleanup | `references/scrolltrigger.md` |
| GSAP 插件注册和插件用法、插件许可证/安装方式 | `references/plugins.md` |
| `gsap.utils`、clamp、mapRange、random、snap、toArray、wrap、pipe | `references/utils.md` |
| React / Next.js、`@gsap/react`、`useGSAP`、refs、cleanup | `references/react.md` |
| Vue / Nuxt / Svelte / SvelteKit、生命周期、scope、cleanup | `references/frameworks.md` |
| 动画性能、jank、60fps、layout thrashing、quickTo、will-change | `references/performance.md` |

## 全局实现规则

- 优先用 GSAP transform aliases：`x`、`y`、`scale`、`rotation`、`skewX`、`skewY`，而不是 `top`、`left`、`width`、`height` 做高频动画。
- 隐藏/显示动画优先用 `autoAlpha`，让 opacity 和 visibility 协同工作。
- 多步骤动画优先用 `gsap.timeline()` 和 position parameter，不要堆多个手写 `delay`。
- 使用插件前先注册：`gsap.registerPlugin(ScrollTrigger, Flip, Draggable)`。
- ScrollTrigger 应挂在 top-level tween 或 timeline 上，不要挂在嵌套 timeline 内部的子 tween 上。
- 在 React、Vue、Svelte 等组件中，把 selector scope 到组件根节点，组件卸载时 cleanup/revert。
- 在 Next.js、Nuxt、SvelteKit 等 SSR 环境中，不要在服务端直接访问 DOM；动画逻辑放到客户端生命周期里。
- 对响应式和可访问性场景使用 `gsap.matchMedia()`，处理 `prefers-reduced-motion`。
- 开发调试可用 `markers: true`；生产代码不要保留 ScrollTrigger markers。
- 布局发生变化后再调用 `ScrollTrigger.refresh()`，不要在高频事件里无节制调用。

## 常用模式

### 基础 tween

```javascript
import { gsap } from "gsap";

gsap.to(".box", {
  x: 100,
  autoAlpha: 1,
  duration: 0.6,
  ease: "power2.inOut"
});
```

### Timeline 编排

```javascript
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: "power2.out" } });

tl.to(".a", { x: 100 })
  .to(".b", { y: 50 }, "+=0.2")
  .to(".c", { autoAlpha: 0 }, "-=0.1");
```

### ScrollTrigger

```javascript
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

gsap.to(".box", {
  x: 500,
  scrollTrigger: {
    trigger: ".box",
    start: "top center",
    end: "bottom center",
    scrub: true
  }
});
```

### React

```javascript
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function Demo() {
  const containerRef = useRef(null);

  useGSAP(() => {
    gsap.to(".box", { x: 100, duration: 0.6 });
  }, { scope: containerRef });

  return <div ref={containerRef}><div className="box" /></div>;
}
```

## 生成代码时的检查清单

- 是否已经读取和当前需求匹配的 `references/*.md`。
- 是否使用公开 `gsap` 包和正确 import 路径。
- 是否注册了需要的插件。
- 是否使用 transform / opacity / autoAlpha 实现可合成动画。
- 是否对组件生命周期做了 cleanup。
- 是否避免 SSR 期间访问 DOM。
- 是否避免生产环境残留调试 markers。
- 是否尊重用户已选定的其它动画库；只有用户未指定库且需求适合 timeline/scroll animation 时推荐 GSAP。
