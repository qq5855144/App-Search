# 国内经纬度天气查询 API — location-weather

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `c31c0491-e8f7-444e-9f67-5ee93c952030` |
| API ID | `api-GYX1bnRz2Pxa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-GYX1bnRz2Pxa-gateway.appmiaoda.com/weather/v1/` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | Query Parameters（GET 请求，无请求体） |
| Third-party Domain | `app-cblk1rqa5fk1-api-GYX1bnRz2Pxa-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `location` | string | 是 | 经纬度坐标，**格式：纬度,经度**（如 `39.915,116.404`），注意纬度在前、经度在后 |
| `data_type` | string | 否 | 数据类型，可选值：`all`（全部数据）、`now`（实时天气）、`forecast`（天气预报）、`hourly`（逐小时预报） |

---

## 响应字段表

### 成功响应（HTTP 200，status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，`0` 表示成功 |
| `result` | object | 天气数据结果 |
| `result.location` | object | 位置信息（国家、省份、城市、区域名称等） |
| `result.now` | object | 实时天气数据（温度、体感温度、湿度、风力、风向、天气现象等） |
| `result.forecasts` | array | 未来7天逐日天气预报数组 |
| `result.hourly` | array | 未来24小时逐小时天气预报数组 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 非 0 的错误状态码 |
| `message` | string | 错误信息描述 |

---

## 生成期代码（TypeScript）

```typescript
// platform_managed：密钥由平台注入，直接从环境变量读取
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface WeatherLocation {
  country: string;
  province: string;
  city: string;
  name: string;
  id: string;
}

interface WeatherNow {
  text: string;        // 天气现象
  temp: number;        // 温度（℃）
  feels_like: number;  // 体感温度（℃）
  rh: number;          // 相对湿度（%）
  wind_class: string;  // 风力等级
  wind_dir: string;    // 风向
  uptime: string;      // 数据更新时间
}

interface WeatherForecast {
  date: string;        // 日期（YYYY-MM-DD）
  week: string;        // 星期
  high: number;        // 最高温度（℃）
  low: number;         // 最低温度（℃）
  wc_day: string;      // 白天风力等级
  wd_day: string;      // 白天风向
  wc_night: string;    // 夜间风力等级
  wd_night: string;    // 夜间风向
  text_day: string;    // 白天天气现象
  text_night: string;  // 夜间天气现象
}

interface WeatherHourly {
  time: string;        // 时间（ISO 8601）
  text: string;        // 天气现象
  temp: number;        // 温度（℃）
  wind_class: string;  // 风力等级
  wind_dir: string;    // 风向
  rh: number;          // 相对湿度（%）
  prec: number;        // 降水量（mm）
}

interface WeatherResult {
  location: WeatherLocation;
  now: WeatherNow;
  forecasts: WeatherForecast[];
  hourly: WeatherHourly[];
}

/**
 * 通过经纬度查询国内指定位置的天气信息，包含实时天气、7天预报和24小时逐小时预报。
 * @param latitude - 纬度，如 39.915
 * @param longitude - 经度，如 116.404
 * @param dataType - 数据类型：all | now | forecast | hourly，默认 "all"
 * @returns 天气数据结果，包含实时天气、7天预报和24小时逐小时预报
 */
