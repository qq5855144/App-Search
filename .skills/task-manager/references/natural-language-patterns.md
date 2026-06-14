# 自然语言映射模式

本文档记录常见的中文自然语言请求与 tasker CLI 命令的映射关系，Agent 翻译用户请求时查阅。

---

## 查看任务

### 今天/逾期的任务

| 用户说法 | CLI 命令 |
|----------|----------|
| "今天有什么任务" | `tasks --open --format telegram` |
| "看看今天的待办" | `tasks --open --format telegram` |
| "有什么逾期的任务" | `tasks --open --format telegram` |
| "显示未完成任务" | `tasks --open --format telegram` |
| "任务列表" | `tasks --open --format telegram` |
| "我的任务" | `tasks --open --format telegram` |

### 按项目筛选

| 用户说法 | CLI 命令 |
|----------|----------|
| "显示 Work 项目的任务" | `tasks --project Work --format telegram` |
| "看看工作相关的任务" | `tasks --project Work --format telegram` |
| "个人项目的任务" | `tasks --project Personal --format telegram` |

### 全部任务

| 用户说法 | CLI 命令 |
|----------|----------|
| "显示所有任务（含已完成）" | `tasks --all --format telegram` |
| "看看历史任务" | `tasks --all --format telegram` |

---

## 添加任务

### 简单添加

| 用户说法 | CLI 命令 |
|----------|----------|
| "添加任务：买牛奶" | `add "买牛奶" --format telegram` |
| "记一个任务：写周报" | `add "写周报" --format telegram` |
| "新建任务：提交代码审查" | `add "提交代码审查" --format telegram` |

### 添加到今天

| 用户说法 | CLI 命令 |
|----------|----------|
| "添加今天的任务：开会" | `add "开会" --today --format telegram` |
| "记一个今天要做的事" | `add "新任务" --today --format telegram` |

### 带详情和截止日期

| 用户说法 | CLI 命令 |
|----------|----------|
| "添加任务：买牛奶 \| 全脂牛奶 \| due tomorrow" | `add --text "买牛奶 \| 全脂牛奶 \| due tomorrow" --format telegram` |
| "记一个任务：写周报 \| 总结本周工作进展 \| due friday" | `add --text "写周报 \| 总结本周工作进展 \| due friday" --format telegram` |

> **注意**：仅当用户显式使用 ` | `（空格-竖线-空格）时才使用 `--text` 格式。如果用户没有使用 ` | `，直接用 `add "<标题>"`。

### 指定项目

| 用户说法 | CLI 命令 |
|----------|----------|
| "在 Work 项目添加任务：部署上线" | `add "部署上线" --project Work --format telegram` |
| "给个人项目加一个任务" | `add "新任务" --project Personal --format telegram` |

---

## 标记完成

| 用户说法 | CLI 命令 |
|----------|----------|
| "标记买牛奶为完成" | `done "买牛奶"` |
| "完成写周报" | `done "写周报"` |
| "把开会标记为已做完" | `done "开会"` |
| "这个任务做完了" | `done "<当前上下文中的任务>"` |

---

## 快速记录

| 用户说法 | CLI 命令 |
|----------|----------|
| "记录：下周检查服务器日志" | `capture "下周检查服务器日志" --format telegram` |
| "快速记一个想法" | `capture "新想法" --format telegram` |
| "记个笔记：产品会议要讨论导出功能" | `capture "产品会议要讨论导出功能" --format telegram` |

---

## 周规划

| 用户说法 | CLI 命令 |
|----------|----------|
| "这周有什么安排" | `week --days 7 --format telegram` |
| "显示本周规划" | `week --days 7 --format telegram` |
| "看看未来几天的任务" | `week --days 7 --format telegram` |

---

## 看板视图

| 用户说法 | CLI 命令 |
|----------|----------|
| "显示看板" | `board --format telegram` |
| "看看 Work 项目的看板" | `board --project Work --format telegram` |
| "任务看板视图" | `board --format telegram` |

---

## 添加笔记

| 用户说法 | CLI 命令 |
|----------|----------|
| "给买牛奶任务加个笔记：去超市买" | `note add "买牛奶" -- "去超市买"` |
| "在周报任务里记一下：已完成初稿" | `note add "周报" -- "已完成初稿"` |

> **注意**：始终使用 `--` 分隔选择器和笔记文本，避免歧义。

---

## 配置查询

| 用户说法 | CLI 命令 |
|----------|----------|
| "显示配置" | `config show` |
| "查看当前设置" | `config show` |
| "默认格式是什么" | `config get default.format` |

---

## 解析规则

### ` | ` 分隔符规则

- **仅对显式的 ` | `（空格-竖线-空格）进行分割**
- 不要用 "but"、"—"、"," 等作为分隔符猜测
- 如果用户没有使用 ` | `，直接将整个文本作为任务标题

### `--` 歧义处理

- 添加笔记时，**始终**使用 `--` 分隔选择器和笔记文本
- 格式：`note add <选择器> -- <笔记文本>`
- 没有 `--` 时，tasker 会尝试推断分割点，可能出错

### 格式选择

- **默认**：human-readable 文本输出
- **聊天场景**：添加 `--format telegram` 获得更适合聊天界面的输出
- **JSON 输出**：仅在用户明确要求时使用 `--stdout-json` 或 `--stdout-ndjson`
- **--all 限制**：仅在用户明确要求已完成/已归档任务时使用 `--all`
