# 站站查询 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `c5210d89-bd58-4f98-b24c-06f95635df18` |
| API ID | `api-V9PworyO6gEa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-V9PworyO6gEa-gateway.appmiaoda.com/train/station2s` |
| 认证方式 | platform_managed（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json;charset=UTF-8` |
| Third-party Domain | `app-cblk1rqa5fk1-api-V9PworyO6gEa-gateway.appmiaoda.com` |

---

## 请求参数

参数通过 Query String 传递，Body 为空。

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `start` | string | 是 | `杭州东` | 出发站名称 |
| `end` | string | 是 | `北京南` | 到达站名称 |
| `ishigh` | string | 否 | `1` | 是否只查高铁/动车，传 `"1"` 表示只查高铁动车 |
| `date` | string | 否 | `2024-01-01` | 查询日期，格式 `YYYY-MM-DD` |

---

## 响应字段说明

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，`0` 表示成功 |
| `msg` | string | 返回消息，成功时为 `"ok"` |
| `result` | array | 车次信息数组 |
| `result[].trainno` | string | 车次号 |
| `result[].type` | string | 列车类型，如 `"高铁"`、`"动车"` |
| `result[].station` | string | 出发站名称 |
| `result[].endstation` | string | 到达站名称 |
| `result[].departuretime` | string | 出发时间，格式 `HH:mm` |
| `result[].arrivaltime` | string | 到达时间，格式 `HH:mm` |
| `result[].sequenceno` | string | 该出发站在本车次中的站序 |
| `result[].costtime` | string | 运行时长，格式 `X时XX分` |
| `result[].distance` | string | 两站间里程（公里） |
| `result[].isend` | string | 到达站是否为本车次终点站，`"1"` 是，`"0"` 否 |
| `result[].priceyd` | string | 一等座价格（元），不适用时为 `""` |
| `result[].priceed` | string | 二等座价格（元），不适用时为 `""` |
| `result[].priceyw1` | string | 硬卧下铺价格（元） |
| `result[].priceyw2` | string | 硬卧中铺价格（元） |
| `result[].priceyw3` | string | 硬卧上铺价格（元） |
| `result[].pricerw1` | string | 软卧下铺价格（元） |
| `result[].pricerw2` | string | 软卧上铺价格（元） |
| `result[].pricesw` | string | 商务座价格（元），不适用时为 `""` |
| `result[].pricetd` | string | 特等座价格（元），不适用时为 `""` |
| `result[].pricegr1` | string | 高级软卧下铺价格（元） |
| `result[].pricegr2` | string | 高级软卧上铺价格（元） |

### 响应示例

```json
{
  "status": 0,
  "msg": "ok",
  "result": [
    {
      "trainno": "G34",
      "type": "高铁",
      "station": "杭州东",
      "endstation": "北京南",
      "departuretime": "07:18",
      "arrivaltime": "13:07",
      "sequenceno": "1",
      "costtime": "5时49分",
      "distance": "1279",
      "isend": "1",
      "pricesw": "",
      "pricetd": "",
      "pricegr1": "",
      "pricegr2": "",
      "pricerw1": "0.0",
      "pricerw2": "0.0",
      "priceyw1": "0.0",
      "priceyw2": "0.0",
      "priceyw3": "0.0",
      "priceyd": "907.0",
      "priceed": "538.5"
    },
    {
      "trainno": "G32",
      "type": "高铁",
      "station": "杭州东",
      "endstation": "北京南",
      "departuretime": "08:30",
      "arrivaltime": "13:28",
      "sequenceno": "1",
      "costtime": "4时58分",
      "distance": "1279",
      "isend": "1",
      "pricesw": "",
      "pricetd": "",
      "pricegr1": "",
      "pricegr2": "",
      "pricerw1": "0.0",
      "pricerw2": "0.0",
      "priceyw1": "0.0",
      "priceyw2": "0.0",
      "priceyw3": "0.0",
      "priceyd": "907.0",
      "priceed": "538.5"
    }
  ]
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface TrainRoute {
  trainno: string;
  type: string;
  station: string;
  endstation: string;
  departuretime: string;
  arrivaltime: string;
  sequenceno: string;
  costtime: string;
  distance: string;
  isend: string;
  priceyd: string;
  priceed: string;
  priceyw1: string;
  priceyw2: string;
  priceyw3: string;
  pricerw1: string;
  pricerw2: string;
  pricesw: string;
  pricetd: string;
  pricegr1: string;
  pricegr2: string;
}

/**
 * 查询两站之间的所有车次信息，含票价和里程。
 * @param start - 出发站名称，例如 "杭州东"
 * @param end - 到达站名称，例如 "北京南"
 * @param ishigh - 可选，是否只查高铁动车，传 "1" 表示只查高铁
 * @param date - 可选，查询日期，格式 "YYYY-MM-DD"
 * @returns 车次信息数组
 */
async function queryTrainStation2s(
  start: string,
  end: string,
  ishigh?: string,
  date?: string
): Promise<TrainRoute[]> {
  const params = new URLSearchParams({ start, end });
  if (ishigh) params.set("ishigh", ishigh);
  if (date) params.set("date", date);

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-V9PworyO6gEa-gateway.appmiaoda.com/train/station2s?${params}`,
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
  if (json.status !== 0) throw new Error(`API error: ${json.msg}`);

  return json.result as TrainRoute[];
}

// 使用示例：查询杭州东到北京南的所有高铁
const routes = await queryTrainStation2s("杭州东", "北京南", "1");
console.log(`共找到 ${routes.length} 个车次`);
for (const r of routes) {
  console.log(
    `${r.trainno}（${r.type}）${r.departuretime} → ${r.arrivaltime}  ` +
    `用时:${r.costtime}  里程:${r.distance}km  二等座:¥${r.priceed}`
  );
}
```

---

## Edge Function 代码

### Web 平台 & MiniProgram 通用版本

本接口返回 JSON 数据，Web 和 MiniProgram 可共用同一个 Edge Function。

```typescript
// edge-functions/train-station2s.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let start: string;
  let end: string;
  let ishigh: string | undefined;
  let date: string | undefined;
  try {
    const body = await req.json();
    start = body.start;
    end = body.end;
    if (!start) throw new Error("Missing start");
    if (!end) throw new Error("Missing end");
    ishigh = body.ishigh;
    date = body.date;
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

  // --- 调用上游 API ---
  const params = new URLSearchParams({ start, end });
  if (ishigh) params.set("ishigh", ishigh);
  if (date) params.set("date", date);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-V9PworyO6gEa-gateway.appmiaoda.com/train/station2s?${params}`,
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

## 前端调用代码

### Web 平台（React/TypeScript）

```typescript
/**
 * 查询两站之间的所有车次信息及票价。
 * @param start - 出发站名称，例如 "杭州东"
 * @param end - 到达站名称，例如 "北京南"
 * @param ishigh - 可选，"1" 表示只查高铁动车
 * @param date - 可选，查询日期，格式 "YYYY-MM-DD"
 */
async function fetchTrainStation2s(
  start: string,
  end: string,
  ishigh?: string,
  date?: string
) {
  const { data, error } = await supabase.functions.invoke("train-station2s", {
    body: { start, end, ishigh, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误：${data.msg}`);
  return data.result; // TrainRoute[]
}

