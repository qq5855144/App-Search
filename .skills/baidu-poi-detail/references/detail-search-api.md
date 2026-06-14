# 地点详情检索 API

## API 基本信息

| 项目 | 值 |
|------|-----|
| Plugin ID | `d5c0b7d3-bc6a-4d3a-b8a2-e37246fac4df` |
| API ID | `api-GaDwZekp8WzY` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-GaDwZekp8WzY-gateway.appmiaoda.com/place/v3/detail` |
| Auth | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>`（platform_managed） |
| Content-Type | 无请求体（GET 参数通过 URL 查询串传递） |
| Third-party domain | `app-cblk1rqa5fk1-api-GaDwZekp8WzY-gateway.appmiaoda.com` |
| 计费 | 按次计费，折扣价 ¥0.75 / 千次，原价 ¥1.20 / 千次 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `uid` | string | 与 uids 二选一 | — | POI 的唯一标识（单个查询） |
| `uids` | string | 与 uid 二选一 | — | 多个 uid 集合，逗号分隔，最多 10 个（批量查询） |
| `scope` | integer | 否 | 1（推断） | 结果详细程度，1 为基本信息，2 为详细信息 |
| `photo_show` | boolean | 否 | — | 是否输出图片信息（需商用授权） |

---

## 响应字段表

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，0 表示成功 |
| `message` | string | 状态信息，成功时为 "ok" |
| `results` | array | POI 详情数组 |
| `results[].uid` | string | POI 唯一标识 |
| `results[].name` | string | POI 名称 |
| `results[].location` | object | 经纬度坐标 |
| `results[].location.lng` | number | 经度 |
| `results[].location.lat` | number | 纬度 |
| `results[].address` | string | 详细地址 |
| `results[].detail_info` | object? | 详细信息（scope=2 时返回） |
| `results[].detail_info.tag` | string? | 标签分类，如「房地产;写字楼」 |
| `results[].detail_info.overall_rating` | string? | 综合评分 |
| `results[].detail_info.shop_hours` | string? | 营业时间 |
| `results[].detail_info.price` | string? | 价格信息 |
| `results[].detail_info.comment_num` | string? | 评论数 |
| `results[].detail_info.image_num` | string? | 图片数量 |
| `results[].detail_info.photos` | array? | 图片链接列表（需商用授权） |
| `results[].detail_info.children` | array? | 子 POI 信息 |

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
      "uid": "435d7aea036e54355abbbcc8",
      "name": "百度大厦",
      "location": {"lng": 116.307, "lat": 40.057},
      "address": "上地十街10号",
      "detail_info": {
        "tag": "房地产;写字楼",
        "overall_rating": "4.7",
        "shop_hours": "",
        "comment_num": "200",
        "image_num": "172"
      }
    }
  ]
}
```

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface PoiDetailInfo {
  tag?: string;
  overall_rating?: string;
  shop_hours?: string;
  price?: string;
  comment_num?: string;
  image_num?: string;
  photos?: Array<{ url: string }>;
  children?: unknown[];
}

interface PoiDetail {
  uid: string;
  name: string;
  location: { lng: number; lat: number };
  address: string;
  detail_info?: PoiDetailInfo;
}

interface DetailResponse {
  status: number;
  message: string;
  results: PoiDetail[];
}

/**
 * 根据 POI uid 获取地点详细信息，支持单个或批量查询（最多 10 个）。
 * @param uids - 单个 uid 字符串，或多个 uid 数组（最多 10 个）
 * @param options - 可选参数：scope（详细程度）、photoShow（是否返回图片，需商用授权）
 * @returns POI 详情列表
 */
async function getPoiDetail(
  uids: string | string[],
  options: {
    scope?: 1 | 2;
    photoShow?: boolean;
  } = {}
): Promise<PoiDetail[]> {
  const params = new URLSearchParams();
  if (Array.isArray(uids)) {
    params.set("uids", uids.join(","));
  } else {
    params.set("uid", uids);
  }
  if (options.scope !== undefined) params.set("scope", String(options.scope));
  if (options.photoShow !== undefined) params.set("photo_show", String(options.photoShow));

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-GaDwZekp8WzY-gateway.appmiaoda.com/place/v3/detail?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: DetailResponse = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message}`);

  return json.results;
}

// 单个查询示例
const detail = await getPoiDetail("435d7aea036e54355abbbcc8", { scope: 2 });
console.log(JSON.stringify(detail, null, 2));

// 批量查询示例（最多 10 个 uid）
const details = await getPoiDetail(
  ["435d7aea036e54355abbbcc8", "05478f385d3729eef4eafc16"],
  { scope: 2 }
);
console.log(JSON.stringify(details, null, 2));
```

---

## Edge Function 代码

```typescript
// edge-functions/baidu-poi-detail.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let uid: string | undefined;
  let uids: string | undefined;
  let scope: number | undefined;
  let photoShow: boolean | undefined;

  try {
    const body = await req.json();
    uid = body.uid;
    uids = body.uids;
    if (!uid && !uids) throw new Error("Missing uid or uids");
    scope = body.scope;
    photoShow = body.photo_show;
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
  const params = new URLSearchParams();
  if (uids) {
    params.set("uids", uids);
  } else if (uid) {
    params.set("uid", uid);
  }
  if (scope !== undefined) params.set("scope", String(scope));
  if (photoShow !== undefined) params.set("photo_show", String(photoShow));

  // --- 调用上游接口 ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-GaDwZekp8WzY-gateway.appmiaoda.com/place/v3/detail?${params.toString()}`,
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
interface DetailParams {
  uid?: string;
  uids?: string;
  scope?: 1 | 2;
  photo_show?: boolean;
}

/**
 * 通过 Edge Function 查询 POI 地点详情，支持单个或批量（最多 10 个）。
 * @param params - 必须传 uid（单个）或 uids（多个逗号分隔，最多 10 个）之一
 * @returns POI 详情列表
 */
async function getPoiDetail(params: DetailParams) {
  const { data, error } = await supabase.functions.invoke("baidu-poi-detail", {
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
 * 通过原生 fetch 调用地点详情检索 Edge Function。
 * @param params - uid 或 uids 参数
 * @returns POI 详情列表
 */
async function getPoiDetail(params: DetailParams) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-poi-detail`,
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
- **计费**：按次计费，折扣价 ¥0.75 / 千次，原价 ¥1.20 / 千次。批量查询（uids）仍按 1 次计费，推荐合并请求。
- **uid 来源**：uid 通常从「行政区划检索」或「圆形区域检索」的 `results[].uid` 字段获取。
- **批量上限**：`uids` 最多传 10 个 uid，超出需分批调用。
- **photo_show**：图片输出需要商用授权，普通账号请勿设为 true，否则可能报错。
- **scope=2**：返回 `overall_rating`、`shop_hours`、`price`、`comment_num` 等详细字段，建议在展示地点详情页时使用。
