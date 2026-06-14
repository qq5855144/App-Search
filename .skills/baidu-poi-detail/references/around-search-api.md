# 圆形区域检索 API

## API 基本信息

| 项目 | 值 |
|------|-----|
| Plugin ID | `d5c0b7d3-bc6a-4d3a-b8a2-e37246fac4df` |
| API ID | `api-DLEO7eMnzMwa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-DLEO7eMnzMwa-gateway.appmiaoda.com/place/v3/around` |
| Auth | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>`（platform_managed） |
| Content-Type | 无请求体（GET 参数通过 URL 查询串传递） |
| Third-party domain | `app-cblk1rqa5fk1-api-DLEO7eMnzMwa-gateway.appmiaoda.com` |
| 计费 | 按次计费，折扣价 ¥0.75 / 千次，原价 ¥1.20 / 千次 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | — | 检索关键字，支持多关键字用 `$` 分隔，如「银行$酒店」 |
| `location` | string | 是 | — | 圆心坐标，格式为「纬度,经度」，如「39.915,116.404」 |
| `radius` | integer | 否 | 1000 | 检索半径，单位米 |
| `radius_limit` | boolean | 否 | — | 是否严格限制在半径内召回 |
| `type` | string | 否 | — | 对 query 结果进行二次筛选类型 |
| `scope` | integer | 否 | 1（推断） | 结果详细程度，1 为基本信息，2 为详细信息 |
| `filter` | string | 否 | — | 排序条件，如「industry_type:cater\|sort_name:overall_rating\|sort_rule:1」 |
| `page_num` | integer | 否 | 0 | 分页页码 |
| `page_size` | integer | 否 | — | 单次召回数量 |

---

## 响应字段表

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，0 表示成功 |
| `message` | string | 状态信息，成功时为 "ok" |
| `results` | array | POI 信息数组 |
| `results[].name` | string | POI 名称 |
| `results[].location` | object | 经纬度坐标 |
| `results[].location.lng` | number | 经度 |
| `results[].location.lat` | number | 纬度 |
| `results[].address` | string | 详细地址 |

### 失败响应（status≠0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 错误状态码（非 0） |
| `message` | string | 错误说明 |

---

## 响应示例

```json
{
  "status": 0,
  "message": "ok",
  "results": [
    {
      "name": "中国民生银行",
      "location": {"lng": 116.413, "lat": 39.915},
      "address": "东长安街35号"
    }
  ]
}
```

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface AroundSearchResult {
  name: string;
  location: { lng: number; lat: number };
  address: string;
}

interface AroundSearchResponse {
  status: number;
  message: string;
  results: AroundSearchResult[];
}

/**
 * 在指定圆心和半径范围内检索 POI 地点信息（周边搜索）。
 * @param query - 检索关键字，支持多关键字用 $ 分隔，如「银行$酒店」
 * @param location - 圆心坐标字符串，格式「纬度,经度」，如「39.915,116.404」
 * @param options - 可选参数：radius（半径米）、radiusLimit、type、scope、filter、pageNum、pageSize
 * @returns 周边 POI 列表，含距离信息
 */
async function searchAround(
  query: string,
  location: string,
  options: {
    radius?: number;
    radiusLimit?: boolean;
    type?: string;
    scope?: 1 | 2;
    filter?: string;
    pageNum?: number;
    pageSize?: number;
  } = {}
): Promise<AroundSearchResult[]> {
  const params = new URLSearchParams({ query, location });
  if (options.radius !== undefined) params.set("radius", String(options.radius));
  if (options.radiusLimit !== undefined) params.set("radius_limit", String(options.radiusLimit));
  if (options.type) params.set("type", options.type);
  if (options.scope !== undefined) params.set("scope", String(options.scope));
  if (options.filter) params.set("filter", options.filter);
  if (options.pageNum !== undefined) params.set("page_num", String(options.pageNum));
  if (options.pageSize !== undefined) params.set("page_size", String(options.pageSize));

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-DLEO7eMnzMwa-gateway.appmiaoda.com/place/v3/around?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: AroundSearchResponse = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message}`);

  return json.results;
}

// 使用示例：查找天安门广场 1000 米内的银行
const results = await searchAround("银行", "39.915,116.404", { radius: 1000 });
console.log(JSON.stringify(results, null, 2));
```

---

## Edge Function 代码

```typescript
// edge-functions/baidu-poi-around.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let query: string;
  let location: string;
  let radius: number | undefined;
  let radiusLimit: boolean | undefined;
  let type: string | undefined;
  let scope: number | undefined;
  let filter: string | undefined;
  let pageNum: number | undefined;
  let pageSize: number | undefined;

  try {
    const body = await req.json();
    query = body.query;
    location = body.location;
    if (!query) throw new Error("Missing query");
    if (!location) throw new Error("Missing location");
    radius = body.radius;
    radiusLimit = body.radius_limit;
    type = body.type;
    scope = body.scope;
    filter = body.filter;
    pageNum = body.page_num;
    pageSize = body.page_size;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（不暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构建查询参数 ---
  const params = new URLSearchParams({ query, location });
  if (radius !== undefined) params.set("radius", String(radius));
  if (radiusLimit !== undefined) params.set("radius_limit", String(radiusLimit));
  if (type) params.set("type", type);
  if (scope !== undefined) params.set("scope", String(scope));
  if (filter) params.set("filter", filter);
  if (pageNum !== undefined) params.set("page_num", String(pageNum));
  if (pageSize !== undefined) params.set("page_size", String(pageSize));

  // --- 调用上游接口 ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-DLEO7eMnzMwa-gateway.appmiaoda.com/place/v3/around?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
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

### 推荐方式（supabase client 可用时）

```typescript
interface AroundSearchParams {
  query: string;
  location: string;
  radius?: number;
  radius_limit?: boolean;
  type?: string;
  scope?: 1 | 2;
  filter?: string;
  page_num?: number;
  page_size?: number;
}

/**
 * 通过 Edge Function 调用圆形区域 POI 周边检索。
 * @param params - 检索参数，location 格式为「纬度,经度」
 * @returns 周边 POI 列表，含距离信息
 */
async function searchPoiAround(params: AroundSearchParams) {
  const { data, error } = await supabase.functions.invoke("baidu-poi-around", {
    body: params,
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.message}`);
  return data.results;
}
```

### 备用方式（无法使用 supabase client 时）

```typescript
/**
 * 通过原生 fetch 调用圆形区域 POI 周边检索 Edge Function。
 * @param params - 检索参数
 * @returns 周边 POI 列表
 */
async function searchPoiAround(params: AroundSearchParams) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-poi-around`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}：${json.message}`);
  return json.results;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：按次计费，折扣价 ¥0.75 / 千次，原价 ¥1.20 / 千次，避免不必要的重复调用。
- **location 格式**：必须为「纬度,经度」顺序，如「39.915,116.404」，不可颠倒。
- **多关键字**：query 支持用 `$` 分隔多个关键字，如「银行$ATM$金融」可同时搜索多类 POI。
- **filter 排序**：按评分排序示例：`industry_type:cater|sort_name:overall_rating|sort_rule:1`（1 为降序）。
