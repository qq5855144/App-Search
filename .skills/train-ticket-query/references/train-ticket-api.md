# 余票查询 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `c5210d89-bd58-4f98-b24c-06f95635df18` |
| API ID | `api-DLEO73lBPZ2a` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO73lBPZ2a-gateway.appmiaoda.com/train/ticket` |
| 认证方式 | platform_managed（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json;charset=UTF-8` |
| Third-party Domain | `app-cblk1rqa5fk1-api-DLEO73lBPZ2a-gateway.appmiaoda.com` |

---

## 请求参数

参数通过 Query String 传递，Body 为空。

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| `start` | string | 是 | `杭州东` | 出发站名称 |
| `end` | string | 是 | `北京南` | 到达站名称 |
| `date` | string | 是 | `2024-01-01` | 查询日期，格式 `YYYY-MM-DD` |

---

## 响应字段说明

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，`0` 表示成功 |
| `msg` | string | 返回消息，成功时为 `"ok"` |
| `result` | array | 车次余票信息数组（注：实际为数组，不含包装对象） |
| `result[].trainno` | string | 车次号 |
| `result[].type` | string | 列车类型，如 `"高铁"`、`"动车"` |
| `result[].departstation` | string | 列车始发站 |
| `result[].terminalstation` | string | 列车终点站 |
| `result[].station` | string | 本次查询的出发站 |
| `result[].endstation` | string | 本次查询的到达站 |
| `result[].day` | string | 跨天数，`"0"` 表示当天到达 |
| `result[].departuretime` | string | 出发站发车时间，格式 `HH:mm` |
| `result[].arrivaltime` | string | 到达站到达时间，格式 `HH:mm` |
| `result[].costtime` | string | 运行时长，格式 `HH:mm` |
| `result[].numsw` | string | 商务座余票数，`"--"` 表示无此席别，`"无"` 表示已售罄 |
| `result[].numtd` | string | 特等座余票数 |
| `result[].numyd` | string | 一等座余票数 |
| `result[].numed` | string | 二等座余票数 |
| `result[].numrz` | string | 软座余票数 |
| `result[].numyz` | string | 硬座余票数 |
| `result[].numgr` | string | 高级软卧余票数 |
| `result[].numrw` | string | 软卧余票数 |
| `result[].numyw` | string | 硬卧余票数 |
| `result[].numwz` | string | 无座余票数 |
| `result[].numqt` | string | 其他席别余票数 |

### 响应示例

```json
{
  "status": 0,
  "msg": "ok",
  "result": [
    {
      "trainno": "G42",
      "type": "高铁",
      "departstation": "杭州东",
      "terminalstation": "北京南",
      "station": "杭州东",
      "endstation": "北京南",
      "day": "0",
      "departuretime": "09:26",
      "arrivaltime": "16:06",
      "costtime": "06:40",
      "numsw": "6",
      "numtd": "--",
      "numyd": "无",
      "numed": "无",
      "numrz": "--",
      "numyz": "--",
      "numgr": "--",
      "numrw": "--",
      "numyw": "--",
      "numwz": "--",
      "numqt": "--"
    },
    {
      "trainno": "G46",
      "type": "高铁",
      "departstation": "江山",
      "terminalstation": "北京南",
      "station": "杭州东",
      "endstation": "北京南",
      "day": "0",
      "departuretime": "09:52",
      "arrivaltime": "15:34",
      "costtime": "05:42",
      "numsw": "1",
      "numtd": "--",
      "numyd": "43",
      "numed": "无",
      "numrz": "--",
      "numyz": "--",
      "numgr": "--",
      "numrw": "--",
      "numyw": "--",
      "numwz": "--",
      "numqt": "--"
    }
  ]
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface TicketInfo {
  trainno: string;
  type: string;
  departstation: string;
  terminalstation: string;
  station: string;
  endstation: string;
  day: string;
  departuretime: string;
  arrivaltime: string;
  costtime: string;
  numsw: string;
  numtd: string;
  numyd: string;
  numed: string;
  numrz: string;
  numyz: string;
  numgr: string;
  numrw: string;
  numyw: string;
  numwz: string;
  numqt: string;
}

/**
 * 查询指定日期出发地到目的地所有车次的余票信息。
 * @param start - 出发站名称，例如 "杭州东"
 * @param end - 到达站名称，例如 "北京南"
 * @param date - 查询日期，格式 "YYYY-MM-DD"
 * @returns 车次余票信息数组
 */
async function queryTrainTicket(
  start: string,
  end: string,
  date: string
): Promise<TicketInfo[]> {
  const params = new URLSearchParams({ start, end, date });

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-DLEO73lBPZ2a-gateway.appmiaoda.com/train/ticket?${params}`,
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

  return json.result as TicketInfo[];
}

// 使用示例
const tickets = await queryTrainTicket("杭州东", "北京南", "2024-06-01");
console.log(`共找到 ${tickets.length} 个车次`);
for (const t of tickets) {
  console.log(
    `${t.trainno}（${t.type}）${t.departuretime} → ${t.arrivaltime}  用时:${t.costtime}` +
    `  一等座:${t.numyd}  二等座:${t.numed}`
  );
}
```

---

## Edge Function 代码

### Web 平台 & MiniProgram 通用版本

本接口返回 JSON 数据，Web 和 MiniProgram 可共用同一个 Edge Function。

```typescript
// edge-functions/train-ticket.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let start: string;
  let end: string;
  let date: string;
  try {
    const body = await req.json();
    start = body.start;
    end = body.end;
    date = body.date;
    if (!start) throw new Error("Missing start");
    if (!end) throw new Error("Missing end");
    if (!date) throw new Error("Missing date");
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
  const params = new URLSearchParams({ start, end, date });

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-DLEO73lBPZ2a-gateway.appmiaoda.com/train/ticket?${params}`,
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
 * 查询指定日期出发地到目的地所有车次余票。
 * @param start - 出发站名称，例如 "杭州东"
 * @param end - 到达站名称，例如 "北京南"
 * @param date - 查询日期，格式 "YYYY-MM-DD"
 */
async function fetchTrainTicket(start: string, end: string, date: string) {
  const { data, error } = await supabase.functions.invoke("train-ticket", {
    body: { start, end, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误：${data.msg}`);
  return data.result; // TicketInfo[]
}

// 使用示例
const tickets = await fetchTrainTicket("杭州东", "北京南", "2024-06-01");
```

### MiniProgram 平台（Taro/React）

```typescript
/**
 * 查询指定日期出发地到目的地所有车次余票（小程序端）。
 * @param start - 出发站名称，例如 "杭州东"
 * @param end - 到达站名称，例如 "北京南"
 * @param date - 查询日期，格式 "YYYY-MM-DD"
 */
async function fetchTrainTicket(start: string, end: string, date: string) {
  const { data, error } = await supabase.functions.invoke("train-ticket", {
    body: { start, end, date },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误：${data.msg}`);
  return data.result; // TicketInfo[]
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足）两种错误状态。
- **计费**：本接口原价 ¥0.90/次，折扣价 ¥0.75/次，请避免不必要的重复调用。
- **余票字段含义**：`"--"` 表示该车次无此席别；`"无"` 表示有此席别但已售罄；数字字符串表示剩余票数。
- **站名精确匹配**：`start` 和 `end` 需使用精确站名（如 `杭州东`），不可使用城市名。
- **实时性**：余票数据反映查询时刻的状态，建议在用户发起购票前实时查询。
