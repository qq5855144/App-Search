# App Search - 开源应用商店

<div align="center">

![Runtime](https://img.shields.io/badge/Runtime-Expo%20App%20%7C%20Web-2391FF?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Expo](https://img.shields.io/badge/Expo-55-blueviolet?style=flat-square)

**发现、探索、安装优质开源应用**

[快速开始](#快速开始) · [功能](#特性) · [项目结构](#项目结构) · [截图](#截图)

</div>

---

## ✨ 特性

### 🔍 智能搜索
- GitHub 开源仓库全文搜索
- 按平台、应用类型、收藏量筛选
- 搜索历史自动记录

### 📱 安装资产识别
项目会从 GitHub Release 中识别常见安装包格式，方便用户找到可安装的开源应用。当前仓库尚未提供自身的 Android、iOS、Windows、macOS 或 Linux 安装包构建产物。

| 目标平台 | 可识别格式 |
|------|----------|
| Android | APK |
| iOS | IPA |
| macOS | DMG / PKG |
| Windows | EXE / MSI |
| Linux | AppImage / DEB / RPM |

### 🏆 热门榜单
- 热门应用
- 下载排行
- 收藏排行
- 趋势应用

### 💾 本地管理
- 收藏应用
- 下载记录
- 搜索历史
- 本地缓存

### 安卓启动体验
- 浅色主题全屏启动页，背景色统一为 `#F8FBFF`
- 原生 Expo 启动图与 React Native 启动覆盖层视觉一致
- 包含品牌图标、产品名称、标语与轻量加载反馈

---

## 当前功能入口
- `/` / `src/app/(tabs)/index.tsx`：首页入口
- `/search` / `src/app/(tabs)/search.tsx`：搜索、热词、历史记录、分页加载
- `/ranking` / `src/app/(tabs)/ranking.tsx`：榜单页
- `/discover` / `src/app/(tabs)/discover.tsx`：发现页
- `/favorites`：收藏列表
- `/downloads`：下载记录
- `/detail/[id]`：应用详情页

## 数据架构（纯前端）
- **无自建后端**：应用不依赖 Supabase、Edge Functions、数据库服务或自建 API。
- **仓库搜索/详情/Release/Star/贡献者/配额**：客户端直接访问 GitHub REST API；Token 仅保存在设备本地（Web 使用 localStorage，Android/iOS 使用 SecureStore）。
- **本地数据**：收藏、下载记录、搜索历史、已安装记录、缓存和行为统计保存在设备本地（Web localStorage / 原生 SQLite 或 AsyncStorage）。
- **发现与榜单**：发现页直接使用 GitHub Search qualifiers；榜单根据 GitHub 公开数据及当前设备的本地收藏/下载/浏览事件生成。不同设备之间不再共享行为统计。
- **翻译**：README 翻译由客户端直接请求 MyMemory 公共翻译接口，并缓存结果；翻译服务不可用时保留原文。

## 纯前端能力边界
- GitHub API 的搜索、Release、仓库详情和 Star 操作仍需要网络；配置 Token 可提升认证请求额度，但 Token 不会绕过 GitHub 的 Secondary Rate Limit。
- 搜索历史和收藏/下载记录为设备本地数据；排行榜使用公开共享数据源，不提供伪造的全平台下载量或收藏量榜单。
- GitHub API 不提供仓库 Release 安装包的批量搜索接口，因此首次搜索不为每个仓库额外发起探测请求；安装包信息在详情页读取并缓存，未知安装包状态不会误过滤搜索结果。
- 翻译依赖第三方公共翻译服务，不依赖本项目后端；若要求完全离线翻译，需要额外内置离线语言模型/词典。

## 本次改造重点
- 移除客户端对 Supabase URL、匿名密钥、数据库表和 Edge Functions 的运行时依赖。
- 排行榜改为公开数据：GitStock Trending（日/周/月）及周期 Star 增量、OSS Insight 趋势回退、GitHub 官方 Stars 总量排序；公开快照会标明来源与采集时间。
- 修复 Token 初始化链路，读取本地 Token 时同步到 GitHub 请求层。
- 区分 Token 无效（401）、主配额耗尽（403 且剩余配额为 0）和 Secondary Rate Limit/权限/网络策略导致的 403，避免误报“未配置 Token”。
- 搜索结果使用本地缓存，未知安装包状态默认保留，减少额外 API 请求和错误空结果。

---

## README 翻译与渲染保护

应用内置 Markdown-aware 翻译引擎（`src/lib/translateApi.ts` · `translateMarkdown`），在开启翻译功能后对项目 README 进行结构安全翻译。

### 保护机制

翻译 API 只会收到「纯文字」，以下内容**原样保留，绝不送入翻译服务**：

| 类别 | 示例 |
|------|------|
| 标题前缀 | `## Title` → 只翻译 `Title`，`## ` 不变 |
| 无序列表 | `- item` / `* item` → 只翻译 `item` |
| 有序列表 | `1. item` → 只翻译 `item` |
| 任务列表 | `- [ ] todo` / `- [x] done` → 复选框不变 |
| 引用 | `> text` → `>` 不变 |
| 表格管道符 | `\| cell \|` → `\|` 不变，只翻译单元格文字 |
| 表格分隔行 | `\|---\|---\|` → 整行保留 |
| 围栏/缩进代码块 | ` ```js ... ``` ` → 整块保留 |
| 行内代码 | `` `code` `` → 保留 |
| HTML 标签 | `<img height="80">` → 标签和属性名保留 |
| Markdown 图片 | `![alt](url)` → 整体保留 |
| 链接 URL | `[text](url)` → 只翻译 `text`，URL 保留 |
| 裸 URL | `https://...` → 保留 |
| 参考链接定义 | `[id]: url` → 整行保留 |
| GitHub Alert | `> [!NOTE]` / `> [!WARNING]` 等 → 整行保留 |

### 翻译后处理

- 清理翻译 API 异常插入的换行，防止破坏标题/列表/表格结构
- 表格单元格内意外插入的半角 `|` 自动转为全角 `｜`

### 结构校验与回退

翻译完成后自动统计标题数、表格分隔行数、代码块数。若任意关键结构数量差异超过 20%，判定翻译破坏了结构，**自动回退显示原始 README**，确保渲染结果始终可靠。

---

<div align="center">

**如果这个项目对你有帮助，请点个 ⭐️**

</div>
