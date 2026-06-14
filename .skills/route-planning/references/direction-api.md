# 路线规划 — Direction API v2（驾车 / 骑行 / 步行 / 公交）

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `2781e08a-461f-48c0-8cf0-7302654b8c9c` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |
| HTTP 方法 | GET |
| Content-Type | — (GET 请求，无请求体) |
| third_part_domain | `app-cblk1rqa5fk1-api-GaDwZKpJxXOY-gateway.appmiaoda.com` |

| 接口 | API ID | Endpoint |
|------|--------|---------|
| 驾车路线规划 | `api-GaDwZKpJxXOY` | `GET https://app-cblk1rqa5fk1-api-GaDwZKpJxXOY-gateway.appmiaoda.com/direction/v2/driving` |
| 骑行路线规划 | `api-W9z3MpAdKeNL` | `GET https://app-cblk1rqa5fk1-api-W9z3MpAdKeNL-gateway.appmiaoda.com/direction/v2/riding` |
| 步行路线规划 | `api-wLNdomNRn42a` | `GET https://app-cblk1rqa5fk1-api-wLNdomNRn42a-gateway.appmiaoda.com/direction/v2/walking` |
| 公交路线规划 | `api-m9xKXQkOKZXa` | `GET https://app-cblk1rqa5fk1-api-m9xKXQkOKZXa-gateway.appmiaoda.com/direction/v2/transit` |

---

## 请求参数表

### 驾车路线规划（/direction/v2/driving）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origin` | string | 是 | — | 起点坐标，格式：纬度,经度 |
| `destination` | string | 是 | — | 终点坐标，格式：纬度,经度 |
| `tactics` | integer | 否 | 0 | 路线策略（0-12），0 为常规路线 |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型，默认百度经纬度 |
| `waypoints` | string | 否 | — | 途经点坐标 |

### 骑行路线规划（/direction/v2/riding）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origin` | string | 是 | — | 起点坐标，格式：纬度,经度 |
| `destination` | string | 是 | — | 终点坐标，格式：纬度,经度 |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型，默认百度经纬度 |

### 步行路线规划（/direction/v2/walking）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origin` | string | 是 | — | 起点坐标，格式：纬度,经度 |
| `destination` | string | 是 | — | 终点坐标，格式：纬度,经度 |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型，默认百度经纬度 |

### 公交路线规划（/direction/v2/transit）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origin` | string | 是 | — | 起点坐标，格式：纬度,经度 |
| `destination` | string | 是 | — | 终点坐标，格式：纬度,经度 |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型，默认百度经纬度 |
| `tactics_incity` | integer | 否 | — | 市内公交策略（0-5） |
| `trans_type_intercity` | integer | 否 | — | 跨城交通方式 |

---

## 响应字段表

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，0 表示成功 |
| `result` | object | 路线结果 |
| `result.routes` | array | 路线方案数组 |
| `result.routes[].distance` | integer | 路线距离（米） |
| `result.routes[].duration` | integer | 预计耗时（秒） |
| `result.routes[].steps` | array | 路段详情 |
| `result.routes[].traffic_condition` | array | 路况信息（驾车接口） |
| `result.routes[].price` | number | 预计票价（公交接口） |

### 失败响应（status≠0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 非 0 错误码 |
| `message` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

type DirectionMode = "driving" | "riding" | "walking" | "transit";

interface DirectionResult {
  status: number;
  result: {
    routes: Array<{
      distance: number;
      duration: number;
      steps: unknown[];
      traffic_condition?: unknown[];
      price?: number;
    }>;
  };
}

/**
 * 调用百度地图路线规划接口，支持驾车、骑行、步行、公交四种模式。
 * @param mode - 路线模式
 * @param origin - 起点坐标（纬度,经度）
 * @param destination - 终点坐标（纬度,经度）
 * @param extra - 可选额外参数，如 tactics、waypoints、tactics_incity 等
 * @returns 路线规划结果
 */
