# 组件设计技巧

本文档提供常用 UI 组件的设计规范和实现要点。

---

## 卡片（Cards）

### 设计要点

- **阴影 subtle**：最多 1-2 层，避免沉重感
- **内边距一致**：通常 `p-4` 到 `p-6`（16px-24px）
- **悬停反馈**：轻微上浮 + 阴影扩散
- **圆角统一**：与整体设计语言一致（现代风 0.5rem，粗野风 0px）

### 代码示例

```html
<article class="卡片">
  <img src="..." alt="卡片配图" class="卡片图片">
  <div class="卡片内容">
    <h3 class="卡片标题">卡片标题</h3>
    <p class="卡片描述">简短描述文字...</p>
  </div>
</article>
```

```css
.卡片 {
  background: var(--背景色);
  border-radius: var(--圆角);
  border: 1px solid var(--边框色);
  overflow: hidden;
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}

.卡片:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.卡片图片 {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.卡片内容 {
  padding: 1.5rem;
}

.卡片标题 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.卡片描述 {
  color: var(--静音前景);
  line-height: 1.5;
}
```

---

## 按钮（Buttons）

### 设计要点

- **视觉层级清晰**：主按钮、次按钮、幽灵按钮三种级别
- **触控区域足够**：最小 44×44px（移动端）
- **状态完整**：默认、悬停、按下、加载中、禁用
- **色彩语义**：主色用于主要行动，灰色用于次要，红色用于危险操作

### 变体示例

```css
.按钮 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  border-radius: var(--圆角);
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 150ms ease-out;
  cursor: pointer;
  min-height: 44px;  /* 触控区域 */
}

/* 主按钮 */
.按钮-主 {
  background: var(--主色);
  color: var(--主色前景);
  border: none;
}

.按钮-主:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.按钮-主:active {
  transform: translateY(0) scale(0.98);
}

.按钮-主:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 次按钮 */
.按钮-次 {
  background: var(--次色);
  color: var(--次色前景);
  border: 1px solid var(--边框色);
}

/* 幽灵按钮 */
.按钮-幽灵 {
  background: transparent;
  color: var(--主色);
  border: 1px solid var(--主色);
}
```

---

## 表单（Forms）

### 设计要点

- **标签在输入框上方**：比左侧或内部标签更易读
- **焦点状态明显**：清晰的轮廓或边框色变化
- **即时验证反馈**：输入时实时提示，不要等到提交后才报错
- **字段间距充足**：字段之间至少 1rem（16px）
- **错误信息 inline**：在对应字段下方显示具体错误

### 代码示例

```html
<form class="表单">
  <div class="字段">
    <label for="邮箱" class="标签">邮箱地址</label>
    <input 
      id="邮箱" 
      type="email" 
      class="输入框"
      placeholder="your@email.com"
      aria-describedby="邮箱提示"
      required
    >
    <span id="邮箱提示" class="提示文字">我们绝不会分享您的邮箱</span>
    <span class="错误信息" role="alert">请输入有效的邮箱地址</span>
  </div>
</form>
```

```css
.字段 {
  margin-bottom: 1.5rem;
}

.标签 {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: var(--前景色);
}

.输入框 {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--边框色);
  border-radius: var(--圆角);
  background: var(--背景色);
  color: var(--前景色);
  font-size: 0.875rem;
  transition: border-color 150ms, box-shadow 150ms;
}

.输入框:focus {
  outline: none;
  border-color: var(--主色);
  box-shadow: 0 0 0 3px rgba(var(--主色rgb), 0.1);
}

.输入框:invalid:not(:placeholder-shown) {
  border-color: #ef4444;
}

.提示文字 {
  display: block;
  font-size: 0.75rem;
  color: var(--静音前景);
  margin-top: 0.25rem;
}

.错误信息 {
  display: none;
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.25rem;
}

.输入框:invalid:not(:placeholder-shown) ~ .错误信息 {
  display: block;
}
```

---

## 导航（Navigation）

### 设计要点

- **粘性头部**：长页面保持导航可见
- **当前状态清晰**：活跃链接有明显标识（下划线、背景色、字体加粗）
- **移动端汉堡菜单**：小屏幕下折叠为抽屉式菜单
- **键盘可操作**：Tab 键可遍历，Enter 可激活

### 代码示例

