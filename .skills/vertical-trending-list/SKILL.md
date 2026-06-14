---
name: vertical-trending-list
description: 查询垂类热榜（美食/美妆/汽车），支持抖音/小红书平台，可按近1天/3天/7天筛选，适用于内容分析和热点追踪场景
license: MIT
---

## 能力概述

调用百度千帆垂类热榜查询接口，根据指定的垂类类型、媒体平台和时间范围，返回热门内容条目列表（包含标题、热度值、点赞量、浏览量、内容链接等）。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-ra5EZDjVyjVa-gateway.appmiaoda.com/v2/tools/trending_lists/vertical`
- **Auth 模式**：`platform_managed`，密钥由平台通过 `INTEGRATIONS_API_KEY` 注入
- **核心参数**：
  - `type`（string，必填）：垂类类型，可选 `美食` / `美妆` / `汽车`
  - `mediaType`（string，必填）：媒体平台，可选 `抖音` / `小红书`
  - `timeRange`（integer，必填）：时间范围，可选 `1`（近一天）/ `3`（近三天）/ `7`（近七天）
- **响应格式**：JSON，`data` 字段为热榜条目数组，每条含 `title`、`hotNum`、`likeCount`、`readCount`、`url` 等字段
- **计费**：原价 ¥60.00/千次，折扣价 ¥45.00/千次

| 平台 | Edge Function | 前端调用方式 |
|------|--------------|-------------|
| Web | `vertical-trending-list.ts` | `supabase.functions.invoke` 或原生 `fetch` |
| MiniProgram | 同上（共用） | `supabase.functions.invoke` |

详见 `references/vertical-trending-list-api.md`。

---

## 生成期用法（Agent 直接调用）

在 Agent 生成期可直接调用上游接口，无需 Edge Function。完整代码见
`references/vertical-trending-list-api.md` → **生成期代码** 章节。

快速示例：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

const response = await fetch(
  "https://app-cblk1rqa5fk1-api-ra5EZDjVyjVa-gateway.appmiaoda.com/v2/tools/trending_lists/vertical",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ type: "汽车", mediaType: "抖音", timeRange: 7 }),
  }
);

const json = await response.json();
// json.data 为热榜条目数组
```

---

## 生成后用法（应用内通过 Edge Function 调用）

部署 `vertical-trending-list` Edge Function 后，前端通过该函数调用上游接口，`INTEGRATIONS_API_KEY` 始终保留在服务端，不暴露到客户端。

Web 和 MiniProgram 平台共用同一 Edge Function（响应为标准 JSON，无二进制媒体流）。

完整的 Edge Function 代码、Web 前端调用代码、MiniProgram 前端调用代码，均见
`references/vertical-trending-list-api.md` → **Edge Function 代码** 和 **前端调用代码** 章节。
