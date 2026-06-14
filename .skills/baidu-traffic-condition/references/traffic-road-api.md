# 道路实时路况查询 API

## 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `afe98a5e-125b-4104-adfc-3f57e2d42da1` |
| API ID | `api-rLobR3D3dbg9` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-rLobR3D3dbg9-gateway.appmiaoda.com/traffic/v1/road` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/json`（GET 请求，参数通过 Query String 传递） |
| third_part_domain | `app-cblk1rqa5fk1-api-rLobR3D3dbg9-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `road_name` | string | 是 | 道路名称，如"信息路"、"五道口"、"东二环" |
| `city` | string | 否 | 城市名称，用于精确定位道路位置，如"北京市" |

## 响应字段

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，0 表示成功 |
| `message` | string | 状态描述 |
| `result` | object | 路况结果对象 |
| `result.evaluation` | string | 整体拥堵评价（如"畅通"、"缓行"、"拥堵"） |
| `result.congestion_sections` | array | 拥堵路段列表 |
| `result.congestion_sections[].distance` | number | 拥堵距离（米） |
| `result.congestion_sections[].status` | string | 拥堵程度 |
| `result.congestion_sections[].trend` | string | 拥堵趋势（加重/持平/缓解） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 非 0 的错误码 |
| `message` | string | 错误描述 |

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 查询指定道路的实时拥堵信息。
 * @param roadName - 道路名称，如"东二环"
 * @param city - 可选，城市名称，如"北京市"
 * @returns 包含整体拥堵评价和拥堵路段列表的结果对象
 */
async function queryRoadTraffic(
  roadName: string,
  city?: string,
): Promise<{ evaluation: string; congestion_sections: Array<{ distance: number; status: string; trend: string }> }> {
  const params = new URLSearchParams({ road_name: roadName });
  if (city) params.set("city", city);

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-rLobR3D3dbg9-gateway.appmiaoda.com/traffic/v1/road?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message}`);

  return json.result;
}

// 示例调用
const result = await queryRoadTraffic("东二环", "北京市");
console.log("整体评价:", result.evaluation);
console.log("拥堵路段数:", result.congestion_sections.length);
```

## Edge Function 代码

```typescript
// edge-functions/traffic-road.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let roadName: string;
  let city: string | undefined;
  try {
    const body = await req.json();
    roadName = body.road_name;
    city = body.city;
    if (!roadName) throw new Error("Missing road_name");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const params = new URLSearchParams({ road_name: roadName });
  if (city) params.set("city", city);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-rLobR3D3dbg9-gateway.appmiaoda.com/traffic/v1/road?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
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

## 前端调用代码

### 推荐方式（supabase client 可用时）

```typescript
/**
 * 通过 Edge Function 查询道路实时路况。
 * @param roadName - 道路名称
 * @param city - 可选，城市名称
 * @returns 包含整体拥堵评价和拥堵路段列表的结果对象
 */
async function queryRoadTraffic(
  roadName: string,
  city?: string,
): Promise<{ evaluation: string; congestion_sections: Array<{ distance: number; status: string; trend: string }> }> {
  const { data, error } = await supabase.functions.invoke("traffic-road", {
    body: { road_name: roadName, city },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.message}`);
  return data.result;
}
```

### 备用方式（无 supabase client 时）

```typescript
/**
 * 通过 Edge Function 查询道路实时路况（无 supabase client 备用方式）。
 * @param roadName - 道路名称
 * @param city - 可选，城市名称
 * @returns 包含整体拥堵评价和拥堵路段列表的结果对象
 */
async function queryRoadTrafficFallback(
  roadName: string,
  city?: string,
): Promise<{ evaluation: string; congestion_sections: Array<{ distance: number; status: string; trend: string }> }> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/traffic-road`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ road_name: roadName, city }),
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
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}：${json.message}`);
  return json.result;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：原价 ¥1.20 / 次，折扣价 ¥0.75 / 次，每次接口调用单独计费，避免不必要的重复调用。
- **数据时效**：路况数据为分钟级更新（约 1 分钟刷新频率），不适合秒级实时场景。
- **city 参数**：同名道路在不同城市均存在时，建议带上 `city` 参数以精确定位。
