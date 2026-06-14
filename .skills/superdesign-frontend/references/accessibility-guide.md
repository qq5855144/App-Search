# 无障碍设计指南

本文档规范前端代码的无障碍（Accessibility, a11y）要求，确保界面对所有用户（包括使用辅助技术的用户）可用。

---

## 1. 语义化 HTML

使用正确的 HTML 标签表达内容含义，而非仅为了样式。

### 标签使用规范

| 不要用 | 要用 | 原因 |
|--------|------|------|
| `<div class="header">` | `<header>` | 屏幕阅读器可识别页面区域 |
| `<div class="nav">` | `<nav>` | 辅助技术可跳转至导航 |
| `<div class="main">` | `<main>` | 标识主要内容区域 |
| `<div class="section">` | `<section>` | 有主题的独立内容块 |
| `<div class="article">` | `<article>` | 可独立分发或复用的内容 |
| `<div class="footer">` | `<footer>` | 页脚区域 |
| `<span class="button">` | `<button>` | 键盘可聚焦、可触发 |
| `<div onclick="...">` | `<button>` 或 `<a href="...">` | 键盘和屏幕阅读器兼容 |

### 完整页面结构示例

```html
<body>
  <header>
    <nav aria-label="主导航">...导航链接...</nav>
  </header>

  <main>
    <section aria-labelledby="功能标题">
      <h2 id="功能标题">核心功能</h2>
      ...内容...
    </section>
  </main>

  <footer>...版权信息...</footer>
</body>
```

---

## 2. 标题层级

标题（`h1`–`h6`）不仅是样式工具，更是页面结构的导航地图。

### 规范

- **每个页面只有一个 `h1`**：它是页面的主标题
- **标题层级不可跳**：`h1` → `h2` → `h3`，不要 `h1` → `h3`
- **不要仅为样式使用标题**：需要大字用 CSS `font-size`

### 正确示例

```html
<h1>产品名称 — 一句话价值主张</h1>

<section>
  <h2>核心功能</h2>
  <article>
    <h3>功能一：自动化工作流</h3>
    <p>详细描述...</p>
  </article>
  <article>
    <h3>功能二：实时协作</h3>
    <p>详细描述...</p>
  </article>
</section>

<section>
  <h2>客户评价</h2>
  ...</section>
```

---

## 3. ARIA 标签

当语义化 HTML 不足以表达元素含义时，使用 ARIA 属性补充。

### 常用属性

| 属性 | 用途 | 示例 |
|------|------|------|
| `aria-label` | 为无文本元素提供标签 | `<button aria-label="关闭弹窗">×</button>` |
| `aria-labelledby` | 指向其他元素的 ID 作为标签 | `<section aria-labelledby="标题1"><h2 id="标题1">...</h2></section>` |
| `aria-describedby` | 提供额外描述 | `<input aria-describedby="密码规则"><span id="密码规则">至少8位字符</span>` |
| `aria-expanded` | 展开/折叠状态 | `<button aria-expanded="false" aria-controls="菜单">展开菜单</button>` |
| `aria-hidden="true"` | 对辅助技术隐藏 | 装饰性图标、纯视觉元素 |
| `role` | 定义元素角色 | `<div role="alert">错误信息</div>` |

### 不要过度使用 ARIA

```html
<!-- 错误：button 本身已有语义，无需 role -->
<button role="button">点击</button>

<!-- 正确 -->
<button>点击</button>

<!-- 错误：aria-label 和 visible text 重复 -->
<button aria-label="提交表单">提交</button>

<!-- 正确 -->
<button>提交</button>
```

---

## 4. 色彩对比度

文字与背景之间必须有足够的对比度，确保低视力用户和强光环境下可读。

### 标准要求

| 场景 | 最低对比度 | 推荐对比度 |
|------|-----------|-----------|
| 正文文字（小于 18px） | 4.5:1 | 7:1 |
| 大文字（18px 以上或 14px 以上粗体） | 3:1 | 4.5:1 |
| UI 组件（按钮边框、图标） | 3:1 | — |

