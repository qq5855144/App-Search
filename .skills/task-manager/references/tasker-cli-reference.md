# Tasker CLI 命令参考

本文档提供 `tasker` CLI 的完整命令参考，Agent 在翻译用户请求时查阅。

---

## 命令速查表

| 命令 | 用途 | 常用参数 |
|------|------|----------|
| `tasks` | 列出任务 | `--open`, `--today`, `--overdue`, `--project`, `--all`, `--format` |
| `add` | 添加任务 | `--text`, `--today`, `--project`, `--due`, `--format` |
| `done` | 标记完成 | 任务选择器 |
| `capture` | 快速记录 | 文本内容, `--format` |
| `week` | 周规划 | `--days`, `--format` |
| `board` | 看板视图 | `--project`, `--format` |
| `note` | 添加笔记 | `add`, 选择器, `--`, 文本 |
| `config` | 配置管理 | `show`, `set`, `get` |
| `resolve` | 选择器解析 | 查询字符串, `--match` |

---

## tasks — 列出任务

显示任务列表，支持多种筛选条件。

### 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--open` | 仅显示未完成任务 | `tasks --open` |
| `--today` | 显示今天的任务 | `tasks --open --today` |
| `--overdue` | 显示逾期任务 | `tasks --open --overdue` |
| `--project <名称>` | 按项目筛选 | `tasks --project Work` |
| `--all` | 显示所有任务（含已完成） | `tasks --all` |
| `--format <格式>` | 输出格式 | `tasks --format telegram` |

### 常用组合

```bash
# 今天和逾期的未完成任务（最常用）
tasks --open --format telegram

# 特定项目的任务
tasks --project Work --format telegram

# 所有任务（含已完成）
tasks --all --format telegram
```

---

## add — 添加任务

创建新任务。

### 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `<标题>` | 直接指定标题 | `add "买牛奶"` |
| `--text "<标题 | 详情 | due 日期>"` | 完整格式（推荐） | `add --text "买牛奶 | 全脂 | due tomorrow"` |
| `--today` | 设置为今天到期 | `add "开会" --today` |
| `--project <名称>` | 指定项目 | `add "写文档" --project Work` |
| `--due <日期>` | 指定截止日期 | `add "交报告" --due 2026-01-23` |
| `--format <格式>` | 输出格式 | `add "任务" --format telegram` |

### 日期格式

- `today` / `tomorrow` / `yesterday`
- `2026-01-23`（ISO 格式）
- `next monday` / `in 3 days`

---

## done — 标记完成

将任务标记为已完成。

### 用法

```bash
done "<任务选择器>"
```

选择器可以是：
- 任务标题（完整或部分）
- 任务 ID（不推荐，对人类不友好）
- 模糊查询（配合 resolve 使用）

### 示例

```bash
done "买牛奶"
done "写周报"
```

---

## capture — 快速记录

快速记录一个想法或笔记，不创建正式任务。

### 用法

```bash
capture "<文本内容>"
capture "<文本>" --format telegram
```

### 示例

```bash
capture "记得下周检查服务器日志"
capture "产品会议想法：增加导出功能" --format telegram
```

---

## week — 周规划

查看本周任务规划。

### 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--days <天数>` | 显示未来 N 天 | `week --days 7` |
| `--format <格式>` | 输出格式 | `week --days 7 --format telegram` |

### 示例

```bash
week --days 7 --format telegram
```

---

## board — 看板视图

以看板形式查看任务（按状态分栏）。

### 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--project <名称>` | 按项目筛选 | `board --project Work` |
| `--format <格式>` | 输出格式 | `board --format telegram` |

### 示例

```bash
board --project Work --format telegram
```

---

## note — 添加笔记

为现有任务添加笔记。

### 用法

```bash
# 推荐：使用 -- 避免歧义
note add <选择器...> -- <笔记文本...>

# 不推荐：tasker 会尝试推断分割点
note add <选择器...> <笔记文本...>
```

### 示例

```bash
note add "买牛奶" -- "去超市买全脂牛奶，顺便买面包"
note add "周报" -- "本周完成了用户认证模块的优化"
```

---

## config — 配置管理

查看和修改 tasker 配置。

### 子命令

| 子命令 | 说明 | 示例 |
|--------|------|------|
| `show` | 显示当前配置 | `config show` |
| `get <键>` | 获取特定配置项 | `config get default.project` |
| `set <键> <值>` | 设置配置项 | `config set default.format telegram` |

---

## resolve — 选择器解析

当任务选择器模糊或不完整时，使用 resolve 查找匹配项。

### 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--match search` | 包含笔记/正文搜索 | `resolve "周报" --match search` |

### 示例

```bash
# 解析模糊选择器
resolve "周报"

# 包含正文搜索
resolve "服务器" --match search
```

**规则**：如果 resolve 恰好返回一个匹配项，可以直接使用其结果中的 ID 或标题继续操作。如果返回多个匹配项，需要请用户明确指定。
