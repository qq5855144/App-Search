# 车次查询 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `c5210d89-bd58-4f98-b24c-06f95635df18` |
| API ID | `api-DLEO73l7Vjwa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO73l7Vjwa-gateway.appmiaoda.com/train/line` |
| 认证方式 | platform_managed（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json;charset=UTF-8` |
| Third-party Domain | `app-cblk1rqa5fk1-api-DLEO73l7Vjwa-gateway.appmiaoda.com` |

---

## 请求参数

参数通过 Query String 传递，Body 为空。

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `trainno` | string | 是 | `G34` | 车次号 |
| `date` | string | 否 | `2024-01-01` | 查询日期，不传则返回固定时刻表 |

---

## 响应字段说明

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，`0` 表示成功 |
| `msg` | string | 返回消息，成功时为 `"ok"` |
| `result.trainno` | string | 车次号 |
| `result.type` | string | 列车类型，如 `"高铁"`、`"动车"` |
| `result.list[]` | array | 沿途站点信息数组 |
| `result.list[].sequenceno` | string | 站序（从 `"1"` 开始） |
| `result.list[].station` | string | 站点名称 |
| `result.list[].day` | string | 第几天（跨天时大于 `"1"`） |
| `result.list[].arrivaltime` | string | 到达时间，始发站为 `"-"` |
| `result.list[].departuretime` | string | 发车时间，终到站为 `"-"` |
| `result.list[].stoptime` | string | 停靠时长（分钟），始发站为 `"0"` |
| `result.list[].costtime` | string | 自始发站累计运行时长（分钟） |
| `result.list[].distance` | string | 自始发站累计里程（公里） |
| `result.list[].isend` | string | 是否终点站，`"1"` 是，`"0"` 否 |
| `result.list[].priceyd` | string | 一等座价格（元），不适用时为 `""` |
| `result.list[].priceed` | string | 二等座价格（元），不适用时为 `""` |
| `result.list[].priceyw1` | string | 硬卧下铺价格（元） |
| `result.list[].priceyw2` | string | 硬卧中铺价格（元） |
| `result.list[].priceyw3` | string | 硬卧上铺价格（元） |
| `result.list[].pricerw1` | string | 软卧下铺价格（元） |
| `result.list[].pricerw2` | string | 软卧上铺价格（元） |
| `result.list[].pricesw` | string | 商务座价格（元），不适用时为 `""` |
| `result.list[].pricetd` | string | 特等座价格（元），不适用时为 `""` |
| `result.list[].pricegr1` | string | 高级软卧下铺价格（元） |
| `result.list[].pricegr2` | string | 高级软卧上铺价格（元） |

### 响应示例

```json
{
  "status": 0,
  "msg": "ok",
  "result": {
    "trainno": "G34",
    "type": "高铁",
    "list": [
      {
        "sequenceno": "1",
        "station": "杭州东",
        "day": "1",
        "arrivaltime": "-",
        "departuretime": "07:18",
        "stoptime": "0",
        "costtime": "0",
        "distance": "0",
        "isend": "0",
        "pricesw": "",
        "pricetd": "",
        "pricegr1": "",
        "pricegr2": "",
        "pricerw1": "0.0",
        "pricerw2": "0.0",
        "priceyw1": "0.0",
        "priceyw2": "0.0",
        "priceyw3": "0.0",
        "priceyd": "0.0",
        "priceed": "0.0"
      },
      {
        "sequenceno": "2",
        "station": "湖州",
        "day": "1",
        "arrivaltime": "07:39",
        "departuretime": "07:41",
        "stoptime": "2",
        "costtime": "21",
        "distance": "71",
        "isend": "0",
        "pricesw": "",
        "pricetd": "",
        "pricegr1": "",
        "pricegr2": "",
        "pricerw1": "0.0",
        "pricerw2": "0.0",
        "priceyw1": "0.0",
        "priceyw2": "0.0",
        "priceyw3": "0.0",
        "priceyd": "55.0",
        "priceed": "32.5"
      }
    ]
  }
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface TrainStation {
  sequenceno: string;
  station: string;
  day: string;
  arrivaltime: string;
  departuretime: string;
  stoptime: string;
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

interface TrainLineResult {
  trainno: string;
  type: string;
  list: TrainStation[];
}

/**
 * 查询指定车次的完整时刻表及票价信息。
 * @param trainno - 车次号，例如 "G34"
 * @param date - 可选，查询日期，格式 "YYYY-MM-DD"
 * @returns 包含车次类型和沿途站点信息的对象
 */
async function queryTrainLine(trainno: string, date?: string): Promise<TrainLineResult> {
  const params = new URLSearchParams({ trainno });
  if (date) params.set("date", date);

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-DLEO73l7Vjwa-gateway.appmiaoda.com/train/line?${params}`,
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

  return json.result as TrainLineResult;
}

// 使用示例
const result = await queryTrainLine("G34");
console.log(`${result.trainno}（${result.type}）共经过 ${result.list.length} 站`);
for (const s of result.list) {
  console.log(
    `  ${s.sequenceno}. ${s.station}  到达:${s.arrivaltime}  出发:${s.departuretime}  ` +
    `停靠:${s.stoptime}min  二等座:¥${s.priceed}`
  );
}
```

---

## Edge Function 代码

### Web 平台 & MiniProgram 通用版本

本接口返回 JSON 数据，Web 和 MiniProgram 可共用同一个 Edge Function。

```typescript
// edge-functions/train-line.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let trainno: string;
  let date: string | undefined;
  try {
    const body = await req.json();
    trainno = body.trainno;
    if (!trainno) throw new Error("Missing trainno");
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
  const params = new URLSearchParams({ trainno });
  if (date) params.set("date", date);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-DLEO73l7Vjwa-gateway.appmiaoda.com/train/line?${params}`,
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
 * 查询车次时刻表及票价。
 * @param trainno - 车次号，例如 "G34"
 * @param date - 可选，查询日期，格式 "YYYY-MM-DD"
 */
async function fetchTrainLine(trainno: string, date?: string) {
  const { data, error } = await supabase.functions.invoke("train-line", {
    body: { trainno, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误：${data.msg}`);
  return data.result;
}

// 使用示例
const result = await fetchTrainLine("G34", "2024-06-01");
console.log(result.list); // 站点数组
```

### MiniProgram 平台（Taro/React）

```typescript
/**
 * 查询车次时刻表及票价（小程序端）。
 * @param trainno - 车次号，例如 "G34"
 * @param date - 可选，查询日期，格式 "YYYY-MM-DD"
 */
async function fetchTrainLine(trainno: string, date?: string) {
  const { data, error } = await supabase.functions.invoke("train-line", {
    body: { trainno, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误：${data.msg}`);
  return data.result;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足）两种错误状态。
- **计费**：本接口原价 ¥0.90/次，折扣价 ¥0.75/次，请避免不必要的重复调用。
- **参数注意**：`trainno` 大小写不敏感，但建议使用标准格式（如 `G34`、`K1`）。
- **价格字段**：不同车次支持的席别不同，不适用的席别价格字段为空字符串 `""`，显示前需判断非空。
- **始发/终到站**：始发站 `arrivaltime` 为 `"-"`，终到站 `departuretime` 为 `"-"`，`costtime` 和 `distance` 从始发站累计。
