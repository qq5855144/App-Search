---
name: baidu-seo-keyword-ranking
description: 查询指定域名在百度PC端的关键词排名数据，获取排名、流量预估、PC指数等SEO信息。适用于网站SEO分析、内容优化及竞品对比场景。
license: MIT
---

## 能力概述

查询指定域名在百度PC搜索中的关键词排名情况，返回关键词列表及对应排名、预估流量、PC指数、收录量、目录、标题等SEO核心指标，支持分页查询和目录筛选。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-DLEO4zmpN5ja-gateway.appmiaoda.com/seo/baidu/pc/keyword`
- **Content-Type**: `application/x-www-form-urlencoded`
- **认证模式**: `platform_managed`（密钥由平台注入）
- **响应格式**: JSON

**响应示例：**

```json
{
  "code": 200,
  "msg": "成功",
  "taskNo": "41020892700032664119",
  "data": {
    "Pages": 1,
    "Uv": "1~1",
    "Total": 14,
    "Count": 14,
    "Domain": "www.jumdata.com",
    "Current": 1,
    "List": [
      {
        "RankStr": "1-2",
        "SiteCount": 0,
        "Keyword": "聚美智数",
        "Calalog": "/",
        "Title": "关于我们-聚美智数",
        "Index": 90,
        "Url": "https://www.jumdata.com/about"
      }
    ]
  }
}
```

## 参数说明

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `domain` | string | 是 | 查询的域名 |
| `catalog` | string | 否 | 目录名称，默认选择全部数据 |
| `page` | string | 否 | 分页页码，默认第 1 页，每页最多 100 条数据 |

**返回字段说明：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 返回消息 |
| `taskNo` | string | 本次请求号 |
| `data.Pages` | number | 总页数 |
| `data.Uv` | string | 预估流量范围 |
| `data.Total` | number | 总条数 |
| `data.Count` | number | 当前页条数 |
| `data.Domain` | string | 查询域名 |
| `data.Current` | number | 当前页码 |
| `data.List[].RankStr` | string | 排名（如 "1-2" 表示排名区间） |
| `data.List[].SiteCount` | number | 收录量 |
| `data.List[].Keyword` | string | 关键词 |
| `data.List[].Calalog` | string | 目录路径 |
| `data.List[].Title` | string | 页面标题 |
| `data.List[].Index` | number | PC 指数 |
| `data.List[].Url` | string | 标题链接 |

**错误码：**

| code | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 参数错误（如域名为空） |
| 500 | 系统维护，请稍候再试 |
| 999 | 其他错误，以实际返回为准 |

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface KeywordItem {
  RankStr: string;
  SiteCount: number;
  Keyword: string;
  Calalog: string;
  Title: string;
  Index: number;
  Url: string;
}

interface KeywordRankingData {
  Pages: number;
  Uv: string;
  Total: number;
  Count: number;
  Domain: string;
  Current: number;
  List: KeywordItem[];
}

/**
 * 查询指定域名在百度PC端的关键词排名数据。
 * @param domain - 查询的域名，例如 "www.example.com"
 * @param catalog - 可选，目录名称，默认选择全部数据
 * @param page - 可选，分页页码，默认第 1 页
 * @returns 关键词排名数据对象
 */
async function queryBaiduPcKeywordRanking(
  domain: string,
  catalog?: string,
  page?: string,
): Promise<KeywordRankingData> {
  const params: Record<string, string> = { domain };
  if (catalog) params.catalog = catalog;
  if (page) params.page = page;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO4zmpN5ja-gateway.appmiaoda.com/seo/baidu/pc/keyword",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}

// 使用示例
const result = await queryBaiduPcKeywordRanking("www.jumdata.com", undefined, "1");
console.log(`共 ${result.Total} 条关键词，预估流量：${result.Uv}`);
for (const item of result.List) {
  console.log(`[${item.RankStr}] ${item.Keyword} - ${item.Title}`);
}
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/baidu-seo-keyword-ranking.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let domain: string;
  let catalog: string | undefined;
  let page: string | undefined;
  try {
    const body = await req.json();
    domain = body.domain;
    if (!domain) throw new Error("Missing domain");
    catalog = body.catalog;
    page = body.page;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（不可暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构建请求参数 ---
  const params: Record<string, string> = { domain };
  if (catalog) params.catalog = catalog;
  if (page) params.page = page;

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO4zmpN5ja-gateway.appmiaoda.com/seo/baidu/pc/keyword",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    },
  );

  // 转发配额/余额错误
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 前端调用

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询百度PC关键词排名。
 * @param domain - 查询的域名
 * @param catalog - 可选，目录名称
 * @param page - 可选，分页页码
 * @returns 关键词排名数据对象
 */
async function fetchBaiduPcKeywordRanking(
  domain: string,
  catalog?: string,
  page?: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "baidu-seo-keyword-ranking",
    { body: { domain, catalog, page } },
  );
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 查询百度PC关键词排名。
 * @param domain - 查询的域名
 * @param catalog - 可选，目录名称
 * @param page - 可选，分页页码
 * @returns 关键词排名数据对象
 */
async function fetchBaiduPcKeywordRanking(
  domain: string,
  catalog?: string,
  page?: string,
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-seo-keyword-ranking`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, catalog, page }),
    },
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

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误；业务层还需处理 400（域名为空或参数错误）。
- **计费**：原价 ¥0.90/次，折扣价 ¥0.50/次，建议按需查询，避免不必要的重复调用。
- **分页**：每页最多返回 100 条数据，若 `data.Pages > 1`，需通过递增 `page` 参数分页获取全量数据。
- **字段拼写**：API 响应中目录字段为 `Calalog`（非 `Catalog`），使用时注意拼写。
- **排名格式**：`RankStr` 为字符串排名区间（如 `"1-2"`），非整数，不可直接用于数值比较。
