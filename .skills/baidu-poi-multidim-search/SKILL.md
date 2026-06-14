---
name: baidu-poi-multidim-search
description: 百度地图多维 POI 检索，支持自然语言查询在指定区域内检索兴趣点（餐厅/酒店/景点等），支持筛选排序分页，返回名称/位置/评分/价格/营业时间。
license: MIT
---

## 能力概述

基于百度地图 API，在指定区域内对自然语言关键词进行多维度 POI（兴趣点）检索，支持模糊匹配和语义理解。

| 属性 | 值 |
|------|-----|
| Endpoint | `GET https://app-cblk1rqa5fk1-api-zYkZXBBNPe8L-gateway.appmiaoda.com/api_place_pro/v1/region` |
| 原始 API scheme | 原始 APIDOC 端点为 `http://app-cblk1rqa5fk1-api-zYkZXBBNPe8L-gateway.appmiaoda.com/api_place_pro/v1/region`（HTTP），gateway 已将其升级为 HTTPS 代理访问，调用时统一使用上方 HTTPS 地址即可 |
| 认证模式 | platform_managed（`X-Gateway-Authorization: Bearer ${apiKey}`） |
| 响应格式 | JSON |
| 结果上限 | total 最多返回 150 条，单页最多 20 条 |

**核心能力：**
- 自然语言查询，如「宠物友好餐厅」、「24小时便利店」
- 在指定城市/区域内检索，可限定仅返回区域内数据（`region_limit=true`）
- 按价格、评分、距离等多维度排序筛选（`filter` 参数）
- scope=2 返回含评分、价格、营业时间的详细信息
- 支持坐标系转换（wgs84ll / gcj02ll / bd09ll / bd09mc）

**响应示例：**

```json
{
  "status": 0,
  "message": "ok",
  "total": 30,
  "result_type": "poi_type",
  "query_type": "general",
  "results": [
    {
      "name": "东府饭店(高铁东站黑金冠店)",
      "uid": "fc6e4cc3de01b0ff095cb3a5",
      "location": { "lat": 34.76054100923168, "lng": 113.78117913246851 },
      "address": "商鼎路与心怡路交叉口东南角永和宇宙星一楼",
      "province": "河南省",
      "city": "郑州市",
      "area": "管城回族区",
      "telephone": "0371-55556818",
      "poi_related_score": 1.85,
      "match_term": "宠物友好;饭店餐馆;高颜值宴会厅",
      "detail_info": {
        "classified_poi_tag": "美食;中餐馆;特色菜",
        "price": "75.0",
        "overall_rating": "4.8",
        "shop_hours": "10:00-14:00,17:30-21:30"
      }
    }
  ]
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 在指定区域内检索 POI 信息。
 * @param query - 检索关键字，如「宠物友好餐厅」
 * @param region - 限定搜索区域，如「北京市」
 * @param options - 可选参数
 * @returns POI 列表及总数
 */
async function searchPoiMultidim(
  query: string,
  region: string,
  options?: {
    regionLimit?: boolean;
    scope?: 1 | 2;
    pageNum?: number;
    pageSize?: number;
    filter?: string;
    center?: string;
    coordType?: 1 | 2 | 3 | 4;
    retCoordtype?: string;
    extensionsAdcode?: boolean;
    output?: "json" | "xml";
  }
): Promise<{ total: number; results: Record<string, unknown>[] }> {
  const params = new URLSearchParams({
    query,
    region,
    output: options?.output ?? "json",
  });

  if (options?.regionLimit !== undefined) {
    params.set("region_limit", String(options.regionLimit));
  }
  if (options?.scope !== undefined) params.set("scope", String(options.scope));
  if (options?.pageNum !== undefined) params.set("page_num", String(options.pageNum));
  if (options?.pageSize !== undefined) params.set("page_size", String(options.pageSize));
  if (options?.filter) params.set("filter", options.filter);
  if (options?.center) params.set("center", options.center);
  if (options?.coordType !== undefined) params.set("coord_type", String(options.coordType));
  if (options?.retCoordtype) params.set("ret_coordtype", options.retCoordtype);
  if (options?.extensionsAdcode !== undefined) {
    params.set("extensions_adcode", String(options.extensionsAdcode));
  }

  const url = `https://app-cblk1rqa5fk1-api-zYkZXBBNPe8L-gateway.appmiaoda.com/api_place_pro/v1/region?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message}`);

  return { total: json.total, results: json.results };
}

