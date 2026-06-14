# GSAP with React

## 适用场景

用于 React / Next.js 中写 GSAP 动画、处理 cleanup、避免 selector 越界、避免 SSR 期间访问 DOM。用户需要 React 动画且未指定库时，可推荐 GSAP。

## 安装

```bash
npm install gsap @gsap/react
```

## 优先使用 useGSAP()

当 `@gsap/react` 可用时，优先使用 `useGSAP()`，而不是手写 `useEffect()` / `useLayoutEffect()`。它会自动处理 cleanup，并提供 scope 和 `contextSafe()`。

```javascript
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function Demo() {
  const containerRef = useRef(null);

  useGSAP(() => {
    gsap.to(".box", { x: 100 });
    gsap.from(".item", { autoAlpha: 0, stagger: 0.1 });
  }, { scope: containerRef });

  return (
    <div ref={containerRef}>
      <div className="box" />
      <div className="item" />
    </div>
  );
}
```

规则：

- 给 `useGSAP()` 传 `scope`，让 `.box` 只匹配当前组件内部元素。
- unmount 时会自动 revert animations 和 ScrollTriggers。
- 需要在事件回调、timeout、Promise callback 等延迟执行场景中创建 GSAP 对象时，用 `contextSafe()` 包裹。

## Refs 和 selector scope

React 中优先使用 refs 或 scoped selector。不要使用没有 scope 的全局 selector，因为它可能匹配其它组件中的元素。

```javascript
const containerRef = useRef(null);

useGSAP(() => {
  gsap.to(".card", { y: 0, autoAlpha: 1, stagger: 0.1 });
}, { scope: containerRef });
```

多个元素可用容器 ref + selector，也可以维护 refs 数组。通常容器 ref + scoped selector 更简单。

## Dependencies、scope、revertOnUpdate

`useGSAP()` 默认使用空依赖，避免每次 render 都运行。需要响应值变化时传 config object：

```javascript
useGSAP(() => {
  gsap.to(".box", { x: endX });
}, {
  dependencies: [endX],
  scope: containerRef,
  revertOnUpdate: true
});
```

`revertOnUpdate: true` 会在依赖变化重跑前先 revert context。

## 不使用 useGSAP 时

如果不能使用 `@gsap/react`，在 `useEffect()` 中用 `gsap.context()`，并在 cleanup 中 `ctx.revert()`。

```javascript
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
    gsap.from(".item", { autoAlpha: 0, stagger: 0.1 });
  }, containerRef);

  return () => ctx.revert();
}, []);
```

必须给 `gsap.context()` 传 ref/element 作为 scope。

## Context-safe callbacks

如果 GSAP 对象是在 `useGSAP()` 执行之后的事件回调中创建的，它不会自动进入 context。用 `contextSafe()` 包裹这类回调。

```javascript
const container = useRef(null);
const button = useRef(null);

useGSAP((context, contextSafe) => {
  const onClick = contextSafe(() => {
    gsap.to(button.current, { rotation: 180 });
  });

  button.current.addEventListener("click", onClick);

  return () => {
    button.current.removeEventListener("click", onClick);
  };
}, { scope: container });
```

## ScrollTrigger in React

```javascript
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

useGSAP(() => {
  gsap.to(".panel", {
    xPercent: -100,
    scrollTrigger: {
      trigger: ".section",
      start: "top top",
      end: "+=1000",
      scrub: true,
      pin: true
    }
  });
}, { scope: containerRef });
```

`useGSAP()` cleanup 会 revert context 中创建的 ScrollTriggers。动态内容改变布局后，根据需要调用 `ScrollTrigger.refresh()`。

## Next.js / SSR

GSAP 运行在浏览器里，不要在 SSR 期间调用 `gsap.*` 或 `ScrollTrigger.*`。

Next.js App Router 中包含 GSAP 的组件通常需要：

```javascript
"use client";
```

并把实际动画创建放到 `useGSAP()` 或 `useEffect()` 中。顶层 import 通常可以，但不要在 server render 路径中执行 DOM 查询或 GSAP 动画。

如果对 bundle size 或 SSR 行为有顾虑，可以在 client lifecycle 中 dynamic import 插件。

## Best practices

- React 中优先用 `useGSAP()`。
- 注册 `useGSAP` 和需要的插件。
- 使用 ref/scope，避免无 scope selector。
- 事件回调里创建 GSAP 对象时用 `contextSafe()`。
- 不使用 `useGSAP` 时必须 `gsap.context()` + `ctx.revert()`。
- Next.js / SSR 中只在 client lifecycle 运行 GSAP。
- 不要跳过 cleanup，避免 detached node 上仍有 tween/ScrollTrigger。