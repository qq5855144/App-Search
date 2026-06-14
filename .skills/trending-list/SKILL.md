---
name: trending-list
description: 查询微博、头条、知乎、抖音、B站、百度、贴吧、快手、小红书等9大平台的实时热榜数据，适用于内容创作、舆情分析、市场洞察场景
license: MIT
---

## 能力概述

调用百度千帆热榜查询接口，根据指定平台类型返回当前热门话题列表，包含标题、热度、链接、发布时间等信息。

- **Endpoint**: `GET https://app-cblk1rqa5fk1-api-qYGWoqjEmMnY-gateway.appmiaoda.com/v2/tools/trending_lists/medium`
- **认证方式**: platform_managed（`INTEGRATIONS_API_KEY` 由平台注入）
- **支持平台**: 微博（2）、头条（3）、百度（4）、抖音（6）、知乎（7）、B站（8）、贴吧（9）、快手（10）、小红书（14）
- **响应格式**: JSON，返回热榜条目数组

**平台类型对照表：**

| type 值 | 平台名称 |
|---------|---------|
| 2 | 微博热榜 |
| 3 | 头条热榜 |
| 4 | 百度热榜 |
| 6 | 抖音热榜 |
| 7 | 知乎热榜 |
| 8 | B站热榜 |
| 9 | 贴吧热议榜 |
| 10 | 快手热榜 |
| 14 | 小红书热榜 |

**响应示例（抖音热榜，type=6）：**

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "title": "许倬云去世 享年95岁",
      "hot": 11163419,
      "url": "https://www.douyin.com/hot/2192203",
      "date": "2025-08-04 15:38:23",
      "translateTitle": ""
    }
  ],
  "requestId": "e9f857cc-62b4-4752-9894-3d78799a5714"
}
```

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 查询指定平台的热榜数据。
 * @param type 热榜类型：2-微博、3-头条、4-百度、6-抖音、7-知乎、8-B站、9-贴吧、10-快手、14-小红书
 * @returns 热榜条目数组
 */
async function queryTrendingList(type: number): Promise<TrendingItem[]> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-qYGWoqjEmMnY-gateway.appmiaoda.com/v2/tools/trending_lists/medium"
  );
  url.searchParams.set("type", String(type));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}

interface TrendingItem {
  title: string;
  hot: number;
  url: string;
  date: string | null;
  translateTitle: string | null;
}

// 示例：查询抖音热榜
const items = await queryTrendingList(6);
console.log(items.slice(0, 5));
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function 代码

```typescript
// edge-functions/trending-list.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let type: number;
  try {
    const body = await req.json();
    if (body.type === undefined || body.type === null) {
      throw new Error("Missing type");
    }
    type = Number(body.type);
    if (![2, 3, 4, 6, 7, 8, 9, 10, 14].includes(type)) {
      throw new Error(
        "Invalid type. Must be one of: 2(微博), 3(头条), 4(百度), 6(抖音), 7(知乎), " +
        "8(B站), 9(贴吧), 10(快手), 14(小红书)"
      );
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const upstreamUrl = new URL(
    "https://app-cblk1rqa5fk1-api-qYGWoqjEmMnY-gateway.appmiaoda.com/v2/tools/trending_lists/medium"
  );
  upstreamUrl.searchParams.set("type", String(type));

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

### 前端调用代码

**Web 平台（React / Vue 等）：**

```typescript
/**
 * 查询指定平台热榜。
 * @param type 热榜类型（2/3/4/6/7/8/9/10/14）
 * @returns 热榜条目数组
 */
async function fetchTrendingList(type: number): Promise<TrendingItem[]> {
  const { data, error } = await supabase.functions.invoke("trending-list", {
    body: { type },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**小程序平台（Taro / 原生微信小程序）：**

> **注意**：小程序路由传参时，若平台名称等中文参数通过 URL 传递，需进行 URL 编码，接收端使用
> `decodeURIComponent` 解码，确保中文参数正常传递和显示。

```typescript
/**
 * 小程序端查询指定平台热榜。
 * @param type 热榜类型（2/3/4/6/7/8/9/10/14）
 * @returns 热榜条目数组
 */
async function fetchTrendingListMiniProgram(type: number): Promise<TrendingItem[]> {
  const { data, error } = await supabase.functions.invoke("trending-list", {
    body: { type },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}

// 页面跳转传参示例（含中文参数时必须 URL 编码）
// Taro.navigateTo({ url: `/pages/trending/index?platform=${encodeURIComponent("抖音热榜")}&type=6` });

// 目标页面接收参数
// const { platform, type } = router.params;
// const platformName = decodeURIComponent(platform);
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchTrendingList(type: number): Promise<TrendingItem[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trending-list`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
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
  return json.data;
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `type` | `number` | 是 | 热榜类型：2-微博热榜、3-头条热榜、7-知乎热榜、6-抖音热榜、8-B站热榜、4-百度热榜、9-贴吧热议榜、10-快手热榜、14-小红书热榜 |

### 请求 Headers

| 字段 | 必填 | 说明 |
|------|------|------|
| `Content-Type` | 是 | `application/json` |
| `X-Gateway-Authorization` | 是 | `Bearer ${INTEGRATIONS_API_KEY}`，`platform_managed` 模式下由平台注入 |
| `X-Appbuilder-Request-Id` | 否 | UUID 格式的请求 ID，用于链路追踪 |

### 返回字段说明

**成功响应（code=200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码，200 表示成功 |
| `msg` | `string` | 状态信息，成功时为 `"success"` |
| `requestId` | `string` | 请求 ID |
| `data` | `TrendingItem[]` | 热榜条目数组 |
| `data[].title` | `string` | 热榜标题 |
| `data[].hot` | `number` | 热度数值 |
| `data[].url` | `string` | 原文链接 |
| `data[].date` | `string \| null` | 发布时间，格式 `YYYY-MM-DD HH:mm:ss`；部分平台（如微博）该字段可能为 `null` |
| `data[].translateTitle` | `string \| null` | 翻译后的标题（可为空字符串或 `null`） |

**异常响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `requestId` | `string` | 请求 ID |
| `code` | `string` | 错误码，非 0 表示异常 |
| `message` | `string` | 错误消息 |
| `detail` | `object?` | 异常详情信息 |

## 注意事项

- **`date` 可能为 null**：部分平台（如微博）返回的条目 `date` 字段为 `null`，`translateTitle` 同理。渲染时必须做空值防护，例如 `{item.date && <span>{item.date.split(' ')[1]}</span>}`，直接调用 `.split()` 等字符串方法会导致运行时报错。
- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）错误，并给用户友好提示。
- **计费**：折扣价 ¥4.00 / 每 4 次调用，原价 ¥4.80，避免不必要的重复调用。
- **小程序中文传参**：页面跳转时传递中文参数需进行 URL 编码（`encodeURIComponent`），
  接收端使用 `decodeURIComponent` 解码，否则会出现乱码。
- **热榜时效性**：热榜数据反映当前时间段的热门内容，不同时间段查询结果可能不同；
  建议按需查询，不需要高频轮询。
- **type 参数合法值**：仅支持 2、3、4、6、7、8、9、10、14，传入其他值将返回错误。
