# 国内天气查询 API — district-weather

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `c31c0491-e8f7-444e-9f67-5ee93c952030` |
| API ID | `api-oLpZbd8ed8wa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com/weather/v1/` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | Query Parameters（GET 请求，无请求体） |
| Third-party Domain | `app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `district_id` | string | 是 | 行政区划代码，用于指定查询的城市或地区，如 `110100`（北京市） |
| `data_type` | string | 否 | 数据类型，可选值：`all`（全部数据）、`now`（实时天气）、`forecast`（天气预报），默认返回全部 |

---

## 响应字段表

### 成功响应（HTTP 200，status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，`0` 表示成功 |
| `result` | object | 天气数据结果 |
| `result.location` | object | 位置信息 |
| `result.now` | object | 实时天气数据 |
| `result.forecasts` | array | 未来7天天气预报数组 |

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

interface WeatherResult {
  location: WeatherLocation;
  now: WeatherNow;
  forecasts: WeatherForecast[];
}

/**
 * 通过行政区划代码查询国内城市天气信息。
 * @param districtId - 行政区划代码，如 "110100"（北京市）
 * @param dataType - 数据类型：all | now | forecast，默认 "all"
 * @returns 天气数据结果，包含实时天气和预报
 */
async function getWeatherByDistrict(
  districtId: string,
  dataType = "all"
): Promise<WeatherResult> {
  const url = new URL("https://app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com/weather/v1/");
  url.searchParams.set("district_id", districtId);
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

// 示例调用
const result = await getWeatherByDistrict("110100", "all");
console.log("当前天气：", result.now.text, result.now.temp, "℃");
console.log("未来7天：", result.forecasts.map((f) => `${f.date} ${f.text_day}`).join(", "));
```

---

## Edge Function 代码

```typescript
// edge-functions/district-weather.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let districtId: string;
  let dataType: string;
  try {
    const body = await req.json();
    districtId = body.district_id;
    dataType = body.data_type ?? "all";
    if (!districtId) throw new Error("Missing district_id");
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
  const url = new URL("https://app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com/weather/v1/");
  url.searchParams.set("district_id", districtId);
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

### Web 平台（推荐：supabase client）

```typescript
/**
 * 通过行政区划代码查询天气（Web 平台）。
 * @param districtId - 行政区划代码，如 "110100"
 * @param dataType - 数据类型：all | now | forecast，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByDistrict(districtId: string, dataType = "all") {
  const { data, error } = await supabase.functions.invoke("district-weather", {
    body: { district_id: districtId, data_type: dataType },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status: ${data.status}`);
  return data.result;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 通过行政区划代码查询天气（MiniProgram 平台）。
 * @param districtId - 行政区划代码，如 "110100"
 * @param dataType - 数据类型：all | now | forecast，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByDistrict(districtId: string, dataType = "all") {
  const { data, error } = await supabase.functions.invoke("district-weather", {
    body: { district_id: districtId, data_type: dataType },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status: ${data.status}`);
  return data.result;
}
```

### 备用方式（无 supabase client）

```typescript
/**
 * 通过行政区划代码查询天气（无 supabase client 的备用方案）。
 * @param districtId - 行政区划代码，如 "110100"
 * @param dataType - 数据类型：all | now | forecast，默认 "all"
 * @returns 天气结果对象
 */
async function fetchWeatherByDistrict(districtId: string, dataType = "all") {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/district-weather`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ district_id: districtId, data_type: dataType }),
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
- **行政区划代码**：需传入标准的百度行政区划代码（district_id），可参考百度地图 API 文档获取各城市代码，如北京市 `110100`、上海市 `310100`。
- **data_type 参数**：默认不传时建议传 `all`，可减少多次调用；若仅需实时天气可传 `now` 以节省带宽。
