# 路线规划 — RouteMatrix API v2（驾车 / 骑行 / 步行批量算路）

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `2781e08a-461f-48c0-8cf0-7302654b8c9c` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |
| HTTP 方法 | GET |
| Content-Type | — (GET 请求，无请求体) |
| third_part_domain | `app-cblk1rqa5fk1-api-6LeBrqqMqKQY-gateway.appmiaoda.com` |

| 接口 | API ID | Endpoint |
|------|--------|---------|
| 驾车批量算路 | `api-6LeBrqqMqKQY` | `GET https://app-cblk1rqa5fk1-api-6LeBrqqMqKQY-gateway.appmiaoda.com/routematrix/v2/driving` |
| 骑行批量算路 | `api-Aa2Pq88pDANL` | `GET https://app-cblk1rqa5fk1-api-Aa2Pq88pDANL-gateway.appmiaoda.com/routematrix/v2/riding` |
| 步行批量算路 | `api-qYGW2zz1MklY` | `GET https://app-cblk1rqa5fk1-api-qYGW2zz1MklY-gateway.appmiaoda.com/routematrix/v2/walking` |

---

## 请求参数表

### 驾车批量算路（/routematrix/v2/driving）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origins` | string | 是 | — | 起点坐标，格式：`纬度,经度\|纬度,经度`，支持多个 |
| `destinations` | string | 是 | — | 终点坐标，格式：`纬度,经度\|纬度,经度`，支持多个 |
| `tactics` | string | 否 | `13` | 驾车偏好：10 不走高速，11 常规路线，12 距离较短（考虑路况），13 距离较短（不考虑路况） |
| `output` | string | 否 | `json` | 输出格式：json 或 xml |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型：bd09ll、bd09mc、gcj02、wgs84 |
| `ret_straight_dist` | int | 否 | `0` | 0 返回路线距离，1 返回直线距离 |

### 骑行批量算路（/routematrix/v2/riding）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origins` | string | 是 | — | 起点坐标，格式：`纬度,经度\|纬度,经度`，支持 `纬度,经度;uid` 提升准确性 |
| `destinations` | string | 是 | — | 终点坐标，格式同上 |
| `riding_type` | string | 否 | `0` | 骑行类型：0 普通自行车，1 电动自行车 |
| `road_prefer` | int | 否 | `0` | 算路方案：0 默认路线，3 无逆行且无阶梯 |
| `output` | string | 否 | `json` | 输出格式：json 或 xml |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型：bd09ll、bd09mc、gcj02、wgs84 |
| `ret_straight_dist` | int | 否 | `0` | 0 返回路线距离，1 返回直线距离 |

### 步行批量算路（/routematrix/v2/walking）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `origins` | string | 是 | — | 起点坐标，格式：`纬度,经度\|纬度,经度`，支持 `纬度,经度;uid` 提升准确性 |
| `destinations` | string | 是 | — | 终点坐标，格式同上 |
| `road_prefer` | int | 否 | `0` | 算路方案：0 默认路线，3 无逆行且无阶梯 |
| `output` | string | 否 | `json` | 输出格式：json 或 xml |
| `coord_type` | string | 否 | `bd09ll` | 坐标类型：bd09ll、bd09mc、gcj02、wgs84 |
| `ret_straight_dist` | int | 否 | `0` | 0 返回路线距离，1 返回直线距离 |

---

## 响应字段表

### 成功响应（status=0）

```json
{
  "status": 0,
  "message": "成功",
  "result": [
    {
      "distance": { "text": "19.3公里", "value": 19337 },
      "duration": { "text": "12分钟", "value": 725 }
    }
  ]
}
```

结果按起点 × 终点笛卡尔积顺序排列（origins[0]→destinations[0], origins[0]→destinations[1], …）。

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | int | 状态码，0 成功，1 服务器内部错误，2 参数错误 |
| `message` | string | 状态描述 |
| `result` | array | 算路结果数组，按笛卡尔积顺序返回 |
| `result[].distance.text` | string | 距离文本描述 |
| `result[].distance.value` | double | 距离数值（米） |
| `result[].duration.text` | string | 耗时文本描述 |
| `result[].duration.value` | double | 耗时数值（秒） |
| `result[].restrictions_status` | int | 限行状态（骑行接口） |
| `result[].retrograde_dist` | int | 逆行距离（骑行接口） |

### 失败响应（status≠0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | int | 错误码（1 服务器内部错误，2 参数错误） |
| `message` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

type MatrixMode = "driving" | "riding" | "walking";

interface MatrixResult {
  status: number;
  message: string;
  result: Array<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    restrictions_status?: number;
    retrograde_dist?: number;
  }>;
}

const MATRIX_API_ID: Record<MatrixMode, string> = {
  driving: "api-6LeBrqqMqKQY",
  riding: "api-Aa2Pq88pDANL",
  walking: "api-qYGW2zz1MklY",
};

/**
 * 调用百度地图批量算路接口，计算多起点到多终点的距离和耗时。
 * @param mode - 出行方式（driving/riding/walking）
 * @param origins - 起点坐标数组，格式：["纬度,经度", ...]
 * @param destinations - 终点坐标数组，格式：["纬度,经度", ...]
 * @param extra - 可选额外参数，如 tactics、riding_type、road_prefer 等
 * @returns 批量算路结果（按笛卡尔积顺序）
 */
