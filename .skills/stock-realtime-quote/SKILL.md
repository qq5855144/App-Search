---
name: stock-realtime-quote
description: 查询沪深股市实时行情，包括个股信息、K线、排行、板块、停牌、分时成交等，适用于股票交易软件、投资工具、金融应用
license: MIT
---

## 能力概述

本 skill 封装了 **股票实时行情查询** 插件（Plugin ID: `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc`），提供沪深市场全面的实时行情数据查询能力，涵盖以下 9 个接口：

| 接口名称 | Endpoint | 功能 |
|---------|---------|------|
| 沪深板块排名 | `POST /stock/hs/blockrank` | 按板块类型查询地域/行业/概念板块排名 |
| 沪深板块成分股 | `POST /stock/hs/blocklist` | 查询指定板块的成分股排行 |
| A股停牌信息 | `POST /stock/a/stop` | 获取A股停牌股票列表及复牌预期 |
| 沪深K线 | `POST /stock/hs/kline` | 查询日/周/月/季/年及分钟级K线数据（支持复权） |
| 沪深股票排行 | `POST /stock/hs/rank` | 按涨跌幅/成交额/换手率等排序的股票榜单 |
| 沪深分时成交 | `POST /stock/hs/tick` | 获取个股逐笔成交明细 |
| 沪深股票信息 | `POST /stock/hs/info` | 查询个股基础行情（价格、市值、财务指标） |
| 沪深大盘涨跌数 | `POST /stock/hs/overview` | 上证/深证/创业板涨跌平统计 |
| 沪深分钟K含均线 | `POST /stock/hs/mink` | 分钟K线数据（含 MA5/10/30 均线） |

**认证方式：** `platform_managed`，密钥由平台注入，代码中读取 `INTEGRATIONS_API_KEY` 环境变量。Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**Host：** `app-cblk1rqa5fk1-api-zYkZz8qovO1L-gateway.appmiaoda.com`

**Content-Type：** `application/x-www-form-urlencoded`

**计费：** 所有接口均启用计费，具体价格以平台实际配置为准。

**支持平台：** Web / MiniProgram / App

---

## 生成期用法（Agent 直接调用）

所有接口均使用 `platform_managed` 认证，密钥由平台通过 `INTEGRATIONS_API_KEY` 注入，header 为 `X-Gateway-Authorization`。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;
// 注意：header 是 X-Gateway-Authorization，不是 Authorization
```

各接口详细参数、请求示例及 TypeScript 函数请参阅对应 references 文件：

- 板块行情：`references/blockrank-api.md`、`references/blocklist-api.md`
- 个股行情：`references/stock-info-api.md`、`references/stock-rank-api.md`
- K线数据：`references/kline-api.md`、`references/mink-api.md`
- 分时成交：`references/tick-api.md`
- 大盘概览：`references/overview-api.md`
- 停牌信息：`references/stop-api.md`

---

## 生成后用法（应用内通过 Edge Function 调用）

每个接口部署为独立的 Supabase Edge Function，前端通过 `supabase.functions.invoke` 调用，`INTEGRATIONS_API_KEY` 仅在服务端读取，不暴露给客户端。

| 接口 | Edge Function 名称 | references 文件 |
|------|-------------------|----------------|
| 沪深板块排名 | `stock-blockrank` | `references/blockrank-api.md` |
| 沪深板块成分股 | `stock-blocklist` | `references/blocklist-api.md` |
| A股停牌信息 | `stock-a-stop` | `references/stop-api.md` |
| 沪深K线 | `stock-kline` | `references/kline-api.md` |
| 沪深股票排行 | `stock-rank` | `references/stock-rank-api.md` |
| 沪深分时成交 | `stock-tick` | `references/tick-api.md` |
| 沪深股票信息 | `stock-info` | `references/stock-info-api.md` |
| 沪深大盘涨跌数 | `stock-overview` | `references/overview-api.md` |
| 沪深分钟K含均线 | `stock-mink` | `references/mink-api.md` |

每个 references 文件包含完整的 Edge Function 代码和前端调用代码。

> **关于沪深股票信息 API 的使用优先级（来自 examples）：**  
> 涉及个股信息查询、股票搜索等功能时，优先使用 `stock-info`（沪深股票信息API），适用于 MiniProgram。

---

## 注意事项

- **密钥安全：** `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理：** 务必处理 429（配额超限）和 402（余额不足），并向用户提示。
- **计费：** 每次 API 调用均计费，具体价格以平台实际配置为准，避免无效的重复调用。
- **数据时效：** 所有行情数据为实时数据（update_time 为 Unix 时间戳），应在需要时按需请求，而非循环轮询。
