# 今日实时天气 API（weather1d）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `50702c77-3813-482c-8815-c50ebdcfc741` |
| API ID | `api-Aa2PZnjEVgyL` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-Aa2PZnjEVgyL-gateway.appmiaoda.com/lundear/weather1d` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | 无请求体（GET 请求，参数通过 Query String 传递） |
| Third-Part Domain | `app-cblk1rqa5fk1-api-Aa2PZnjEVgyL-gateway.appmiaoda.com` |

---

## 请求参数表

地区定位参数**四选一**：`areaCode`、`areaCn`、`ip`、`lng + lat`。

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `areaCode` | string | 否 | 地区code，如 `110000` |
| `areaCn` | string | 否 | 城市级中文名称（如 `广州`、`杭州`、`北京`），不能传省份名（如"广东"会返回空数据） |
| `ip` | string | 否 | IP地址，如 `220.181.111.232` |
| `lng` | string | 否 | 经度（与 `lat` 配合使用） |
| `lat` | string | 否 | 纬度（与 `lng` 配合使用） |
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
| `data.now.temp` | string | 实时温度（℃） |
| `data.now.weather` | string | 天气状况，如 `"晴"` |
| `data.now.WD` | string | 风向，如 `"西南风"` |
| `data.now.WS` | string | 风力等级，如 `"2级"` |
| `data.now.SD` | string | 相对湿度（%） |
| `data.now.aqi` | string | 空气质量指数 |
| `data.day.weather` | string | 白天天气状况 |
| `data.day.temperature` | string | 白天最高温度（℃） |
| `data.day.wind` | string | 白天风向 |
| `data.day.wind_pow` | string | 白天风力 |
| `data.night.weather` | string | 夜间天气状况 |
| `data.night.temperature` | string | 夜间最低温度（℃） |
| `data.night.wind` | string | 夜间风向 |
| `data.night.wind_pow` | string | 夜间风力 |
| `data.lifeIndex` | object? | 生活指数（`needIndex=1` 时返回），键为指数名称，值含 `state` 和 `reply` |
| `data.hour1data` | array? | 1小时段天气预报数组（`need1hour=1` 时返回） |
| `data.hour3data` | array? | 3小时段天气预报数组（`need3hour=1` 时返回） |
| `data.observe24h` | array? | 24小时天气观测数据（`needObserve=1` 时返回） |
| `data.alarmList` | array? | 天气预警信息数组（`needalarm=1` 时返回） |

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

interface Weather1dResult {
  cityInfo: { areaCn: string; areaCode: string; cityCn: string };
  now: { temp: string; weather: string; WD: string; WS: string; SD: string; aqi: string };
  day: { weather: string; temperature: string; wind: string; wind_pow: string };
  night: { weather: string; temperature: string; wind: string; wind_pow: string };
  lifeIndex?: Record<string, { state: string; reply: string }>;
  hour1data?: unknown[];
  hour3data?: unknown[];
  observe24h?: unknown[];
  alarmList?: unknown[];
}

/**
 * 查询今日实时天气及当天预报。
 * @param params - 定位参数（四选一：areaCode / areaCn / ip / lng+lat）及可选参数
 * @returns 今日天气数据
 */
async function getWeather1d(params: {
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
}): Promise<Weather1dResult> {
  const url = new URL("https://app-cblk1rqa5fk1-api-Aa2PZnjEVgyL-gateway.appmiaoda.com/lundear/weather1d");
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
  return json.data as Weather1dResult;
}

// 示例：查询广州今日天气（含生活指数）
const result = await getWeather1d({ areaCn: "广州", needIndex: "1" });
console.log(result.now);
```

---

## Edge Function 代码

```typescript
// edge-functions/weather-1d.ts
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
  const upstreamUrl = new URL("https://app-cblk1rqa5fk1-api-Aa2PZnjEVgyL-gateway.appmiaoda.com/lundear/weather1d");
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
 * 调用 weather-1d Edge Function 查询今日天气。
 * @param params - 定位参数及可选参数
 * @returns 今日天气数据
 */
async function fetchWeather1d(params: {
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
  const { data, error } = await supabase.functions.invoke("weather-1d", {
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
      "desc": "你的位置信息将用于查询当地天气"
    }
  }
}
```

调用 `Taro.getLocation` 时需判断运行环境：

```typescript
import Taro from "@tarojs/taro";

/**
 * 获取当前位置坐标并查询今日天气。
 * @returns 今日天气数据
 */
async function fetchWeather1dByLocation() {
  const locationType = Taro.getEnv() === Taro.ENV_TYPE.WEB ? "wgs84" : "gcj02";
  const location = await Taro.getLocation({ type: locationType });

  const { data, error } = await supabase.functions.invoke("weather-1d", {
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
- **定位参数**：`areaCode`、`areaCn`、`ip`、`lng + lat` 四选一，均为可选，但至少传一个。
- **可选数据**：`lifeIndex`、`hour1data`、`hour3data`、`observe24h`、`alarmList`
  均需通过对应的 `needXxx=1` 参数显式请求，否则不返回。