async function getWeatherByLocation(
  latitude: number,
  longitude: number,
  dataType = "all"
): Promise<WeatherResult> {
  const url = new URL("https://app-cblk1rqa5fk1-api-GYX1bnRz2Pxa-gateway.appmiaoda.com/weather/v1/");
  // 注意：百度地图 API location 参数格式为 纬度,经度
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("data_type", dataType);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error status: ${json.status}, message: ${json.message ?? ""}`);

  return json.result as WeatherResult;
}

// 示例调用（北京天安门广场）
const result = await getWeatherByLocation(39.91489, 116.40387, "all");
console.log("当前天气：", result.now.text, result.now.temp, "℃");
console.log("24小时预报条数：", result.hourly.length);
console.log("未来7天：", result.forecasts.map((f) => `${f.date} ${f.text_day}`).join(", "));
```

---

## Edge Function 代码

```typescript
// edge-functions/location-weather.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let latitude: number;
  let longitude: number;
  let dataType: string;
  try {
    const body = await req.json();
    // 支持两种传参方式：
    // 1. 分别传 latitude + longitude（推荐）
    // 2. 直接传 location 字符串（格式：纬度,经度）
    if (body.location) {
      const parts = String(body.location).split(",");
      latitude = parseFloat(parts[0]);
      longitude = parseFloat(parts[1]);
    } else {
      latitude = body.latitude;
      longitude = body.longitude;
    }
    dataType = body.data_type ?? "all";
    if (isNaN(latitude) || isNaN(longitude)) throw new Error("Missing or invalid latitude/longitude");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  // 注意：location 格式为 纬度,经度
  const url = new URL("https://app-cblk1rqa5fk1-api-GYX1bnRz2Pxa-gateway.appmiaoda.com/weather/v1/");
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("data_type", dataType);

  const upstream = await fetch(url.toString(), {
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

### Web 平台（推荐：supabase client + Geolocation API）

```typescript
/**
 * 获取用户当前位置并查询天气（Web 平台）。
 * @param dataType - 数据类型：all | now | forecast | hourly，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByCurrentLocation(dataType = "all") {
  // 获取浏览器地理位置
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });

  const { latitude, longitude } = position.coords;

  const { data, error } = await supabase.functions.invoke("location-weather", {
    body: { latitude, longitude, data_type: dataType },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status: ${data.status}`);
  return data.result;
}

/**
 * 通过指定经纬度查询天气（Web 平台）。
 * @param latitude - 纬度
 * @param longitude - 经度
 * @param dataType - 数据类型：all | now | forecast | hourly，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByLocation(latitude: number, longitude: number, dataType = "all") {
  const { data, error } = await supabase.functions.invoke("location-weather", {
    body: { latitude, longitude, data_type: dataType },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status: ${data.status}`);
  return data.result;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 获取用户当前位置并查询天气（MiniProgram / Taro 平台）。
 * @param dataType - 数据类型：all | now | forecast | hourly，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByCurrentLocation(dataType = "all") {
  // 使用 Taro 获取地理位置（需在 app.config.ts 中配置 permission.scope.userLocation）
  const locationResult = await Taro.getLocation({ type: "wgs84" });
  const { latitude, longitude } = locationResult;

  const { data, error } = await supabase.functions.invoke("location-weather", {
    body: { latitude, longitude, data_type: dataType },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status: ${data.status}`);
  return data.result;
}
```

**MiniProgram 位置权限配置**（`app.config.ts`）：

```typescript
// app.config.ts
export default {
  // ...其他配置
  permission: {
    "scope.userLocation": {
      desc: "您的位置信息将用于查询当前位置的天气",
    },
  },
  requiredPrivateInfos: ["getLocation"],
};
```

### 备用方式（无 supabase client）

```typescript
/**
 * 通过经纬度查询天气（无 supabase client 的备用方案）。
 * @param latitude - 纬度
 * @param longitude - 经度
 * @param dataType - 数据类型：all | now | forecast | hourly，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByLocation(latitude: number, longitude: number, dataType = "all") {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/location-weather`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, data_type: dataType }),
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
  if (json.status !== 0) throw new Error(`API 错误 status: ${json.status}`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端代码或客户端日志中。
- **错误处理**：务必处理 HTTP 429（配额超限）和 402（余额不足）两类错误，并给用户友好提示。
- **计费**：该接口启用计费，原价 ¥1.20 / 千次，折扣价 ¥0.75 / 千次（`discount_price: 0.75`）。避免在循环或高频场景中不必要地重复调用。
- **坐标格式**：`location` 参数格式为 `纬度,经度`（latitude first），与常见 GeoJSON 的 `[longitude, latitude]` 顺序相反，务必注意。例如北京天安门：`39.91489,116.40387`。
- **MiniProgram 位置权限**：使用 `Taro.getLocation()` 前需在 `app.config.ts` 中配置 `permission.scope.userLocation`，否则小程序无法获取用户位置。
- **hourly 字段**：仅当 `data_type` 为 `all` 或 `hourly` 时，响应中才包含 `hourly`（24小时逐小时预报）字段；`district_id` 接口不支持此字段，该字段是经纬度接口独有的能力。
- **data_type 参数**：默认不传时建议传 `all`，可在一次请求中获取实时天气 + 7天预报 + 24小时预报，避免多次调用增加成本。
