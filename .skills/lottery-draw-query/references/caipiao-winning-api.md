# 查询是否中奖 API

## 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `126915de-23d7-454c-accf-b88797feb9e5` |
| API ID | `api-2Y00V8pRRoxY` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-2Y00V8pRRoxY-gateway.appmiaoda.com/caipiao/winning` |
| Auth | `platform_managed`，`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-2Y00V8pRRoxY-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `caipiaoid` | string | 是 | — | 彩票ID |
| `issueno` | string | 否 | 最新一期 | 期号，默认为最新一期 |
| `number` | string | 是 | — | 彩票号码（红球） |
| `refernumber` | string | 否 | — | 彩票剩余号码（蓝球） |
| `type` | string | 否 | — | 投注类型：1 直选、2 组三、3 组六 |

## 响应字段

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，0 表示成功 |
| `msg` | string | 返回消息，中奖时为 "恭喜您，中奖了！" |
| `result.caipiaoid` | string | 彩票ID |
| `result.number` | string | 用户提交的彩票号码（红球） |
| `result.refernumber` | string | 用户提交的彩票号码（蓝球） |
| `result.issueno` | string | 查询期号 |
| `result.winstatus` | string | 中奖状态：0 表示中奖，1 表示未中奖 |
| `result.prizename` | string | 中奖奖项名称（未中奖时为空） |
| `result.require` | string | 中奖要求描述 |
| `result.singlebonus` | string | 单注奖金（元） |
| `result.winnumber` | string | 开奖号码（红球） |
| `result.winrefernumber` | string | 开奖号码（蓝球） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 非 0 时表示错误 |
| `msg` | string | 错误描述信息 |

## 响应示例

```json
{
  "status": 0,
  "msg": "恭喜您，中奖了！",
  "result": {
    "caipiaoid": "11",
    "number": "02 06 15 25 30 32",
    "refernumber": "08",
    "issueno": "2016081",
    "winstatus": "0",
    "prizename": "二等奖",
    "require": "中6+0",
    "singlebonus": "239666",
    "winnumber": "02 06 15 25 30 32",
    "winrefernumber": "07"
  }
}
```

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface CaipiaoWinningResult {
  caipiaoid: string;
  number: string;
  refernumber: string;
  issueno: string;
  winstatus: string;   // "0" 中奖，"1" 未中奖
  prizename: string;
  require: string;
  singlebonus: string;
  winnumber: string;
  winrefernumber: string;
}

/**
 * 查询指定彩票号码是否中奖。
 * @param caipiaoid 彩票ID（必填）
 * @param number 彩票号码红球（必填）
 * @param issueno 期号（可选，默认最新一期）
 * @param refernumber 彩票号码蓝球（可选）
 * @param type 投注类型（可选，1直选/2组三/3组六）
 * @returns 中奖查询结果
 */
async function queryCaipiaoWinning(
  caipiaoid: string,
  number: string,
  issueno?: string,
  refernumber?: string,
  type?: string
): Promise<CaipiaoWinningResult> {
  const params = new URLSearchParams({ caipiaoid, number });
  if (issueno) params.set("issueno", issueno);
  if (refernumber) params.set("refernumber", refernumber);
  if (type) params.set("type", type);

  const url =
    `https://app-cblk1rqa5fk1-api-2Y00V8pRRoxY-gateway.appmiaoda.com/caipiao/winning?${params.toString()}`;
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

// 使用示例：查询双色球（caipiaoid=11）号码 "02 06 15 25 30 32" 蓝球 "08" 是否中奖
const winning = await queryCaipiaoWinning("11", "02 06 15 25 30 32", undefined, "08");
if (winning.winstatus === "0") {
  console.log(`恭喜中奖！奖项：${winning.prizename}，单注奖金：¥${winning.singlebonus}`);
} else {
  console.log("未中奖，继续加油！");
}
```

## Edge Function 代码

```typescript
// edge-functions/caipiao-winning.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let caipiaoid: string;
  let number: string;
  let issueno: string | undefined;
  let refernumber: string | undefined;
  let type: string | undefined;
  try {
    const body = await req.json();
    caipiaoid = body.caipiaoid;
    number = body.number;
    issueno = body.issueno;
    refernumber = body.refernumber;
    type = body.type;
    if (!caipiaoid) throw new Error("Missing caipiaoid");
    if (!number) throw new Error("Missing number");
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
  const params = new URLSearchParams({ caipiaoid, number });
  if (issueno) params.set("issueno", issueno);
  if (refernumber) params.set("refernumber", refernumber);
  if (type) params.set("type", type);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-2Y00V8pRRoxY-gateway.appmiaoda.com/caipiao/winning?${params.toString()}`,
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
 * 通过 Edge Function 查询彩票是否中奖。
 * @param caipiaoid 彩票ID
 * @param number 彩票号码红球
 * @param issueno 期号（可选）
 * @param refernumber 彩票号码蓝球（可选）
 * @param type 投注类型（可选）
 * @returns 中奖查询结果
 */
async function queryCaipiaoWinning(
  caipiaoid: string,
  number: string,
  issueno?: string,
  refernumber?: string,
  type?: string
) {
  const { data, error } = await supabase.functions.invoke("caipiao-winning", {
    body: {
      caipiaoid,
      number,
      ...(issueno ? { issueno } : {}),
      ...(refernumber ? { refernumber } : {}),
      ...(type ? { type } : {}),
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
 * 通过 Edge Function 查询彩票是否中奖（备用方式）。
 * @param caipiaoid 彩票ID
 * @param number 彩票号码红球
 * @param issueno 期号（可选）
 * @param refernumber 彩票号码蓝球（可选）
 * @param type 投注类型（可选）
 * @returns 中奖查询结果
 */
async function queryCaipiaoWinning(
  caipiaoid: string,
  number: string,
  issueno?: string,
  refernumber?: string,
  type?: string
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/caipiao-winning`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caipiaoid,
        number,
        ...(issueno ? { issueno } : {}),
        ...(refernumber ? { refernumber } : {}),
        ...(type ? { type } : {}),
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
- **计费**：每次调用折扣价 ¥0.09（原价 ¥0.20），避免不必要的重复调用。
- **中奖状态**：`result.winstatus` 为 `"0"` 表示中奖，`"1"` 表示未中奖，注意是字符串类型。
- **投注类型**：`type` 参数仅适用于支持直选/组三/组六玩法的彩票（如福彩3D），其他彩票无需传此参数。
