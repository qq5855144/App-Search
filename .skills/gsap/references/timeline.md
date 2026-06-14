# GSAP Timeline

## 适用场景

用于多步骤动画、顺序编排、并行动画、labels、播放控制，以及用户提到 timeline、sequencing、keyframes、animation order、choreograph 等场景。

单个 tween 参考 `core.md`；滚动驱动 timeline 参考 `scrolltrigger.md`。

## 创建 timeline

```javascript
const tl = gsap.timeline();

tl.to(".a", { x: 100, duration: 1 })
  .to(".b", { y: 50, duration: 0.5 })
  .to(".c", { autoAlpha: 0, duration: 0.3 });
```

默认情况下，后续 tween 会追加到前一个 tween 之后。多步骤动画优先用 timeline，不要靠多个 `delay` 串起来。

## Position parameter

第三个参数控制 tween 在 timeline 中的位置：

- `1`：绝对时间，第 1 秒开始。
- `"+=0.5"`：前一个动画结束后 0.5 秒开始。
- `"-=0.2"`：前一个动画结束前 0.2 秒开始。
- `"labelName"`：在 label 处开始。
- `"labelName+=0.3"`：label 后 0.3 秒开始。
- `"<"`：和最近添加的动画同时开始。
- `">"`：在最近添加的动画结束时开始。
- `"<0.2"`：最近添加的动画开始后 0.2 秒开始。

```javascript
tl.to(".a", { x: 100 }, 0);
tl.to(".b", { y: 50 }, "+=0.5");
tl.to(".c", { autoAlpha: 0 }, "<");
tl.to(".d", { scale: 2 }, "<0.2");
```

## Timeline defaults

多个子 tween 共享 duration/ease 时，把默认值放到 timeline 构造参数里。

```javascript
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: "power2.out" } });

tl.to(".a", { x: 100 })
  .to(".b", { y: 50 });
```

注意：timeline 构造参数里的 `duration` 不是给整个 timeline 设置总时长；timeline 的总时长由子动画决定。共享子动画时长应使用 `defaults: { duration: ... }`。

## Timeline options

常用构造选项：

- `paused: true`：创建后暂停，手动 `.play()`。
- `repeat`、`yoyo`：作用于整个 timeline。
- `onStart`、`onUpdate`、`onComplete`：timeline 生命周期回调。
- `defaults`：合并到所有 child tweens。

## Labels

用 label 让编排更可读。

```javascript
const tl = gsap.timeline({ defaults: { duration: 0.5 } });

tl.addLabel("intro", 0);
tl.to(".a", { x: 100 }, "intro");
tl.addLabel("outro", "+=0.5");
tl.to(".b", { autoAlpha: 0 }, "outro");

tl.play("outro");
tl.tweenFromTo("intro", "outro");
```

## 嵌套 timeline

Timeline 可以包含其它 timeline。

```javascript
const master = gsap.timeline();
const child = gsap.timeline();

child.to(".a", { x: 100 }).to(".b", { y: 50 });
master.add(child, 0);
master.to(".c", { autoAlpha: 0 }, "+=0.2");
```

不要把含有 ScrollTrigger 的动画嵌套进 parent timeline。ScrollTrigger 应只挂在 top-level tween 或 top-level timeline 上。

## 播放控制

```javascript
tl.play();
tl.pause();
tl.reverse();
tl.restart();
tl.time(2);
tl.progress(0.5);
tl.kill();
```

常见模式：

```javascript
const tl = gsap.timeline({ paused: true });
tl.to(".menu", { x: 0, duration: 0.4 })
  .from(".menu-item", { autoAlpha: 0, y: 10, stagger: 0.05 }, "-=0.2");

button.addEventListener("click", () => {
  tl.reversed() ? tl.play() : tl.reverse();
});
```

## ScrollTrigger 配合 timeline

ScrollTrigger 应挂在 timeline 构造参数中：

```javascript
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".section",
    start: "top center",
    end: "bottom center",
    scrub: true
  }
});

tl.to(".panel", { x: 100 })
  .to(".panel", { rotation: 5, duration: 0.7 });
```

不要这样写：

```javascript
// 错误：不要把 ScrollTrigger 放到 timeline 内部 child tween 上
gsap.timeline().to(".a", { x: 100, scrollTrigger: { trigger: ".a" } });
```

## Best practices

- 多步骤动画优先 timeline。
- 用 position parameter 控制开始时间和重叠关系。
- 用 labels 提升可维护性。
- 用 `defaults` 共享 duration/ease。
- ScrollTrigger 放在 top-level tween/timeline 上。
- 不要用大量 `delay` 模拟顺序编排。
- 不要误以为 timeline 构造里的 `duration` 会平均应用到 child tweens。