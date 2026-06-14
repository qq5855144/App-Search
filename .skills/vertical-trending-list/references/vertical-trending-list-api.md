# 垂类热榜查询 API

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `1479a6f5-d50c-40be-9caf-db2c63179a4e` |
| API ID | `api-ra5EZDjVyjVa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-ra5EZDjVyjVa-gateway.appmiaoda.com/v2/tools/trending_lists/vertical` |
| Auth 模式 | `platform_managed`（traefik: true） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-ra5EZDjVyjVa-gateway.appmiaoda.com` |
| 计费 | 启用，原价 ¥60.00/千次，折扣价 ¥45.00/千次 |

---

## 请求参数表

### Header 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `Content-Type` | string | 是 | 固定值 `application/json` |
| `X-Appbuilder-Request-Id` | string | 否 | 请求链路 ID（UUID），用于排查问题，可选 |

### Body 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `type` | string | 是 | 垂类类型，可选值：`美食`、`美妆`、`汽车` |
| `mediaType` | string | 是 | 媒体类型，可选值：`抖音`、`小红书` |
| `timeRange` | integer | 是 | 热榜时间范围，可选值：`1`（近一天）、`3`（近三天）、`7`（近7天） |

---

## 响应字段表

### 成功响应（code: 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | integer | 状态码，200 表示成功 |
| `msg` | string | 状态信息，成功时为 `"success"` |
| `requestId` | string | 请求 ID（部分响应字段为 `requestID`，注意大小写） |
| `data` | array | 热榜条目列表 |
| `data[].sum` | integer (Long) | 热度总值 |
| `data[].mediaType` | string | 媒体类型（如 `抖音`） |
| `data[].title` | string | 内容标题 |
| `data[].description` | string? | 内容描述（可为 null） |
| `data[].thumbnail` | string? | 缩略图链接（第三方 CDN URL，可为 null；如需长期持久化可通过 Supabase Storage 转存） |
| `data[].url` | string | 内容链接 |
| `data[].extra` | string? | 额外信息（可为 null） |
| `data[].hotNum` | string | 热度值（字符串格式） |
| `data[].businessTime` | string? | 业务时间 |
| `data[].likeCount` | integer (Long) | 点赞量 |
| `data[].collectedCount` | integer (Long)? | 收藏量 |
| `data[].commentsCount` | integer (Long) | 评论量 |
| `data[].sharedCount` | integer (Long) | 分享量 |
| `data[].readCount` | integer (Long) | 浏览量 |

### 异常响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | integer | 错误码（非 0/200 表示异常） |
| `message` | string | 错误消息 |
| `requestId` | string | 请求 ID |
| `detail` | string? | 异常详情信息 |

---

## 生成期代码（Agent 直接调用）

```typescript
// 垂类热榜查询 — 生成期直接调用（Deno 脚本）
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

type VerticalType = "美食" | "美妆" | "汽车";
type MediaType = "抖音" | "小红书";
type TimeRange = 1 | 3 | 7;

interface TrendingItem {
  sum: number;
  mediaType: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  url: string;
  extra: string | null;
  hotNum: string;
  businessTime: string | null;
  likeCount: number;
  collectedCount: number | null;
  commentsCount: number;
  sharedCount: number;
  readCount: number;
}

/**
 * 查询垂类热榜，返回指定平台和时间范围内的热门内容列表。
 * @param type - 垂类类型：美食 | 美妆 | 汽车
 * @param mediaType - 媒体平台：抖音 | 小红书
 * @param timeRange - 时间范围：1（近一天）| 3（近三天）| 7（近七天）
 * @returns 热榜条目数组
 */
async function queryVerticalTrendingList(
  type: VerticalType,
  mediaType: MediaType,
  timeRange: TimeRange
): Promise<TrendingItem[]> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5EZDjVyjVa-gateway.appmiaoda.com/v2/tools/trending_lists/vertical",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ type, mediaType, timeRange }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg ?? json.message}`);

  return json.data as TrendingItem[];
}