### 检测工具

- 在线工具：[WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- 浏览器 DevTools：Chrome/Firefox 的元素审查中有对比度提示
- Figma 插件：Stark、Contrast

### 示例

```css
/* 对比度约 12:1，优秀 */
.正文 {
  color: #1a1a1a;
  background: #ffffff;
}

/* 对比度约 4.6:1，刚好达标但不推荐 */
.次要文字 {
  color: #71717a;
  background: #ffffff;
}

/* 对比度约 2.1:1，不达标！禁止用于正文 */
.危险 {
  color: #a1a1aa;
  background: #f4f4f5;
}
```

---

## 5. 键盘导航

所有交互功能必须可通过键盘操作，不依赖鼠标。

### 基本要求

| 按键 | 行为 |
|------|------|
| `Tab` | 在可聚焦元素之间顺序移动 |
| `Shift + Tab` | 反向移动 |
| `Enter` / `Space` | 激活按钮或链接 |
| `Escape` | 关闭弹窗、下拉菜单、模态框 |
| `↑↓←→` | 在列表、菜单、选项卡中导航 |

### 焦点可见性

```css
/* 永远不要移除焦点样式，只应美化它 */
:focus-visible {
  outline: 2px solid var(--主色);
  outline-offset: 2px;
}

/* 错误做法：完全移除焦点 */
:focus {
  outline: none;  /* 禁用！键盘用户无法知道焦点在哪 */
}
```

### 焦点顺序

确保 Tab 顺序符合视觉顺序（从上到下、从左到右）：

```html
<!-- 正确：视觉顺序与 DOM 顺序一致 -->
<form>
  <input type="text" placeholder="姓名">
  <input type="email" placeholder="邮箱">
  <button type="submit">提交</button>
</form>

<!-- 错误：用 CSS 把 DOM 顺序打乱 -->
<div class="flex flex-row-reverse">
  <!-- 视觉上邮箱在左、姓名在右 -->
  <!-- 但 Tab 顺序仍是姓名 → 邮箱，造成困惑 -->
  <input placeholder="姓名">
  <input placeholder="邮箱">
</div>
```

### 跳过导航链接

为键盘用户提供直接跳转到主内容的链接：

```html
<a href="#主内容" class="跳过链接">跳转到主内容</a>

...

<main id="主内容">...主内容...</main>
```

```css
.跳过链接 {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
  transition: top 0.3s;
}

.跳过链接:focus {
  top: 0;  /* 聚焦时显示 */
}
```

---

## 6. 图片与媒体

### 图片必须提供替代文本

```html
<!-- 正确：有意义的 alt 文字 -->
<img src="产品截图.png" alt="仪表盘界面，左侧为导航栏，右侧展示数据分析图表">

<!-- 正确：装饰性图片用空 alt -->
<img src="装饰背景.png" alt="">

<!-- 错误：无 alt 属性 -->
<img src="产品截图.png">

<!-- 错误：alt 无意义 -->
<img src="产品截图.png" alt="图片">
```

### 复杂图像

图表、流程图等复杂图像需提供详细描述：

```html
<figure>
  <img src="流程图.png" alt="用户注册流程图，详见下方描述">
  <figcaption>
    注册流程：1. 用户填写邮箱和密码 2. 系统发送验证邮件 
    3. 用户点击验证链接 4. 完成注册
  </figcaption>
</figure>
```

### 视频与音频

| 类型 | 无障碍要求 |
|------|-----------|
| 视频 | 提供字幕（captions）和文字稿（transcript） |
| 音频 | 提供文字稿 |
| 自动播放 | **禁止**自动播放有声内容（可静音自动播放） |
| 闪烁内容 | 避免每秒闪烁超过 3 次的内容（可能诱发癫痫） |
