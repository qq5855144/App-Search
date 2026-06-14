# GSAP with Vue, Nuxt, Svelte, and Other Frameworks

## 适用场景

用于 Vue、Nuxt、Svelte、SvelteKit 等非 React 框架中的 GSAP 动画。React 参考 `react.md`。

通用原则：

- DOM 可用之后再创建 GSAP 动画，例如 `onMounted` / `onMount`。
- 组件卸载时 cleanup/revert，避免 detached nodes 和内存泄漏。
- selector scope 到组件根节点，避免影响其它组件。
- SSR 框架中不要在服务端直接访问 DOM 或运行 GSAP 动画。

## Vue 3 Composition API

```javascript
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default {
  setup() {
    const container = ref(null);
    let ctx;

    onMounted(() => {
      if (!container.value) return;

      ctx = gsap.context(() => {
        gsap.to(".box", { x: 100, duration: 0.6 });
        gsap.from(".item", { autoAlpha: 0, y: 20, stagger: 0.1 });
      }, container.value);
    });

    onUnmounted(() => {
      ctx?.revert();
    });

    return { container };
  }
};
```

关键点：

- `gsap.context(callback, container.value)` 用于 selector scope 和 cleanup tracking。
- `onUnmounted` 中调用 `ctx.revert()`。
- 插件注册放到 app 初始化或模块顶层，避免重复注册。

## Vue 3 `<script setup>`

```javascript
<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";

const container = ref(null);
let ctx;

onMounted(() => {
  if (!container.value) return;

  ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
    gsap.from(".item", { autoAlpha: 0, stagger: 0.1 });
  }, container.value);
});

onUnmounted(() => {
  ctx?.revert();
});
</script>

<template>
  <div ref="container">
    <div class="box">Box</div>
    <div class="item">Item</div>
  </div>
</template>
```

## Nuxt

Nuxt 是 SSR 框架，GSAP 动画应在客户端 lifecycle 中运行。常见做法是创建 composable 或 plugin，集中注册常用插件，并按需 lazy-load 不常用插件。

```typescript
// composables/useGSAP.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const pluginMap = {
  Flip: () => import("gsap/Flip"),
  Draggable: () => import("gsap/Draggable"),
  SplitText: () => import("gsap/SplitText"),
  MorphSVGPlugin: () => import("gsap/MorphSVGPlugin"),
  ScrollSmoother: () => import("gsap/ScrollSmoother"),
  ScrollToPlugin: () => import("gsap/ScrollToPlugin")
} as const;

export function useGSAP() {
  async function lazyLoadPlugin<K extends keyof typeof pluginMap>(plugin: K) {
    const module = await pluginMap[plugin]();
    const pluginExport = module[plugin as keyof typeof module];
    gsap.registerPlugin(pluginExport);
    return pluginExport;
  }

  return { gsap, ScrollTrigger, lazyLoadPlugin };
}
```

组件中仍然使用 mounted/unmounted 模式：

```javascript
const container = ref(null);
let ctx;
const { gsap } = useGSAP();

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
  }, container.value);
});

onUnmounted(() => ctx?.revert());
```

## Svelte / SvelteKit

使用 `onMount`，并从 `onMount` 返回 cleanup 函数。

```svelte
<script>
  import { onMount } from "svelte";
  import { gsap } from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";

  gsap.registerPlugin(ScrollTrigger);

  let container;

  onMount(() => {
    if (!container) return;

    const ctx = gsap.context(() => {
      gsap.to(".box", { x: 100 });
      gsap.from(".item", { autoAlpha: 0, stagger: 0.1 });
    }, container);

    return () => ctx.revert();
  });
</script>

<div bind:this={container}>
  <div class="box">Box</div>
  <div class="item">Item</div>
</div>
```

SvelteKit 中同样避免 SSR 期间访问 DOM。`onMount` 只在客户端运行，因此适合创建 GSAP 动画。

## ScrollTrigger cleanup

在组件中创建 ScrollTrigger 时，让它进入 `gsap.context()`，卸载时 `ctx.revert()` 会一起清理。

```javascript
ctx = gsap.context(() => {
  gsap.to(".panel", {
    x: 100,
    scrollTrigger: {
      trigger: ".panel",
      start: "top center",
      end: "bottom center",
      scrub: true
    }
  });
}, container.value);
```

动态内容、图片、字体导致布局改变后，调用：

```javascript
ScrollTrigger.refresh();
```

## Best practices

- DOM ready 后创建动画。
- 组件卸载时 `ctx.revert()`。
- selector scope 到组件根节点。
- SSR 中只在客户端生命周期运行 GSAP。
- 不常用插件可 lazy-load，减少初始 bundle。
- ScrollTrigger 创建后布局变化时调用 `ScrollTrigger.refresh()`。
- 不要在组件 render/setup 阶段直接查询 DOM 并启动动画。