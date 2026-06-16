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

---

## 🏗 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | React Native + Expo |
| 路由 | Expo Router |
| UI | React Native + NativeWind |
| 状态 | React Context |
| 后端 | Supabase Edge Functions |
| 数据 | GitHub REST API |
| 存储 | AsyncStorage / SQLite |

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm / pnpm / yarn
- Expo CLI
- iOS Simulator / Android Studio（可选）

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/qq5855144/App-Search.git
cd App-Search

# 安装依赖
pnpm install

# 启动开发服务器
pnpm start
```

### 本地运行

```bash
# iOS 模拟器
pnpm ios

# Android 模拟器
pnpm android

# Web
pnpm web
```

> 说明：以上命令用于本地开发和预览，不代表项目已经发布了多平台安装包。如需发布安装包，需要另外配置 EAS Build 或对应平台的打包流程。

### 环境变量配置

创建 `.env` 文件：

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📁 项目结构

```
src/
├── app/                    # 页面路由 (Expo Router)
│   ├── (tabs)/           # 底部导航页
│   │   ├── index.tsx     # 首页
│   │   ├── search.tsx    # 搜索页
│   │   ├── discover.tsx   # 发现页
│   │   └── profile.tsx   # 我的页
│   ├── detail/           # 应用详情
│   ├── rankings.tsx      # 榜单页
│   ├── favorites.tsx      # 收藏页
│   └── downloads.tsx      # 下载记录页
├── components/            # 组件
│   └── openappstore/     # 应用商店组件
├── lib/                   # 工具库
│   ├── github.ts         # GitHub API
│   ├── cache.ts          # 缓存管理
│   ├── database.ts       # 本地数据库
│   └── events.ts         # 事件追踪
└── types/                # TypeScript 类型
```

---

## 🔧 API 配置

项目使用 GitHub REST API，通过 Supabase Edge Function 代理请求以提高稳定性。

### GitHub API 限流
- 未认证：60 请求/小时
- 已认证：5000 请求/小时

建议配置 GitHub Personal Access Token 以获得更高配额。

---

## 📸 截图

<div align="center">

| 发现页 | 搜索页 | 详情页 |
|:------:|:------:|:------:|
| ![Discover](https://placehold.co/300x600/1677FF/ffffff?text=Discover) | ![Search](https://placehold.co/300x600/52C41A/ffffff?text=Search) | ![Detail](https://placehold.co/300x600/FF4D4F/ffffff?text=Detail) |

</div>

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

本项目基于 MIT 许可证开源，详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

- [Expo](https://expo.dev/) - 优秀的跨平台开发框架
- [GitHub](https://github.com/) - 提供开源生态
- [Supabase](https://supabase.com/) - 后端即服务
- 所有开源贡献者

---

<div align="center">

**如果这个项目对你有帮助，请点个 ⭐️**

</div>