// 示例：检索郑州宠物友好餐厅，按评分排序，返回详细信息
const result = await searchPoiMultidim("宠物友好餐厅", "郑州", {
  regionLimit: true,
  scope: 2,
  pageNum: 0,
  pageSize: 10,
  filter: "industry_type:cater sort_name:overall_rating sort_rule:1",
  extensionsAdcode: true,
});
console.log(`共找到 ${result.total} 个 POI`);
console.log(JSON.stringify(result.results, null, 2));
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/baidu-poi-multidim-search.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let query: string;
  let region: string;
  let regionLimit: boolean | undefined;
  let scope: number | undefined;
  let pageNum: number | undefined;
  let pageSize: number | undefined;
  let filter: string | undefined;
  let center: string | undefined;
  let coordType: number | undefined;
  let retCoordtype: string | undefined;
  let extensionsAdcode: boolean | undefined;
  let output: string | undefined;

  try {
    const body = await req.json();
    query = body.query;
    region = body.region;
    if (!query) throw new Error("Missing query");
    if (!region) throw new Error("Missing region");

    regionLimit = body.region_limit;
    scope = body.scope;
    pageNum = body.page_num;
    pageSize = body.page_size;
    filter = body.filter;
    center = body.center;
    coordType = body.coord_type;
    retCoordtype = body.ret_coordtype;
    extensionsAdcode = body.extensions_adcode;
    output = body.output ?? "json";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构建上游请求参数 ---
  const params = new URLSearchParams({ query, region, output: output! });
  if (regionLimit !== undefined) params.set("region_limit", String(regionLimit));
  if (scope !== undefined) params.set("scope", String(scope));
  if (pageNum !== undefined) params.set("page_num", String(pageNum));
  if (pageSize !== undefined) params.set("page_size", String(pageSize));
  if (filter) params.set("filter", filter);
  if (center) params.set("center", center);
  if (coordType !== undefined) params.set("coord_type", String(coordType));
  if (retCoordtype) params.set("ret_coordtype", retCoordtype);
  if (extensionsAdcode !== undefined) params.set("extensions_adcode", String(extensionsAdcode));

  // --- 调用上游 ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-zYkZXBBNPe8L-gateway.appmiaoda.com/api_place_pro/v1/region?${params.toString()}`,
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

### 前端调用（Web / MiniProgram 通用）

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 检索指定区域内的 POI。
 * @param query - 检索关键字
 * @param region - 限定搜索区域
 * @param options - 可选筛选/排序参数
 * @returns API 原始响应（含 status / total / results）
 */
async function searchPoi(
  query: string,
  region: string,
  options?: {
    region_limit?: boolean;
    scope?: 1 | 2;
    page_num?: number;
    page_size?: number;
    filter?: string;
    center?: string;
    coord_type?: number;
    ret_coordtype?: string;
    extensions_adcode?: boolean;
    output?: string;
  }
) {
  const { data, error } = await supabase.functions.invoke("baidu-poi-multidim-search", {
    body: { query, region, ...options },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.message}`);
  return data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function searchPoi(query: string, region: string, options?: Record<string, unknown>) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-poi-multidim-search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, region, ...options }),
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
  return json;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | — | 检索关键字，如「宠物友好餐厅」 |
| `region` | string | 是 | — | 限定搜索区域，如「北京市」 |
| `region_limit` | boolean | 否 | — | 区域数据召回限制，true 时仅召回 region 对应区域内数据 |
| `scope` | integer | 否 | 1 | 检索结果详细程度，1 返回基本信息，2 返回详细信息 |
| `page_num` | integer | 否 | 0 | 分页页码 |
| `page_size` | integer | 否 | 10 | 单次召回 POI 数量，最大 20 条 |
| `filter` | string | 否 | — | 检索排序条件，格式：`industry_type:cater sort_name:overall_rating sort_rule:1` |
| `center` | string | 否 | — | POI 坐标，格式：`lat,lng`，用于距离排序 |
| `coord_type` | integer | 否 | 3 | 传入坐标类型：1(wgs84ll)、2(gcj02ll)、3(bd09ll 默认)、4(bd09mc) |
| `ret_coordtype` | string | 否 | — | 返回坐标类型，可选：bd09ll、bd09mc、wgs84ll、gcj02ll |
| `extensions_adcode` | boolean | 否 | — | 是否召回国标行政区划编码 |
| `output` | string | 否 | json | 输出格式，json 或 xml |

> 注意：`ak`（百度地图 API 密钥）参数由平台通过 `X-Gateway-Authorization` header 注入，无需前端传递。

### 返回字段说明

**成功响应（status = 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，0 表示成功 |
| `message` | string | 状态信息 |
| `total` | integer | 结果总数，最多返回 150 |
| `result_type` | string | 结果类型 |
| `query_type` | string | 查询类型 |
| `results` | array | POI 信息数组 |
| `results[].name` | string | POI 名称 |
| `results[].uid` | string | POI 唯一标识 |
| `results[].location.lat` | number | 纬度 |
| `results[].location.lng` | number | 经度 |
| `results[].address` | string | 详细地址 |
| `results[].province` | string | 所属省份 |
| `results[].city` | string | 所属城市 |
| `results[].area` | string | 所属区域 |
| `results[].telephone` | string | 联系电话 |
| `results[].poi_related_score` | number | 相关性评分 |
| `results[].match_term` | string | 匹配标签（分号分隔） |
| `results[].detail_info.classified_poi_tag` | string | 分类标签（scope=2） |
| `results[].detail_info.price` | string | 价格（scope=2） |
| `results[].detail_info.overall_rating` | string | 综合评分（scope=2） |
| `results[].detail_info.shop_hours` | string | 营业时间（scope=2） |

**失败响应（status ≠ 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 错误码（非 0） |
| `message` | string | 错误描述 |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种特殊状态码。
- **计费**：单次调用定价 ¥0.75（原价 ¥1.20），请避免不必要的重复调用。
- **分页限制**：`total` 最多返回 150 条，单页 `page_size` 最大 20 条；如需全量数据，需循环翻页。
- **详细信息**：评分、价格、营业时间等字段在 `detail_info` 中，需设置 `scope=2` 才能返回。
- **排序筛选**：`filter` 参数格式为空格分隔的键值对，例如：`industry_type:cater sort_name:overall_rating sort_rule:1`（sort_rule: 1 降序，0 升序）。
- **距离排序**：使用距离排序时，须同时传入 `center`（参考坐标）和 `filter` 中的距离排序参数。
- **高级功能**：多语言检索（`language` 参数）和个性化搜索（`baidu_user_id`、`baidu_session_id`）为高级付费功能。