async function batchCalcRoute(
  mode: MatrixMode,
  origins: string[],
  destinations: string[],
  extra: Record<string, string | number> = {}
): Promise<MatrixResult> {
  const apiId = MATRIX_API_ID[mode];
  const params = new URLSearchParams({
    origins: origins.join("|"),
    destinations: destinations.join("|"),
    output: "json",
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });

  const url =
    `https://${apiId}@app-cblk1rqa5fk1-api-6LeBrqqMqKQY-gateway.appmiaoda.com/routematrix/v2/${mode}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: MatrixResult = await response.json();
  if (json.status !== 0) {
    throw new Error(`API error status=${json.status}: ${json.message}`);
  }

  return json;
}

// 示例：驾车批量算路（2 起点 × 2 终点 = 4 条路线）
const matrixResult = await batchCalcRoute(
  "driving",
  ["40.45,116.34", "40.54,116.35"],
  ["40.34,116.45", "40.35,116.46"],
  { tactics: "11" }
);

// 结果按 origins[0]→destinations[0], origins[0]→destinations[1], origins[1]→… 排列
matrixResult.result.forEach((item, idx) => {
  console.log(`路线 ${idx}: ${item.distance.text}，${item.duration.text}`);
});

// 示例：骑行批量算路（电动自行车）
const ridingResult = await batchCalcRoute(
  "riding",
  ["40.45,116.34"],
  ["40.34,116.45"],
  { riding_type: "1" }
);
console.log("骑行距离：", ridingResult.result[0].distance.text);
console.log("骑行耗时：", ridingResult.result[0].duration.text);
```

---

## Edge Function 代码

```typescript
// edge-functions/route-matrix.ts
import { serve } from "https://deno.land/std/http/server.ts";

type MatrixMode = "driving" | "riding" | "walking";

const API_ID_MAP: Record<MatrixMode, string> = {
  driving: "api-6LeBrqqMqKQY",
  riding: "api-Aa2Pq88pDANL",
  walking: "api-qYGW2zz1MklY",
};

const VALID_MODES = new Set<string>(["driving", "riding", "walking"]);

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求体 ---
  let mode: MatrixMode;
  let origins: string[];
  let destinations: string[];
  let extra: Record<string, string> = {};

  try {
    const body = await req.json();
    mode = body.mode;
    origins = body.origins;
    destinations = body.destinations;
    extra = body.extra ?? {};

    if (!mode || !VALID_MODES.has(mode)) {
      throw new Error("Missing or invalid mode (driving/riding/walking)");
    }
    if (!Array.isArray(origins) || origins.length === 0) {
      throw new Error("origins must be a non-empty array");
    }
    if (!Array.isArray(destinations) || destinations.length === 0) {
      throw new Error("destinations must be a non-empty array");
    }
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
    origins: origins.join("|"),
    destinations: destinations.join("|"),
    output: "json",
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
  const upstreamUrl =
    `https://${apiId}@app-cblk1rqa5fk1-api-6LeBrqqMqKQY-gateway.appmiaoda.com/routematrix/v2/${mode}?${params.toString()}`;

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
 * 调用批量算路 Edge Function，计算多起点到多终点的距离和耗时。
 * @param mode - 出行方式（driving/riding/walking）
 * @param origins - 起点坐标数组，格式：["纬度,经度", ...]
 * @param destinations - 终点坐标数组，格式：["纬度,经度", ...]
 * @param extra - 可选额外参数，如 tactics、riding_type 等
 * @returns 批量算路结果数组（按笛卡尔积顺序）
 */
async function batchCalcRoute(
  mode: "driving" | "riding" | "walking",
  origins: string[],
  destinations: string[],
  extra: Record<string, string | number> = {}
) {
  const { data, error } = await supabase.functions.invoke("route-matrix", {
    body: { mode, origins, destinations, extra },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status=${data.status}: ${data.message}`);
  return data.result as Array<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  }>;
}

// 使用示例：物流配送距离矩阵
const matrix = await batchCalcRoute(
  "driving",
  ["40.45,116.34", "40.54,116.35"],
  ["40.34,116.45", "40.35,116.46"]
);
matrix.forEach((item, idx) => {
  console.log(`路线 ${idx}: ${item.distance.text}，${item.duration.text}`);
});
```

### 备用方式（无法使用 supabase client 时）

```typescript
async function batchCalcRoute(
  mode: "driving" | "riding" | "walking",
  origins: string[],
  destinations: string[],
  extra: Record<string, string | number> = {}
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/route-matrix`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, origins, destinations, extra }),
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
  if (json.status !== 0) throw new Error(`API 错误 status=${json.status}: ${json.message}`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：原价 ¥1.20 / 千次调用，折扣价 ¥0.75 / 千次调用（每次调用单独计费）。
  批量算路每次请求计为一次调用，含多对起终点；请合理合批请求以控制成本。
- **结果顺序**：返回数组按 origins × destinations 笛卡尔积顺序排列，即
  `origins[0]→destinations[0]`、`origins[0]→destinations[1]`、…、`origins[n]→destinations[m]`。
- **坐标格式**：默认使用百度经纬度（`bd09ll`），支持 bd09ll、bd09mc、gcj02、wgs84，
  使用 GPS 坐标时传 `coord_type: "wgs84"`。
- **驾车策略**：`tactics` 参数：10 不走高速，11 常规路线，12 距离较短（考虑路况），
  13 距离较短（不考虑路况，默认）。
- **骑行类型**：`riding_type` 参数：0 普通自行车（默认），1 电动自行车。
- **无阶梯路线**：骑行和步行接口支持 `road_prefer=3`，返回无逆行且无阶梯的路线，
  适合无障碍出行或电动车场景。
