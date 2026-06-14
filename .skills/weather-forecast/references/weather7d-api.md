# 未来7日天气预报 API（weather7d）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `50702c77-3813-482c-8815-c50ebdcfc741` |
| API ID | `api-rY7JZ6jqrV6L` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-rY7JZ6jqrV6L-gateway.appmiaoda.com/lundear/weather7d` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | 无请求体（GET 请求，参数通过 Query String 传递） |
| Third-Part Domain | `app-cblk1rqa5fk1-api-rY7JZ6jqrV6L-gateway.appmiaoda.com` |

---

## 请求参数表

地区定位参数**四选一**：`areaCode`、`areaCn`、`ip`、`lng + lat`。

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `areaCode` | string | 否 | 地区代码，如 `110000` |
| `areaCn` | string | 否 | 城市级中文名称（如 `广州`、`杭州`、`北京`），不能传省份名（如"广东"会返回空数据） |
| `ip` | string | 否 | IP地址，如 `220.181.111.232` |
| `lng` | string | 否 | 经度，如 `116`（与 `lat` 配合使用） |
| `lat` | string | 否 | 纬度，如 `40`（与 `lng` 配合使用） |
| `needalarm` | string | 否 | 是否需要天气预警，`1`: 需要，`0`: 不需要 |
| `need3hour` | string | 否 | 是否需要3小时段天气预报，`1`: 需要，`0`: 不需要 |
| `needIndex` | string | 否 | 是否需要生活指数数据，`1`: 需要，`0`: 不需要 |
| `needObserve` | string | 否 | 是否需要24小时天气指数，`1`: 需要，`0`: 不需要 |
| `need1hour` | string | 否 | 是否需要1小时段天气预报，`1`: 需要，`0`: 不需要 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `desc` | string | 响应描述，成功时为 `"成功"` |
| `data.cityInfo.areaCn` | string | 地区名称 |
| `data.cityInfo.areaCode` | string | 地区代码 |
| `data.cityInfo.cityCn` | string | 城市名称 |
| `data.cityInfo.provCn` | string | 省份名称 |
| `data.d1` | object | 第1天天气数据（今天） |
| `data.d1.time` | string | 日期描述，如 `"5日（今天）"` |
| `data.d1.weather` | string | 天气状况，如 `"多云转晴"` |
| `data.d1.temperature_max` | string | 最高温度（℃） |
| `data.d1.temperature_min` | string | 最低温度（℃） |
| `data.d1.wind_day` | string | 白天风向 |
| `data.d1.wind_night` | string | 夜间风向 |
| `data.d1.wind_pow` | string | 风力等级 |
| `data.d1.day_weather_pic` | string | 白天天气图标序号 |
| `data.d1.night_weather_pic` | string | 夜间天气图标序号 |
| `data.d1.hour3data` | array? | 3小时段预报数据（`need3hour=1` 时返回） |
| `data.d1.hour1data` | array? | 1小时段预报数据（`need1hour=1` 时返回） |
| `data.d1.lifeIndex` | object? | 生活指数（`needIndex=1` 时返回） |
| `data.d2` ~ `data.d7` | object | 第2天到第7天天气数据，结构同 `d1` |

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

interface DayWeather {
  time: string;
  weather: string;
  temperature_max: string;
  temperature_min: string;
  wind_day: string;
  wind_night: string;
  wind_pow: string;
  day_weather_pic: string;
  night_weather_pic: string;
  hour3data?: unknown[];
  hour1data?: unknown[];
  lifeIndex?: Record<string, { state: string; reply: string }>;
}

interface Weather7dResult {
  cityInfo: { areaCn: string; areaCode: string; cityCn: string; provCn: string };
  d1: DayWeather;
  d2: DayWeather;
  d3: DayWeather;
  d4: DayWeather;
  d5: DayWeather;
  d6: DayWeather;
  d7: DayWeather;
}

/**
 * 查询未来7日天气预报。
 * @param params - 定位参数（四选一：areaCode / areaCn / ip / lng+lat）及可选参数
 * @returns 未来7日天气数据
 */
async function getWeather7d(params: {
  areaCode?: string;
  areaCn?: string;
  ip?: string;
  lng?: string;
  lat?: string;
  needalarm?: "0" | "1";
  need3hour?: "0" | "1";
  needIndex?: "0" | "1";
  needObserve?: "0" | "1";
  need1hour?: "0" | "1";
}): Promise<Weather7dResult> {
  const url = new URL("https://app-cblk1rqa5fk1-api-rY7JZ6jqrV6L-gateway.appmiaoda.com/lundear/weather7d");
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
  return json.data as Weather7dResult;
}

// 示例：查询北京未来7日天气
const result = await getWeather7d({ areaCn: "广州" });
console.log(result.d1, result.d2, result.d3);
```

---

## Edge Function 代码

```typescript
// edge-functions/weather-7d.ts
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
  let needalarm: string | undefined;
  let need3hour: string | undefined;
  let needIndex: string | undefined;
  let needObserve: string | undefined;
  let need1hour: string | undefined;

  try {
    const body = await req.json();
    areaCode = body.areaCode;
    areaCn = body.areaCn;
    ip = body.ip;
    lng = body.lng;
    lat = body.lat;
    needalarm = body.needalarm;
    need3hour = body.need3hour;
    needIndex = body.needIndex;
    needObserve = body.needObserve;
    need1hour = body.need1hour;

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
  const upstreamUrl = new URL("https://app-cblk1rqa5fk1-api-rY7JZ6jqrV6L-gateway.appmiaoda.com/lundear/weather7d");
  const paramMap: Record<string, string | undefined> = {
    areaCode, areaCn, ip, lng, lat,
    needalarm, need3hour, needIndex, needObserve, need1hour,
  };
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
 * 调用 weather-7d Edge Function 查询未来7日天气预报。
 * @param params - 定位参数及可选参数
 * @returns 未来7日天气数据
 */
async function fetchWeather7d(params: {
  areaCode?: string;
  areaCn?: string;
  ip?: string;
  lng?: string;
  lat?: string;
  needalarm?: "0" | "1";
  need3hour?: "0" | "1";
  needIndex?: "0" | "1";
  needObserve?: "0" | "1";
  need1hour?: "0" | "1";
}) {
  const { data, error } = await supabase.functions.invoke("weather-7d", {
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
      "desc": "你的位置信息将用于查询当地未来7日天气预报"
    }
  }
}
```

调用 `Taro.getLocation` 时需判断运行环境：

```typescript
import Taro from "@tarojs/taro";

/**
 * 获取当前位置坐标并查询未来7日天气预报。
 * @returns 未来7日天气数据
 */
async function fetchWeather7dByLocation() {
  const locationType = Taro.getEnv() === Taro.ENV_TYPE.WEB ? "wgs84" : "gcj02";
  const location = await Taro.getLocation({ type: locationType });

  const { data, error } = await supabase.functions.invoke("weather-7d", {
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
- **可选数据**：`lifeIndex`、`hour1data`、`hour3data`、`observe24h`、`alarmList`
  均需通过对应的 `needXxx=1` 参数显式请求，否则不返回。
- **数据范围**：返回 d1（今天）到 d7 共7天的逐日天气数据。
