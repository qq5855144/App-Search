# 实现规则

本文档规范代码实现阶段的技术选型、引入方式和响应式设计。

---

## 技术栈

### 原型阶段（快速验证）

使用 CDN 引入，无需构建步骤，适合快速原型和简单页面。

```html
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Flowbite 组件库 -->
<link href="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js"></script>

<!-- Lucide 图标 -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>lucide.createIcons();</script>
```

### 生产阶段（正式项目）

使用 npm + 构建工具，支持 Tree Shaking、代码压缩、自动前缀。

```bash
# 初始化项目
npm create vite@latest my-project -- --template vanilla

# 安装依赖
npm install -D tailwindcss postcss autoprefixer
npm install flowbite lucide

# 初始化 Tailwind
npx tailwindcss init -p
```

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/flowbite/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [
    require('flowbite/plugin')
  ],
}
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --背景色: oklch(1 0 0);
    --前景色: oklch(0.145 0 0);
    --主色: oklch(0.205 0 0);
    --边框色: oklch(0.922 0 0);
    --圆角: 0.625rem;
  }
}
```

---

## 图片使用规范

### 允许的服务

| 服务 | 用途 | 示例 |
|------|------|------|
| Unsplash | 真实摄影图片 | `https://images.unsplash.com/photo-xxx?w=800&h=600&fit=crop` |
| placehold.co | 占位图/灰度图 | `https://placehold.co/600x400/e2e8f0/64748b?text=占位文字` |
| picsum.photos | 随机占位图 | `https://picsum.photos/800/600` |

### 禁止的行为

- **禁止虚构图片 URL**：如 `https://example.com/image.jpg` 会导致 404
- **禁止使用 `@latest` CDN**：生产环境必须锁定版本号
- **禁止使用未授权的图片**：确保有合法使用权

### 最佳实践

```html
<!-- 响应式图片 -->
<img 
  src="https://images.unsplash.com/photo-xxx?w=800&h=600&fit=crop"
  srcset="https://images.unsplash.com/photo-xxx?w=400 400w,
          https://images.unsplash.com/photo-xxx?w=800 800w,
          https://images.unsplash.com/photo-xxx?w=1200 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="描述图片内容的文字"
  loading="lazy"
>

<!-- 懒加载非首屏图片 -->
<img src="..." loading="lazy" alt="...">
```

---

## 响应式设计

### 断点定义

```css
/* 移动端优先 */
.container {
  padding: 1rem;
  width: 100%;
}

/* 平板：≥768px */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    max-width: 720px;
    margin: 0 auto;
  }
}

/* 桌面：≥1024px */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
    max-width: 1200px;
  }
}

/* 大屏：≥1440px */
@media (min-width: 1440px) {
  .container {
    max-width: 1400px;
  }
}
```

### Tailwind 断点速查

| 断点名 | 宽度 | Tailwind 前缀 | 常见用途 |
|--------|------|---------------|----------|
| 默认 | < 640px | 无前缀 | 手机竖屏 |
| sm | ≥ 640px | `sm:` | 手机横屏 |
| md | ≥ 768px | `md:` | 平板 |
| lg | ≥ 1024px | `lg:` | 笔记本 |
| xl | ≥ 1280px | `xl:` | 桌面显示器 |
| 2xl | ≥ 1536px | `2xl:` | 大屏显示器 |

### 移动端优先原则

**正确做法：**
```html
<!-- 默认是移动端样式，用 md: lg: 扩展到大屏 -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- 手机 1 列，平板 2 列，桌面 3 列 -->
</div>
```

**错误做法：**
```html
<!-- 不要从桌面端开始再用 max-width 缩小 -->
<div class="grid grid-cols-3 max-md:grid-cols-1">  <!-- 反模式 -->
</div>
```

---

## 字体加载

### Google Fonts 引入

```html
<!-- 在 <head> 中 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### 中文字体回退栈

```css
body {
  font-family: 
    'Inter',                    /* 西文字体 */
    'PingFang SC',              /* 苹果设备中文 */
    'Microsoft YaHei',          /* Windows 中文 */
    'Noto Sans SC',             /* Android/通用 */
    'WenQuanYi Micro Hei',      /* Linux 中文 */
    sans-serif;
}
```

### 性能提示

- 使用 `display=swap` 防止字体加载阻塞渲染
- 只加载需要的字重（如 400、500、600），不要加载全部 9 个字重
- 使用 `font-display: swap` 在自定义字体加载前显示系统字体
