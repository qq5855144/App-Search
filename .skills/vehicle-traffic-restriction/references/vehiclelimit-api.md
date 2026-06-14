# vehiclelimit API 完整规格

## API 基本信息

| 字段 | 接口 A：城市限行查询 | 接口 B：获取城市列表 |
|------|---------------------|---------------------|
| Plugin ID | `0c292e3d-8340-44d0-8c7c-e2ce2f534161` | 同左 |
| API ID | `api-pLVzAxRQyMWL` | `api-DYJwnJVBwb4a` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-pLVzAxRQyMWL-gateway.appmiaoda.com/vehiclelimit/query` | `POST https://app-cblk1rqa5fk1-api-DYJwnJVBwb4a-gateway.appmiaoda.com/vehiclelimit/city` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` | 同左 |
| Content-Type | `application/json;charset=UTF-8` | `application/json;charset=UTF-8` |
| third_part_domain | `app-cblk1rqa5fk1-api-pLVzAxRQyMWL-gateway.appmiaoda.com` | 同左 |
| 计费 | 是（¥0.85/千次，原价 ¥1.10/千次） | 否 |

---

## 接口 A：城市限行查询

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `city` | string | 是 | — | 城市代号，如：`beijing`、`hangzhou`、`chengdu` 等 |
| `date` | string | 是 | 今天 | 查询日期，格式 `YYYY-MM-DD`，如：`2015-12-02` |

### 响应字段说明

**成功响应（status: 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，`0` 表示成功 |
| `msg` | string | 返回消息，成功时为 `"ok"` |
| `result.city` | string | 城市代号（拼音） |
| `result.cityname` | string | 城市中文名称 |
| `result.date` | string | 查询日期，格式 `YYYY-MM-DD` |
| `result.week` | string | 星期几，如 `"星期四"` |
| `result.time` | array\<string\> | 限行时间段列表，如 `["07:00-09:00", "16:30-18:30"]` |
| `result.area` | string | 限行区域描述 |
| `result.summary` | string | 限行规则摘要 |
| `result.numberrule` | string | 尾号判定规则，如 `"最后一位数字"` |
| `result.number` | string | 当日限行尾号，如 `"4和6"` |

**失败响应（status != 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 非零错误码 |
| `msg` | string | 错误描述 |

---

## 接口 B：获取支持限行查询的城市列表

### 请求参数

无需参数。

### 响应字段说明

**成功响应（status: 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，`0` 表示成功 |
| `msg` | string | 返回消息，成功时为 `"ok"` |
| `result` | array\<object\> | 城市列表 |
| `result[].city` | string | 城市代号（拼音），如 `"beijing"` |
| `result[].cityname` | string | 城市中文名称，如 `"北京"` |

**响应示例：**
```json
{
  "status": 0,
  "msg": "ok",
  "result": [
    {"city": "beijing", "cityname": "北京"},
    {"city": "tianjin", "cityname": "天津"},
    {"city": "hangzhou", "cityname": "杭州"},
    {"city": "chengdu", "cityname": "成都"},
    {"city": "lanzhou", "cityname": "兰州"},
    {"city": "guiyang", "cityname": "贵阳"},
    {"city": "nanchang", "cityname": "南昌"},
    {"city": "changchun", "cityname": "长春"},
    {"city": "haerbin", "cityname": "哈尔滨"},
    {"city": "wuhan", "cityname": "武汉"},
    {"city": "shanghai", "cityname": "上海"},
    {"city": "shenzhen", "cityname": "深圳"}
  ]
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/** 查询指定城市在特定日期的限行规则 */
async function queryVehicleLimit(city: string, date: string): Promise<{
  city: string;
  cityname: string;
  date: string;
  week: string;
  time: string[];
  area: string;
  summary: string;
  numberrule: string;
  number: string;
}> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-pLVzAxRQyMWL-gateway.appmiaoda.com/vehiclelimit/query"
  );
  url.searchParams.set("city", city);
  url.searchParams.set("date", date);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.msg}`);

  return json.result;
}

