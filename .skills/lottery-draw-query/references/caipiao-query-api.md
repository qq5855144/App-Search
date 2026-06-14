# 彩票开奖 API

## 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `126915de-23d7-454c-accf-b88797feb9e5` |
| API ID | `api-baBw2m51JXz9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-baBw2m51JXz9-gateway.appmiaoda.com/caipiao/query` |
| Auth | `platform_managed`，`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-baBw2m51JXz9-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `caipiaoid` | string | 是 | 彩票ID |
| `issueno` | string | 否 | 期号，不填默认为当前期 |

## 响应字段

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，0 表示成功 |
| `msg` | string | 返回消息，成功时为 "ok" |
| `result.caipiaoid` | string | 彩票ID |
| `result.issueno` | string | 期号 |
| `result.number` | string | 开奖号码（红球，空格分隔） |
| `result.refernumber` | string | 参考号码（蓝球） |
| `result.opendate` | string | 开奖日期，格式 YYYY-MM-DD |
| `result.deadline` | string | 截止日期，格式 YYYY-MM-DD |
| `result.saleamount` | string | 销售金额（元） |
| `result.prize[]` | array | 各奖项详情列表 |
| `result.prize[].prizename` | string | 奖项名称 |
| `result.prize[].require` | string | 中奖要求 |
| `result.prize[].num` | string | 中奖人数 |
| `result.prize[].singlebonus` | string | 单注奖金（元） |

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
    "issueno": "2014127",
    "number": "05 07 10 18 19 21 27",
    "refernumber": "28",
    "opendate": "2014-10-29",
    "deadline": "2014-12-27",
    "saleamount": "7482530",
    "prize": [
      {
        "prizename": "二等奖",
        "require": "中6+0",
        "num": "50",
        "singlebonus": "608921"
      },
      {
        "prizename": "六等奖",
        "require": "中2+1/1+1/0+1",
        "num": "10863811",
        "singlebonus": "5"
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

interface CaipiaoQueryResult {
  caipiaoid: string;
  issueno: string;
  number: string;
  refernumber: string;
  opendate: string;
  deadline: string;
  saleamount: string;
  prize: PrizeItem[];
}

/**
 * 查询指定彩票的开奖信息。
 * @param caipiaoid 彩票ID（必填）
 * @param issueno 期号（可选，不填默认查询当前期）
 * @returns 开奖结果，含开奖号码、奖项详情等
 */
async function queryCaipiaoResult(
  caipiaoid: string,
  issueno?: string
): Promise<CaipiaoQueryResult> {
  const params = new URLSearchParams({ caipiaoid });
  if (issueno) params.set("issueno", issueno);

  const url =
    `https://app-cblk1rqa5fk1-api-baBw2m51JXz9-gateway.appmiaoda.com/caipiao/query?${params.toString()}`;
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

// 使用示例：查询双色球（caipiaoid=11）当前期开奖结果
const result = await queryCaipiaoResult("11");
console.log(`期号：${result.issueno}，开奖日期：${result.opendate}`);
console.log(`红球：${result.number}，蓝球：${result.refernumber}`);
```

## Edge Function 代码

```typescript
// edge-functions/caipiao-query.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let caipiaoid: string;
  let issueno: string | undefined;
  try {
    const body = await req.json();
    caipiaoid = body.caipiaoid;
    issueno = body.issueno;
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

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-baBw2m51JXz9-gateway.appmiaoda.com/caipiao/query?${params.toString()}`,
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
 * 通过 Edge Function 查询彩票开奖结果。
 * @param caipiaoid 彩票ID
 * @param issueno 期号（可选）
 * @returns 开奖结果
 */
async function queryCaipiao(caipiaoid: string, issueno?: string) {
  const { data, error } = await supabase.functions.invoke("caipiao-query", {
    body: { caipiaoid, ...(issueno ? { issueno } : {}) },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过 Edge Function 查询彩票开奖结果（备用方式）。
 * @param caipiaoid 彩票ID
 * @param issueno 期号（可选）
 * @returns 开奖结果
 */
async function queryCaipiao(caipiaoid: string, issueno?: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/caipiao-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caipiaoid, ...(issueno ? { issueno } : {}) }),
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
- **计费**：每次调用折扣价 ¥0.09（原价 ¥0.20），避免不必要的重复调用。
- **参数说明**：`caipiaoid` 可通过彩票分类接口（`caipiao-class`）获取，如双色球为 `11`，福彩3D 为 `12`，七乐彩为 `13`。
