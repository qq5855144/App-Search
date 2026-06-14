# 未来8-15日天气预报 API（weather15d）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `50702c77-3813-482c-8815-c50ebdcfc741` |
| API ID | `api-oYA6ZGjReVpa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-oYA6ZGjReVpa-gateway.appmiaoda.com/lundear/weather15d` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | 无请求体（GET 请求，参数通过 Query String 传递） |
| Third-Part Domain | `app-cblk1rqa5fk1-api-oYA6ZGjReVpa-gateway.appmiaoda.com` |

---

## 请求参数表

地区定位参数**四选一**：`areaCode`、`areaCn`、`ip`、`lng + lat`。

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `areaCode` | string | 否 | 地区代码，示例：`110000` |
| `areaCn` | string | 否 | 城市级中文名称（如 `广州`、`杭州`、`北京`），不能传省份名（如"广东"会返回空数据） |
| `ip` | string | 否 | IP地址，示例：`220.181.111.232` |
| `lng` | string | 否 | 经度，示例：`116`（与 `lat` 配合使用） |
| `lat` | string | 否 | 纬度，示例：`40`（与 `lng` 配合使用） |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `desc` | string | 响应描述，成功时为 `"成功"` |
| `data.cityInfo.areaCn` | string | 地区名称 |
| `data.cityInfo.areaCode` | string | 地区代码 |
| `data.cityInfo.areaId` | string | 地区唯一 ID |
| `data.d8` | object | 第8天天气数据 |
| `data.d8.time` | string | 日期信息，如 `"周三（12日）"` |
| `data.d8.weather` | string | 天气状况，如 `"晴转多云"` |
| `data.d8.temperature_max` | string | 最高温度（℃） |
| `data.d8.temperature_min` | string | 最低温度（℃） |
| `data.d8.wind` | string | 风向，如 `"北风转西南风"` |
| `data.d8.wind_pow` | string | 风力等级，如 `"3-4级转<3级"` |
| `data.d8.day_weather_pic` | string? | 白天天气图标标识 |
| `data.d8.night_weather_pic` | string? | 夜间天气图标标识 |
| `data.d9` ~ `data.d15` | object | 第9天到第15天天气数据，结构同 `d8` |

### 失败响应

| 情况 | HTTP 状态码 | 说明 |
|------|-------------|------|
| 配额超限 | 429 | Edge Function 原样透传错误体 |
| 余额不足 | 402 | Edge Function 原样透传错误体 |
| 上游错误 | 502 | Edge Function 返回 `{ error: "Upstream error: <status>" }` |

---

## 生成期代码

```typescript
// 生成期直接调用（Deno 脚本）
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface FutureDayWeather {
  time: string;
  weather: string;
  temperature_max: string;
  temperature_min: string;
  wind: string;
  wind_pow: string;
  day_weather_pic?: string;
  night_weather_pic?: string;
}

interface Weather15dResult {
  cityInfo: { areaCn: string; areaCode: string; areaId: string };
  d8: FutureDayWeather;
  d9: FutureDayWeather;
  d10: FutureDayWeather;
  d11: FutureDayWeather;
  d12: FutureDayWeather;
  d13: FutureDayWeather;
  d14: FutureDayWeather;
  d15: FutureDayWeather;
}

/**
 * 查询未来第8日到第15日的天气预报。
 * @param params - 定位参数（四选一：areaCode / areaCn / ip / lng+lat）
 * @returns 未来8-15日天气数据
 */
async function getWeather15d(params: {
  areaCode?: string;
  areaCn?: string;
  ip?: string;
  lng?: string;
  lat?: string;
}): Promise<Weather15dResult> {
  const url = new URL("https://app-cblk1rqa5fk1-api-oYA6ZGjReVpa-gateway.appmiaoda.com/lundear/weather15d");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  return json.data as Weather15dResult;
}

// 示例：查询广州未来8-15日天气
const result = await getWeather15d({ areaCn: "广州" });
console.log(result.d8, result.d15);
```

---

## Edge Function 代码

```typescript
// edge-functions/weather-15d.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let areaCode: string | undefined;
  let areaCn: string | undefined;
  let ip: string | undefined;
  let lng: string | undefined;
  let lat: string | undefined;

  try {
    const body = await req.json();
    areaCode = body.areaCode;
    areaCn = body.areaCn;
    ip = body.ip;
    lng = body.lng;
    lat = body.lat;

    const hasLocation = areaCode || areaCn || ip || (lng && lat);
    if (!hasLocation) throw new Error("Missing location parameter");
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

  // --- 调用上游接口 ---
  const upstreamUrl = new URL("https://app-cblk1rqa5fk1-api-oYA6ZGjReVpa-gateway.appmiaoda.com/lundear/weather15d");
  const paramMap: Record<string, string | undefined> = { areaCode, areaCn, ip, lng, lat };
  for (const [key, value] of Object.entries(paramMap)) {
    if (value !== undefined) upstreamUrl.searchParams.set(key, value);
  }

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers: {
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

---

## 前端调用代码

### Web 平台

```typescript
/**
 * 调用 weather-15d Edge Function 查询未来8-15日天气预报。
 * @param params - 定位参数
 * @returns 未来8-15日天气数据
 */
async function fetchWeather15d(params: {
  areaCode?: string;
  areaCn?: string;
  ip?: string;
  lng?: string;
  lat?: string;
}) {
  const { data, error } = await supabase.functions.invoke("weather-15d", {
    body: params,
  });
  if (error) throw error;
  return data;
}
```

### MiniProgram 平台

MiniProgram 若需要通过坐标定位，需在 `app.config.ts` 中配置位置权限：

```json
{
  "requiredPrivateInfos": [
    "getLocation",
    "onLocationChange",
    "startLocationUpdateBackground",
    "chooseAddress"
  ],
  "permission": {
    "scope.userLocation": {
      "desc": "你的位置信息将用于查询当地未来天气预报"
    }
  }
}
```

调用 `Taro.getLocation` 时需判断运行环境：

```typescript
import Taro from "@tarojs/taro";

/**
 * 获取当前位置坐标并查询未来8-15日天气预报。
 * @returns 未来8-15日天气数据
 */
async function fetchWeather15dByLocation() {
  const locationType = Taro.getEnv() === Taro.ENV_TYPE.WEB ? "wgs84" : "gcj02";
  const location = await Taro.getLocation({ type: locationType });

  const { data, error } = await supabase.functions.invoke("weather-15d", {
    body: { lng: String(location.longitude), lat: String(location.latitude) },
  });
  if (error) throw error;
  return data;
}
```

> 重要：确保 `useCallback`、`useEffect` 等 Hook 的依赖项不会因自身更新状态而引发无限循环或重复渲染。

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误。
- **计费**：该接口每次调用计费，折扣价 ¥0.03 / 次，原价 ¥0.10 / 次，避免不必要的重复调用。
- **定位参数**：`areaCode`、`areaCn`、`ip`、`lng + lat` 四选一，至少传其中一组。
- **数据范围**：返回 d8 到 d15 共8天的逐日天气数据，为长期预报，精度低于短期预报。
- **与 weather7d 配合**：完整15天预报需结合 `weather7d`（d1-d7）和本接口（d8-d15）。