// 示例：查询汽车类在抖音平台近7天的热榜
const items = await queryVerticalTrendingList("汽车", "抖音", 7);
console.log(`共 ${items.length} 条热榜，Top1：${items[0]?.title}`);
```

---

## Edge Function 代码

由于 Web 和 MiniProgram 平台均使用标准 JSON 响应，两个平台共用同一 Edge Function。

```typescript
// edge-functions/vertical-trending-list.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let type: string;
  let mediaType: string;
  let timeRange: number;
  try {
    const body = await req.json();
    type = body.type;
    mediaType = body.mediaType;
    timeRange = body.timeRange;
    if (!type) throw new Error("Missing type");
    if (!mediaType) throw new Error("Missing mediaType");
    if (timeRange === undefined || timeRange === null) throw new Error("Missing timeRange");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5EZDjVyjVa-gateway.appmiaoda.com/v2/tools/trending_lists/vertical",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ type, mediaType, timeRange }),
    }
  );

  // 透传配额/余额错误
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（React/TypeScript）

**推荐方式（supabase client 可用时）：**

```typescript
import { supabase } from "@/lib/supabase";

interface TrendingItem {
  sum: number;
  mediaType: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  url: string;
  hotNum: string;
  businessTime: string | null;
  likeCount: number;
  collectedCount: number | null;
  commentsCount: number;
  sharedCount: number;
  readCount: number;
}

/**
 * 通过 Edge Function 查询垂类热榜。
 * @param type - 垂类类型：美食 | 美妆 | 汽车
 * @param mediaType - 媒体平台：抖音 | 小红书
 * @param timeRange - 时间范围：1 | 3 | 7
 * @returns 热榜条目数组
 */
async function fetchVerticalTrendingList(
  type: "美食" | "美妆" | "汽车",
  mediaType: "抖音" | "小红书",
  timeRange: 1 | 3 | 7
): Promise<TrendingItem[]> {
  const { data, error } = await supabase.functions.invoke("vertical-trending-list", {
    body: { type, mediaType, timeRange },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg ?? data.message}`);
  return data.data as TrendingItem[];
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchVerticalTrendingList(
  type: "美食" | "美妆" | "汽车",
  mediaType: "抖音" | "小红书",
  timeRange: 1 | 3 | 7
): Promise<TrendingItem[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vertical-trending-list`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, mediaType, timeRange }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`配额已用尽：${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`余额不足：${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.data as TrendingItem[];
}
```

### MiniProgram 平台（Taro/React）

MiniProgram 与 Web 平台均返回标准 JSON，使用相同的调用方式：

```typescript
import { supabase } from "@/lib/supabase";

/**
 * 通过 Edge Function 查询垂类热榜（小程序端）。
 * @param type - 垂类类型：美食 | 美妆 | 汽车
 * @param mediaType - 媒体平台：抖音 | 小红书
 * @param timeRange - 时间范围：1 | 3 | 7
 * @returns 热榜条目数组
 */
async function fetchVerticalTrendingListMP(
  type: "美食" | "美妆" | "汽车",
  mediaType: "抖音" | "小红书",
  timeRange: 1 | 3 | 7
): Promise<TrendingItem[]> {
  const { data, error } = await supabase.functions.invoke("vertical-trending-list", {
    body: { type, mediaType, timeRange },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg ?? data.message}`);
  return data.data as TrendingItem[];
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：原价 ¥60.00/千次，折扣价 ¥45.00/千次，`need_count_calls: true`，每次请求均计费，避免不必要的重复调用。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种错误，并向用户展示友好提示。
- **参数枚举约束**：
  - `type` 仅支持 `美食`、`美妆`、`汽车`，传入其他值会导致接口报错。
  - `mediaType` 仅支持 `抖音`、`小红书`。
  - `timeRange` 仅支持整数 `1`、`3`、`7`，不支持其他数值。
- **响应字段可空**：`description`、`thumbnail`、`extra`、`businessTime`、`collectedCount` 等字段可能为 `null`，前端渲染时需做空值保护。
- **requestId 大小写**：实际响应中字段名可能为 `requestId` 或 `requestID`，消费时注意兼容。