```html
<header class="导航栏">
  <div class="导航容器">
    <a href="/" class="品牌标识">Logo</a>
    
    <nav class="桌面导航" aria-label="主导航">
      <a href="/" class="导航链接 导航链接-活跃" aria-current="page">首页</a>
      <a href="/features" class="导航链接">功能</a>
      <a href="/pricing" class="导航链接">定价</a>
    </nav>
    
    <button class="汉堡按钮" aria-label="打开菜单" aria-expanded="false" aria-controls="移动菜单">
      <svg>...汉堡图标...</svg>
    </button>
  </div>
  
  <!-- 移动端菜单 -->
  <div id="移动菜单" class="移动菜单" hidden>
    <nav aria-label="移动导航">
      ...移动导航链接...
    </nav>
  </div>
</header>
```

---

## 表格（Tables）

### 设计要点

- **表头清晰**：使用深色背景或加粗区分
- **行分隔 subtle**：浅灰色底边或斑马纹，不要用深边框
- **数据对齐**：文字左对齐，数字右对齐，状态居中
- **响应式处理**：小屏幕可横向滚动或使用卡片式重构

```css
.表格 {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.表格 thead {
  background: var(--次色);
}

.表格 th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--次色前景);
  border-bottom: 2px solid var(--边框色);
}

.表格 td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--边框色);
}

.表格 tbody tr:hover {
  background: var(--次色);
}

/* 斑马纹 */
.表格 tbody tr:nth-child(even) {
  background: rgba(0, 0, 0, 0.02);
}
```

---

## 弹窗 / 对话框（Modals / Dialogs）

### 设计要点

- **焦点管理**：打开时焦点移动到弹窗内第一个可交互元素
- **关闭方式**：点击遮罩、按 Escape、点击关闭按钮
- **背景锁定**：弹窗打开时禁止背后内容滚动
- **动画**：遮罩淡入 + 弹窗缩放淡入（200-300ms）
- **ARIA**：`role="dialog"`、`aria-modal="true"`、`aria-labelledby` 指向标题

### 代码示例

```html
<div class="弹窗遮罩" role="presentation">
  <div 
    class="弹窗" 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="弹窗标题"
  >
    <header class="弹窗头部">
      <h2 id="弹窗标题">确认删除</h2>
      <button aria-label="关闭弹窗" class="关闭按钮">×</button>
    </header>
    <div class="弹窗内容">
      <p>确定要删除此项目吗？此操作不可撤销。</p>
    </div>
    <footer class="弹窗底部">
      <button class="按钮 按钮-次">取消</button>
      <button class="按钮 按钮-危险">删除</button>
    </footer>
  </div>
</div>
```

---

## 标签页（Tabs）

### 设计要点

- **当前标签明显**：底部边框或背景色区分
- **指示器动画**：切换时指示器平滑滑动（250ms）
- **键盘导航**：左右箭头切换标签
- **内容懒加载**：首次切换到标签时才加载内容（可选）

---

## 提示条 / 通知（Toasts / Notifications）

### 设计要点

- **自动消失**：通常 3-5 秒后自动消失，或提供关闭按钮
- **不阻塞操作**：提示条不应打断用户当前任务
- **位置固定**：通常右上角或顶部居中
- **类型区分**：成功（绿色）、错误（红色）、警告（黄色）、信息（蓝色）
- **动画**：滑入 + 淡入（300ms），离开时淡出 + 收缩

```css
.提示条 {
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 1rem 1.5rem;
  border-radius: var(--圆角);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: 提示条进入 300ms ease-out;
}

.提示条-成功 { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.提示条-错误 { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.提示条-警告 { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
.提示条-信息 { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }

@keyframes 提示条进入 {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 骨架屏（Skeleton Screens）

### 设计要点

- **模拟内容形状**：骨架块的尺寸和位置应与真实内容一致
- **脉冲动画**：微妙的渐变移动，表示加载中
- **渐进式加载**：先显示骨架，内容到达后淡入替换

```html
<div class="骨架卡片">
  <div class="骨架图片"></div>
  <div class="骨架内容">
    <div class="骨架标题"></div>
    <div class="骨架文本"></div>
    <div class="骨架文本 骨架文本-短"></div>
  </div>
</div>
```

```css
.骨架图片,
.骨架标题,
.骨架文本 {
  background: linear-gradient(
    90deg,
    var(--次色) 25%,
    var(--边框色) 50%,
    var(--次色) 75%
  );
  background-size: 200% 100%;
  animation: 骨架脉冲 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.骨架图片 { height: 200px; margin-bottom: 1rem; }
.骨架标题 { height: 1.25rem; width: 60%; margin-bottom: 0.75rem; }
.骨架文本 { height: 0.875rem; margin-bottom: 0.5rem; }
.骨架文本-短 { width: 80%; }

@keyframes 骨架脉冲 {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
