# gsap.utils

## 目录

- [适用场景](#适用场景)
- [函数形式](#函数形式)
- [Clamping and ranges](#clamping-and-ranges)
- [Random and snap](#random-and-snap)
- [Units and parsing](#units-and-parsing)
- [Arrays and collections](#arrays-and-collections)
- [Best practices](#best-practices)

## 适用场景

`gsap.utils` 是一组纯辅助函数，不需要注册插件。适合：

- 数值 clamp / map / normalize / interpolate
- scroll progress 到动画值的映射
- random / snap / grid / stagger 辅助
- DOM collection 转数组
- component selector scope
- wrap / pipe 等函数式处理

## 函数形式

很多 utils 把要转换的值作为最后一个参数。如果省略最后的 value，会返回一个可复用函数。

```javascript
gsap.utils.clamp(0, 100, 150); // 100

const clampFn = gsap.utils.clamp(0, 100);
clampFn(150); // 100
clampFn(-10); // 0
```

例外：`random()` 要返回可复用函数时，需要把 `true` 作为最后一个参数，而不是省略 value。

## Clamping and ranges

### clamp(min, max, value?)

```javascript
gsap.utils.clamp(0, 100, 150); // 100
gsap.utils.clamp(0, 100, -10); // 0

const clampFn = gsap.utils.clamp(0, 100);
clampFn(42); // 42
```

### mapRange(inMin, inMax, outMin, outMax, value?)

把一个范围内的值映射到另一范围，常用于 progress/scroll/input 到 animation value。

```javascript
gsap.utils.mapRange(0, 100, 0, 500, 50); // 250
gsap.utils.mapRange(0, 1, 0, 360, 0.5); // 180

const mapProgressToRotation = gsap.utils.mapRange(0, 1, 0, 360);
mapProgressToRotation(0.25); // 90
```

### normalize(min, max, value?)

把值归一化到 0–1。

```javascript
gsap.utils.normalize(0, 100, 50); // 0.5

const normalizeScroll = gsap.utils.normalize(100, 300);
normalizeScroll(200); // 0.5
```

### interpolate(start, end, progress?)

在两个值之间插值。支持数字、颜色、对象。

```javascript
gsap.utils.interpolate(0, 100, 0.5); // 50
gsap.utils.interpolate("#ff0000", "#0000ff", 0.5);
gsap.utils.interpolate({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5);

const lerp = gsap.utils.interpolate(0, 100);
lerp(0.5); // 50
```

## Random and snap

### random(min, max[, snapIncrement, returnFunction]) / random(array[, returnFunction])

```javascript
gsap.utils.random(-100, 100);
gsap.utils.random(0, 500, 5);
gsap.utils.random(["red", "blue", "green"]);

const randomFn = gsap.utils.random(-200, 500, 10, true);
randomFn();

const randomFromArray = gsap.utils.random([0, 100, 200], true);
randomFromArray();
```

Tween vars 中可用字符串形式，GSAP 会对每个 target 计算：

```javascript
gsap.to(".box", { x: "random(-100, 100, 5)", duration: 1 });
gsap.to(".item", { backgroundColor: "random([red, blue, green])" });
```

### snap(snapTo, value?)

```javascript
gsap.utils.snap(10, 23); // 20
gsap.utils.snap(0.25, 0.7); // 0.75
gsap.utils.snap([0, 100, 200], 150); // 100 or 200

const snapFn = gsap.utils.snap(10);
snapFn(23); // 20
```

Tween 中可用于属性 snap：

```javascript
gsap.to(".x", { x: 200, snap: { x: 20 } });
```

### shuffle(array)

```javascript
gsap.utils.shuffle([1, 2, 3, 4]);
```

### distribute(config)

返回一个函数，根据 target index/grid 分配值。可直接传给 tween property。

```javascript
gsap.to(".class", {
  scale: gsap.utils.distribute({
    base: 0.5,
    amount: 2.5,
    from: "center"
  })
});
```

常用配置：`base`、`amount`、`each`、`from`、`grid`、`axis`、`ease`。

手动调用时函数参数为 `(index, target, targets)`：

```javascript
const targets = gsap.utils.toArray(".box");
const distributor = gsap.utils.distribute({ base: 50, amount: 100, from: "center" });
const value = distributor(2, targets[2], targets);
```

## Units and parsing

### getUnit(value)

```javascript
gsap.utils.getUnit("100px"); // "px"
gsap.utils.getUnit("50%"); // "%"
gsap.utils.getUnit(42); // ""
```

### unitize(value, unit)

```javascript
gsap.utils.unitize(100, "px"); // "100px"
gsap.utils.unitize("2rem", "px"); // "2rem"
```

### splitColor(color, returnHSL?)

```javascript
gsap.utils.splitColor("red"); // [255, 0, 0]
gsap.utils.splitColor("#6fb936");
gsap.utils.splitColor("rgba(204, 153, 51, 0.5)");
gsap.utils.splitColor("#6fb936", true); // HSL
```

## Arrays and collections

### selector(scope)

创建 scoped selector，适合组件内部 selector，避免 `.box` 匹配到整个 document。

```javascript
const q = gsap.utils.selector(container);

gsap.to(q(".box"), { x: 100 });
```

React 中也可传 ref：

```javascript
const q = gsap.utils.selector(containerRef);
gsap.from(q(".item"), { autoAlpha: 0, stagger: 0.1 });
```

### toArray(targets)

把 selector、NodeList、array-like 转成真正数组。

```javascript
const items = gsap.utils.toArray(".item");
items.forEach((item, i) => {
  gsap.to(item, { x: i * 20 });
});
```

### wrap(values) / wrap(min, max, value?)

循环包裹值或数组索引。

```javascript
const wrapIndex = gsap.utils.wrap(0, 3);
wrapIndex(4); // 1

const colors = gsap.utils.wrap(["red", "green", "blue"]);
colors(4); // "green"
```

### pipe(...functions)

把多个函数组合成一个 pipeline。

```javascript
const transform = gsap.utils.pipe(
  gsap.utils.clamp(0, 100),
  gsap.utils.mapRange(0, 100, 0, 1),
  gsap.utils.snap(0.1)
);

transform(57); // 0.6
```

## Best practices

- 需要重复同一转换时，使用返回函数形式，避免重复创建配置。
- `random()` 的可复用函数形式要传 `true`。
- 在组件中用 `selector(scope)` 或 `gsap.context()` 限制 selector 范围。
- `toArray()` 适合统一处理 selector、NodeList、array。
- 在高频事件中复用 utils 函数，不要每帧重复创建。