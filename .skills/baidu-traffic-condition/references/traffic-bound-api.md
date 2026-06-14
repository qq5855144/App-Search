# 矩形区域实时路况查询 API

## 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `afe98a5e-125b-4104-adfc-3f57e2d42da1` |
| API ID | `api-ra5ErGpGM8wa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-ra5ErGpGM8wa-gateway.appmiaoda.com/traffic/v1/bound` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/json`（GET 请求，参数通过 Query String 传递） |
| third_part_domain | `app-cblk1rqa5fk1-api-ra5ErGpGM8wa-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `bounds` | string | 是 | 矩形区域范围，格式：`左下角纬度,左下角经度;右上角纬度,右上角经度`，例：`39.912078,116.464303;39.918276,116.475442` |
| `coord_type_input` | string | 否 | 输入坐标系类型，如 `gcj02`、`bd09ll` |
| `coord_type_output` | string | 否 | 输出坐标系类型，如 `gcj02`、`bd09ll` |

## 响应字段

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，0 表示成功 |
| `result` | object | 区域路况结果对象 |
| `result.evaluation` | string | 区域整体拥堵评价 |
| `result.roads`? | array | 拥堵路段列表（各路段详细信息） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 非 0 的错误码 |
| `message`? | string | 错误描述 |

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 查询指定矩形地理区域的实时路况信息。
 * @param bounds - 矩形范围，格式："左下角纬度,左下角经度;右上角纬度,右上角经度"
 * @param coordTypeInput - 可选，输入坐标系类型，如 "gcj02"
 * @param coordTypeOutput - 可选，输出坐标系类型，如 "gcj02"
 * @returns 包含整体拥堵评价和路段列表的结果对象
 */
async function queryBoundTraffic(
  bounds: string,
  coordTypeInput?: string,
  coordTypeOutput?: string,
): Promise<{ evaluation: string; roads?: unknown[] }> {
  const params = new URLSearchParams({ bounds });
  if (coordTypeInput) params.set("coord_type_input", coordTypeInput);
  if (coordTypeOutput) params.set("coord_type_output", coordTypeOutput);

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-ra5ErGpGM8wa-gateway.appmiaoda.com/traffic/v1/bound?${params.toString()}`,
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
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message ?? ""}`);

  return json.result;
}

// 示例调用（使用 gcj02 坐标系）
const result = await queryBoundTraffic(
  "39.912078,116.464303;39.918276,116.475442",
  "gcj02",
  "gcj02",
);
console.log("区域整体评价:", result.evaluation);
```

## Edge Function 代码

```typescript
// edge-functions/traffic-bound.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let bounds: string;
  let coordTypeInput: string | undefined;
  let coordTypeOutput: string | undefined;
  try {
    const body = await req.json();
    bounds = body.bounds;
    coordTypeInput = body.coord_type_input;
    coordTypeOutput = body.coord_type_output;
    if (!bounds) throw new Error("Missing bounds");
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
  const params = new URLSearchParams({ bounds });
  if (coordTypeInput) params.set("coord_type_input", coordTypeInput);
  if (coordTypeOutput) params.set("coord_type_output", coordTypeOutput);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-ra5ErGpGM8wa-gateway.appmiaoda.com/traffic/v1/bound?${params.toString()}`,
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
 * 通过 Edge Function 查询矩形区域实时路况。
 * @param bounds - 矩形范围字符串
 * @param coordTypeInput - 可选，输入坐标系类型
 * @param coordTypeOutput - 可选，输出坐标系类型
 * @returns 包含整体拥堵评价和路段列表的结果对象
 */
async function queryBoundTraffic(
  bounds: string,
  coordTypeInput?: string,
  coordTypeOutput?: string,
): Promise<{ evaluation: string; roads?: unknown[] }> {
  const { data, error } = await supabase.functions.invoke("traffic-bound", {
    body: { bounds, coord_type_input: coordTypeInput, coord_type_output: coordTypeOutput },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.message ?? ""}`);
  return data.result;
}
```

### 备用方式（无 supabase client 时）

```typescript
/**
 * 通过 Edge Function 查询矩形区域实时路况（无 supabase client 备用方式）。
 * @param bounds - 矩形范围字符串
 * @param coordTypeInput - 可选，输入坐标系类型
 * @param coordTypeOutput - 可选，输出坐标系类型
 * @returns 包含整体拥堵评价和路段列表的结果对象
 */
async function queryBoundTrafficFallback(
  bounds: string,
  coordTypeInput?: string,
  coordTypeOutput?: string,
): Promise<{ evaluation: string; roads?: unknown[] }> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/traffic-bound`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bounds, coord_type_input: coordTypeInput, coord_type_output: coordTypeOutput }),
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
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}：${json.message ?? ""}`);
  return json.result;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：原价 ¥1.20 / 次，折扣价 ¥0.75 / 次，每次接口调用单独计费。
- **坐标系**：`bounds` 坐标的格式为 `纬度,经度`（非经度在前），注意与其他平台约定的差异。建议显式传入 `coord_type_input` 和 `coord_type_output`（推荐使用 `gcj02`）。
- **查询范围**：矩形范围不宜过大，过大区域可能导致返回数据量大或响应超时。