// 使用示例
const routes = await fetchTrainStation2s("杭州东", "北京南", "1");
```

### MiniProgram 平台（Taro/React）

```typescript
/**
 * 查询两站之间的所有车次信息及票价（小程序端）。
 * @param start - 出发站名称，例如 "杭州东"
 * @param end - 到达站名称，例如 "北京南"
 * @param ishigh - 可选，"1" 表示只查高铁动车
 * @param date - 可选，查询日期，格式 "YYYY-MM-DD"
 */
async function fetchTrainStation2s(
  start: string,
  end: string,
  ishigh?: string,
  date?: string
) {
  const { data, error } = await supabase.functions.invoke("train-station2s", {
    body: { start, end, ishigh, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误：${data.msg}`);
  return data.result; // TrainRoute[]
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足）两种错误状态。
- **计费**：本接口原价 ¥0.90/次，折扣价 ¥0.75/次，请避免不必要的重复调用。
- **与余票查询的区别**：本接口返回票价信息但不含实时余票数量；如需实时余票请使用 `train-ticket` 接口。
- **ishigh 参数**：该参数为字符串类型，传 `"1"` 筛选高铁动车，不传则返回所有车次。
- **价格字段**：不同车次支持的席别不同，不适用的席别价格字段为空字符串 `""`，显示前需判断非空。
- **站名精确匹配**：`start` 和 `end` 需使用精确站名（如 `杭州东`），不可使用城市名。
