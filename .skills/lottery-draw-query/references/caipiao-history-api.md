# 历史开奖信息 API

## 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `126915de-23d7-454c-accf-b88797feb9e5` |
| API ID | `api-qYGW2z745vzY` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-qYGW2z745vzY-gateway.appmiaoda.com/caipiao/history` |
| Auth | `platform_managed`，`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-qYGW2z745vzY-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `caipiaoid` | string | 是 | — | 彩票ID |
| `issueno` | string | 否 | 当前期 | 期号，不填默认为当前期 |
| `num` | string | 否 | 10 | 获取数量，最大 20，默认 10 |
| `start` | string | 否 | 0 | 起始位置，默认 0 |

## 响应字段

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，0 表示成功 |
| `msg` | string | 返回消息，成功时为 "ok" |
| `result.caipiaoid` | string | 彩票ID |
| `result.list[]` | array | 历史开奖记录列表 |
| `result.list[].opendate` | string | 开奖日期，格式 YYYY-MM-DD |
| `result.list[].issueno` | string | 期号 |
| `result.list[].number` | string | 开奖号码（红球，空格分隔） |
| `result.list[].refernumber` | string | 参考号码（蓝球） |
| `result.list[].saleamount` | string | 销售金额（元） |
| `result.list[].prize[]` | array | 各奖项详情列表 |
| `result.list[].prize[].prizename` | string | 奖项名称 |
| `result.list[].prize[].require` | string | 中奖要求 |
| `result.list[].prize[].num` | string | 中奖人数 |
| `result.list[].prize[].singlebonus` | string | 单注奖金（元） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 非 0 时表示错误 |
| `msg` | string | 错误描述信息 |

## 响应示例

```json
{
  "status": 0,
  "msg": "ok",
  "result": {
    "caipiaoid": "13",
    "list": [
      {
        "opendate": "2014-10-29",
        "issueno": "2014127",
        "number": "05 07 10 18 19 21 27",
        "refernumber": "28",
        "saleamount": "7482530",
        "prize": [
          {
            "prizename": "二等奖",
            "require": "中6+1",
            "num": "9",
            "singlebonus": "27603"
          },
          {
            "prizename": "六等奖",
            "require": "中4+1",
            "num": "14423",
            "singlebonus": "10"
          }
        ]
      }
    ]
  }
}
```

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface PrizeItem {
  prizename: string;
  require: string;
  num: string;
  singlebonus: string;
}

interface HistoryRecord {
  opendate: string;
  issueno: string;
  number: string;
  refernumber: string;
  saleamount: string;
  prize: PrizeItem[];
}

interface CaipiaoHistoryResult {
  caipiaoid: string;
  list: HistoryRecord[];
}

/**
 * 查询指定彩票的历史开奖记录，支持分页。
 * @param caipiaoid 彩票ID（必填）
 * @param issueno 期号（可选，不填默认为当前期）
 * @param num 获取数量（可选，最大20，默认10）
 * @param start 起始位置（可选，默认0）
 * @returns 历史开奖记录列表
 */
async function queryCaipiaoHistory(
  caipiaoid: string,
  issueno?: string,
  num?: string,
  start?: string
): Promise<CaipiaoHistoryResult> {
  const params = new URLSearchParams({ caipiaoid });
  if (issueno) params.set("issueno", issueno);
  if (num) params.set("num", num);
  if (start) params.set("start", start);

  const url =
    `https://app-cblk1rqa5fk1-api-qYGW2z745vzY-gateway.appmiaoda.com/caipiao/history?${params.toString()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.msg}`);

  return json.result;
}

// 使用示例：查询七乐彩（caipiaoid=13）最近 5 期历史开奖记录
const history = await queryCaipiaoHistory("13", undefined, "5");
for (const record of history.list) {
  console.log(`期号 ${record.issueno}（${record.opendate}）：${record.number} | 蓝球：${record.refernumber}`);
}
```

## Edge Function 代码

```typescript
// edge-functions/caipiao-history.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let caipiaoid: string;
  let issueno: string | undefined;
  let num: string | undefined;
  let start: string | undefined;
  try {
    const body = await req.json();
    caipiaoid = body.caipiaoid;
    issueno = body.issueno;
    num = body.num;
    start = body.start;
    if (!caipiaoid) throw new Error("Missing caipiaoid");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（不可暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const params = new URLSearchParams({ caipiaoid });
  if (issueno) params.set("issueno", issueno);
  if (num) params.set("num", num);
  if (start) params.set("start", start);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-qYGW2z745vzY-gateway.appmiaoda.com/caipiao/history?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // 原样转发配额/余额错误
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

## 前端调用代码

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询历史开奖记录。
 * @param caipiaoid 彩票ID
 * @param issueno 期号（可选）
 * @param num 获取数量（可选，最大20）
 * @param start 起始位置（可选）
 * @returns 历史开奖记录列表
 */
async function queryCaipiaoHistory(
  caipiaoid: string,
  issueno?: string,
  num?: string,
  start?: string
) {
  const { data, error } = await supabase.functions.invoke("caipiao-history", {
    body: {
      caipiaoid,
      ...(issueno ? { issueno } : {}),
      ...(num ? { num } : {}),
      ...(start ? { start } : {}),
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过 Edge Function 查询历史开奖记录（备用方式）。
 * @param caipiaoid 彩票ID
 * @param issueno 期号（可选）
 * @param num 获取数量（可选，最大20）
 * @param start 起始位置（可选）
 * @returns 历史开奖记录列表
 */
async function queryCaipiaoHistory(
  caipiaoid: string,
  issueno?: string,
  num?: string,
  start?: string
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/caipiao-history`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caipiaoid,
        ...(issueno ? { issueno } : {}),
        ...(num ? { num } : {}),
        ...(start ? { start } : {}),
      }),
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

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：每次调用折扣价 ¥0.09（原价 ¥0.20），分页获取时注意控制调用次数，避免不必要的重复调用。
- **分页说明**：`num` 最大为 20，`start` 从 0 开始，可通过递增 `start` 实现翻页。