/** 获取所有支持限行查询的城市列表 */
async function getVehicleLimitCities(): Promise<Array<{city: string; cityname: string}>> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DYJwnJVBwb4a-gateway.appmiaoda.com/vehiclelimit/city",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.msg}`);

  return json.result;
}

// 示例用法
const cities = await getVehicleLimitCities();
console.log("支持的城市：", cities.map((c) => c.cityname).join("、"));

const limit = await queryVehicleLimit("hangzhou", "2015-12-03");
console.log(`${limit.cityname} ${limit.date}（${limit.week}）限行尾号：${limit.number}`);
console.log(`限行时段：${limit.time.join("、")}`);
console.log(`限行区域：${limit.area}`);
```

---

## Edge Function 代码

### vehiclelimit-query（城市限行查询）

```typescript
// edge-functions/vehiclelimit-query.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let city: string;
  let date: string;
  try {
    const body = await req.json();
    city = body.city;
    date = body.date;
    if (!city) throw new Error("Missing city");
    if (!date) throw new Error("Missing date");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-pLVzAxRQyMWL-gateway.appmiaoda.com/vehiclelimit/query"
  );
  url.searchParams.set("city", city);
  url.searchParams.set("date", date);

  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
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

### vehiclelimit-city（获取城市列表）

```typescript
// edge-functions/vehiclelimit-city.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DYJwnJVBwb4a-gateway.appmiaoda.com/vehiclelimit/city",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
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

## 前端调用代码（Web & MiniProgram 通用）

两个接口均返回 JSON，Web 和 MiniProgram 可统一使用 `supabase.functions.invoke`。

### 查询城市限行规则

```typescript
/**
 * 查询指定城市在特定日期的限行规则。
 * @param city - 城市代号，如 "beijing"、"hangzhou"
 * @param date - 日期，格式 "YYYY-MM-DD"
 * @returns 限行详情对象
 */
async function fetchVehicleLimit(city: string, date: string) {
  const { data, error } = await supabase.functions.invoke("vehiclelimit-query", {
    body: { city, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.msg}`);
  return data.result;
}

// 使用示例
const limit = await fetchVehicleLimit("beijing", "2026-04-27");
console.log(`今日限行尾号：${limit.number}，限行时段：${limit.time.join("、")}`);
```

### 获取支持限行查询的城市列表

```typescript
/**
 * 获取所有支持车辆限行查询的城市列表。
 * @returns 城市列表，每项包含 city（代号）和 cityname（中文名）
 */
async function fetchVehicleLimitCities() {
  const { data, error } = await supabase.functions.invoke("vehiclelimit-city", {
    body: {},
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.msg}`);
  return data.result as Array<{ city: string; cityname: string }>;
}

// 使用示例
const cities = await fetchVehicleLimitCities();
const options = cities.map((c) => ({ value: c.city, label: c.cityname }));
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchVehicleLimit(city: string, date: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vehiclelimit-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, date }),
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
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}：${json.msg}`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全：** `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理：** 务必处理 429（配额超限）和 402（余额不足），这两种错误由 Edge Function 原文透传。
- **计费：** 城市限行查询（`vehiclelimit/query`）按调用次数计费，折后单价 **¥0.85/千次**（原价 ¥1.10/千次）。
  获取城市列表（`vehiclelimit/city`）不计费，建议应用启动时缓存结果，避免频繁重复调用。
- **城市代号：** 请求前可先调用 `vehiclelimit/city` 获取合法代号列表，避免因城市代号错误导致查询失败。
- **日期格式：** `date` 参数格式必须为 `YYYY-MM-DD`，如 `2026-04-27`。若不传则默认为今天（由上游 API 决定）。
- **数据时效：** 限行政策可能随政策调整而变化，建议每次使用前实时查询，不要长期缓存限行规则结果。