async function planRoute(
  mode: DirectionMode,
  origin: string,
  destination: string,
  extra: Record<string, string | number> = {}
): Promise<DirectionResult> {
  const apiIdMap: Record<DirectionMode, string> = {
    driving: "api-GaDwZKpJxXOY",
    riding: "api-W9z3MpAdKeNL",
    walking: "api-wLNdomNRn42a",
    transit: "api-m9xKXQkOKZXa",
  };
  const apiId = apiIdMap[mode];

  const params = new URLSearchParams({
    origin,
    destination,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });

  const url = `https://${apiId}@app-cblk1rqa5fk1-api-GaDwZKpJxXOY-gateway.appmiaoda.com/direction/v2/${mode}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: DirectionResult = await response.json();
  if (json.status !== 0) throw new Error(`API error status=${json.status}`);

  return json;
}

// 示例：驾车路线规划
const drivingResult = await planRoute(
  "driving",
  "40.01116,116.339303",
  "39.936404,116.452562",
  { tactics: 0 }
);
console.log("驾车距离（米）：", drivingResult.result.routes[0].distance);
console.log("预计耗时（秒）：", drivingResult.result.routes[0].duration);

// 示例：公交路线规划（跨城）
const transitResult = await planRoute(
  "transit",
  "40.056878,116.30815",
  "31.222965,121.505821"
);
console.log("公交方案数量：", transitResult.result.routes.length);
```

---

## Edge Function 代码

```typescript
// edge-functions/route-direction.ts
import { serve } from "https://deno.land/std/http/server.ts";

type DirectionMode = "driving" | "riding" | "walking" | "transit";

const API_ID_MAP: Record<DirectionMode, string> = {
  driving: "api-GaDwZKpJxXOY",
  riding: "api-W9z3MpAdKeNL",
  walking: "api-wLNdomNRn42a",
  transit: "api-m9xKXQkOKZXa",
};

const VALID_MODES = new Set<string>(["driving", "riding", "walking", "transit"]);

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求体 ---
  let mode: DirectionMode;
  let origin: string;
  let destination: string;
  let extra: Record<string, string> = {};

  try {
    const body = await req.json();
    mode = body.mode;
    origin = body.origin;
    destination = body.destination;
    extra = body.extra ?? {};

    if (!mode || !VALID_MODES.has(mode)) {
      throw new Error("Missing or invalid mode (driving/riding/walking/transit)");
    }
    if (!origin) throw new Error("Missing origin");
    if (!destination) throw new Error("Missing destination");
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（严禁暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 调用上游 ---
  const apiId = API_ID_MAP[mode];
  const params = new URLSearchParams({
    origin,
    destination,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
  const upstreamUrl =
    `https://${apiId}@app-cblk1rqa5fk1-api-GaDwZKpJxXOY-gateway.appmiaoda.com/direction/v2/${mode}?${params.toString()}`;

  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

### Web / MiniProgram（推荐，supabase client 可用时）

```typescript
/**
 * 调用路线规划 Edge Function。
 * @param mode - 路线模式（driving/riding/walking/transit）
 * @param origin - 起点坐标（纬度,经度）
 * @param destination - 终点坐标（纬度,经度）
 * @param extra - 可选额外参数，如 tactics、waypoints 等
 * @returns 路线规划结果
 */
async function planRoute(
  mode: "driving" | "riding" | "walking" | "transit",
  origin: string,
  destination: string,
  extra: Record<string, string | number> = {}
) {
  const { data, error } = await supabase.functions.invoke("route-direction", {
    body: { mode, origin, destination, extra },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status=${data.status}`);
  return data.result;
}

// 使用示例
const result = await planRoute("driving", "40.01116,116.339303", "39.936404,116.452562");
const route = result.routes[0];
console.log(`距离：${route.distance} 米，耗时：${route.duration} 秒`);
```

### 备用方式（无法使用 supabase client 时）

```typescript
async function planRoute(
  mode: "driving" | "riding" | "walking" | "transit",
  origin: string,
  destination: string,
  extra: Record<string, string | number> = {}
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/route-direction`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, origin, destination, extra }),
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
  if (json.status !== 0) throw new Error(`API 错误 status=${json.status}`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：原价 ¥1.20 / 千次调用，折扣价 ¥0.75 / 千次调用（每次调用单独计费），
  避免用户频繁重复触发路线规划请求。
- **坐标格式**：默认使用百度经纬度（`bd09ll`），若使用 GPS 坐标（`wgs84`）或国测局坐标
  （`gcj02`）需通过 `coord_type` 参数指定。
- **驾车策略**：`tactics` 参数 0-12，常用值：0 常规路线、10 不走高速、11 常规（含路况）、
  12 距离较短（含路况）。
- **公交跨城**：起终点跨城市时，推荐通过 `trans_type_intercity` 指定高铁/飞机等交通方式。
