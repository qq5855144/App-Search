# 百度地图地理编码接口（地址 → 坐标）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `dd5f588a-c7bb-4ca1-984e-6d91565eadd1` |
| API ID | `api-GaDwZ0j3erOY` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-GaDwZ0j3erOY-gateway.appmiaoda.com/geocoding/v3/` |
| 认证模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| third_part_domain | `app-cblk1rqa5fk1-api-GaDwZ0j3erOY-gateway.appmiaoda.com` |
| 计费 | 免费，但会统计调用次数 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | string | 是 | 待解析的地址，支持结构化地址或路口描述 |
| `city` | string | 否 | 地址所在城市，用于过滤有歧义的地址 |
| `ret_coordtype` | string | 否 | 返回坐标类型：`gcj02ll`（国测局）、`bd09mc`（百度墨卡托）、`bd09ll`（百度经纬度，默认） |
| `sn` | string | 否 | 签名参数 |
| `output` | string | 否 | 输出格式：`json`、`xml` |
| `extension_analys_level` | string | 否 | 地址解析深度控制：`0`/`1` 或 `true`/`false` |

---

## 响应字段表

### 成功响应（status = 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，`0` 表示成功 |
| `result.location.lng` | number | 经度 |
| `result.location.lat` | number | 纬度 |
| `result.precise` | number | 定位精度：`1` = 精确，`0` = 模糊 |
| `result.confidence` | number | 坐标置信度（0-100） |
| `result.comprehension` | number | 地址理解程度（0-100） |
| `result.level` | string | 地址类型（门址、道路、商务大厦等） |

### 失败响应（status ≠ 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 错误码（非 0） |
| `message` | string | 错误描述（部分错误码有此字段） |

**响应示例：**

```json
{
  "status": 0,
  "result": {
    "location": {
      "lng": 116.3077394657582,
      "lat": 40.05694432054287
    },
    "precise": 0,
    "confidence": 75,
    "comprehension": 0,
    "level": "商务大厦"
  }
}
```

---

## 生成期代码（TypeScript）

```typescript
// 生成期直接调用地理编码接口
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface GeocodeResult {
  location: { lng: number; lat: number };
  precise: number;
  confidence: number;
  comprehension: number;
  level: string;
}

/**
 * 将结构化地址解析为地理坐标（地理编码）。
 * @param address - 待解析的地址，支持结构化地址或路口描述
 * @param city - 可选，地址所在城市，用于消歧
 * @param retCoordtype - 可选，返回坐标类型，默认 bd09ll
 * @returns 解析结果，含经纬度及置信度
 */
async function geocodeAddress(
  address: string,
  city?: string,
  retCoordtype = "bd09ll"
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ address, output: "json", ret_coordtype: retCoordtype });
  if (city) params.set("city", city);

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-GaDwZ0j3erOY-gateway.appmiaoda.com/geocoding/v3/?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`百度地图 API 错误，status: ${json.status}`);

  return json.result as GeocodeResult;
}

// 使用示例
const result = await geocodeAddress("百度大厦", "北京市");
console.log(`经度: ${result.location.lng}, 纬度: ${result.location.lat}`);
console.log(`置信度: ${result.confidence}, 地址类型: ${result.level}`);
```

---

## Edge Function 代码

### Web 平台（`edge-functions/geocoding.ts`）

```typescript
// edge-functions/geocoding.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let address: string;
  let city: string | undefined;
  let retCoordtype: string | undefined;

  try {
    const body = await req.json();
    address = body.address;
    city = body.city;
    retCoordtype = body.ret_coordtype;
    if (!address) throw new Error("Missing address");
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

  // --- 调用上游 ---
  const params = new URLSearchParams({ address, output: "json", ret_coordtype: retCoordtype ?? "bd09ll" });
  if (city) params.set("city", city);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-GaDwZ0j3erOY-gateway.appmiaoda.com/geocoding/v3/?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
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

### MiniProgram 平台

MiniProgram 端 Edge Function 与 Web 端**相同**（返回 JSON 数据，无二进制流），使用同一份 `edge-functions/geocoding.ts` 即可。

---

## 前端调用代码

### Web 平台（React/Vue）

```typescript
import { supabase } from "@/lib/supabase";

interface GeocodeResult {
  location: { lng: number; lat: number };
  precise: number;
  confidence: number;
  comprehension: number;
  level: string;
}

/**
 * 通过 Edge Function 调用地理编码接口，将地址解析为坐标。
 * @param address - 待解析的地址
 * @param city - 可选，所在城市
 * @returns 地理编码结果
 */
async function fetchGeocode(address: string, city?: string): Promise<GeocodeResult> {
  const { data, error } = await supabase.functions.invoke("geocoding", {
    body: { address, city },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`百度地图 API 错误，status: ${data.status}`);
  return data.result as GeocodeResult;
}

// 使用示例
const result = await fetchGeocode("百度大厦", "北京市");
console.log(result.location); // { lng: 116.307..., lat: 40.056... }
```

### MiniProgram 平台（Taro）

```typescript
import { supabase } from "@/lib/supabase";
import Taro from "@tarojs/taro";

interface GeocodeResult {
  location: { lng: number; lat: number };
  precise: number;
  confidence: number;
  comprehension: number;
  level: string;
}

/**
 * 获取当前用户位置并转换为所需坐标格式。
 * 注意：H5 端使用 wgs84，WeApp 端使用 gcj02。
 * @returns 用户当前坐标（gcj02 或 wgs84）
 */
async function getUserLocation(): Promise<{ latitude: number; longitude: number }> {
  // app.config.ts 须配置 requiredPrivateInfos: ["getLocation"]
  // 以及 permission.scope.userLocation.desc
  const type = Taro.getEnv() === Taro.ENV_TYPE.WEB ? "wgs84" : "gcj02";
  const location = await Taro.getLocation({ type });
  return { latitude: location.latitude, longitude: location.longitude };
}

/**
 * 通过 Edge Function 调用地理编码接口（MiniProgram Taro 端）。
 * @param address - 待解析的地址
 * @param city - 可选，所在城市
 * @returns 地理编码结果
 */
async function fetchGeocode(address: string, city?: string): Promise<GeocodeResult> {
  const { data, error } = await supabase.functions.invoke("geocoding", {
    body: { address, city },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`百度地图 API 错误，status: ${data.status}`);
  return data.result as GeocodeResult;
}

// Map 组件兼容性处理
// 若 Taro.getEnv() === Taro.ENV_TYPE.WEB，Map 组件在 H5 端不生效
// 需显示文本提示："由于兼容性问题，无法在当前页面中展示地图，请前往微信小程序测试与使用"
```

---

## 注意事项

- **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）。
- **计费**: 当前免费，但会统计调用次数，避免不必要的重复调用。
- **坐标类型**: 默认返回百度经纬度（`bd09ll`），如需与微信小程序 `Taro.openLocation` 配合使用，建议请求 `gcj02ll`（国测局坐标）。
- **精度**: `precise = 0` 表示模糊匹配，建议根据 `confidence` 值（0-100）判断结果可信度。
- **MiniProgram 位置权限**: 调用 `Taro.getLocation` 前须在 `app.config.ts` 中配置：
  ```json
  {
    "requiredPrivateInfos": ["getLocation"],
    "permission": {
      "scope.userLocation": {
        "desc": "您的位置信息将用于地图定位功能"
      }
    }
  }
  ```
