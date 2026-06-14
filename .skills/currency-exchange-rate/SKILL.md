---
name: currency-exchange-rate
description: 查询指定货币对全球200多种货币的实时汇率列表；适用于跨境电商、国际结算、汇率换算等场景。
license: MIT
---

## 能力概述

调用汇率转换 API，根据指定源货币代码查询该货币对其他所有货币的实时汇率信息。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-ELbWz8OmBW5Y-gateway.appmiaoda.com/exchange-rate-v2/single`
- **Content-Type**: `application/x-www-form-urlencoded`
- **认证**: platform_managed（密钥由平台注入）
- **支持货币**: 200 多种，含 CNY、USD、EUR、JPY、GBP、HKD、SGD 等主流货币及各国小币种
- **支持平台**: Web / MiniProgram / App
- **响应**: JSON，`data.list` 为以目标货币代码为键的对象，每项含汇率 `rate`、货币名称 `name`、更新时间 `updatetime`

**响应示例：**

```json
{
  "code": 200,
  "msg": "成功",
  "taskNo": "825091389158520001104287",
  "data": {
    "name": "英镑",
    "currency": "GBP",
    "list": {
      "FJD": {
        "rate": "2.946800",
        "name": "斐济元",
        "updatetime": "2024-10-29 04:37:55"
      },
      "MXN": {
        "rate": "25.949600",
        "name": "墨西哥比索",
        "updatetime": "2024-10-29 13:54:37"
      }
    }
  }
}
```

**返回码说明：**

| code | 含义 |
|------|------|
| 200  | 成功 |
| 201  | 查无数据 |
| 400  | 参数错误（如 fromCode 为空或不合法） |
| 500  | 系统维护，请稍后再试 |
| 999  | 其他错误 |

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface ExchangeRateItem {
  rate: string;
  name: string;
  updatetime: string;
}

interface ExchangeRateData {
  name: string;
  currency: string;
  list: Record<string, ExchangeRateItem>;
}

/**
 * 查询指定源货币对所有其他货币的实时汇率列表。
 * @param fromCode - 源货币代码，如 CNY、USD、EUR、JPY、GBP 等
 * @returns 汇率数据对象，含源货币名称、代码及目标货币汇率列表
 */
async function getExchangeRates(fromCode: string): Promise<ExchangeRateData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8OmBW5Y-gateway.appmiaoda.com/exchange-rate-v2/single",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ fromCode }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as ExchangeRateData;
}

// 示例：查询英镑对所有货币的汇率
const data = await getExchangeRates("GBP");
console.log(`${data.name}（${data.currency}）汇率列表：`);
for (const [code, info] of Object.entries(data.list)) {
  console.log(`  ${code} ${info.name}: ${info.rate}（更新于 ${info.updatetime}）`);
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/currency-exchange-rate.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let fromCode: string;
  try {
    const body = await req.json();
    fromCode = body.fromCode;
    if (!fromCode) throw new Error("Missing fromCode");
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

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8OmBW5Y-gateway.appmiaoda.com/exchange-rate-v2/single",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ fromCode }).toString(),
    }
  );

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

### 前端调用

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询指定源货币的实时汇率列表。
 * @param fromCode - 源货币代码，如 CNY、USD、EUR、JPY、GBP 等
 * @returns 汇率数据对象
 */
async function fetchExchangeRates(fromCode: string) {
  const { data, error } = await supabase.functions.invoke("currency-exchange-rate", {
    body: { fromCode },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 查询汇率。
 * @param fromCode - 源货币代码，如 CNY、USD、EUR 等
 * @returns 汇率数据对象
 */
async function fetchExchangeRates(fromCode: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/currency-exchange-rate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromCode }),
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
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);

  return json.data;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `fromCode` | string | 是 | 源货币代码，如 CNY、USD、EUR、JPY、GBP 等，支持 200 多种货币（详见货币代码表） |

### 常用货币代码

| 代码 | 名称 | 代码 | 名称 |
|------|------|------|------|
| CNY | 人民币 | USD | 美元 |
| EUR | 欧元 | JPY | 日元 |
| GBP | 英镑 | HKD | 港币 |
| KRW | 韩元 | SGD | 新加坡元 |
| AUD | 澳大利亚元 | CAD | 加拿大元 |
| CHF | 瑞士法郎 | INR | 印度卢比 |
| RUB | 卢布 | TWD | 新台币 |
| THB | 泰国铢 | MYR | 林吉特 |
| BRL | 巴西雷亚尔 | MXN | 墨西哥比索 |
| AED | 阿联酋迪拉姆 | SAR | 沙特里亚尔 |

完整货币代码列表请参阅官方文档，共支持 200 多种货币。

### 返回字段说明

**成功响应（code = 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `taskNo` | string | 本次请求唯一编号 |
| `data.name` | string | 源货币名称（如"英镑"） |
| `data.currency` | string | 源货币代码（如"GBP"） |
| `data.list` | object | 目标货币汇率字典，键为货币代码 |
| `data.list.<CODE>.rate` | string | 汇率数值（字符串格式，如"2.946800"） |
| `data.list.<CODE>.name` | string | 目标货币名称（如"斐济元"） |
| `data.list.<CODE>.updatetime` | string | 汇率更新时间，格式"YYYY-MM-DD HH:mm:ss" |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码（201/400/500/999） |
| `msg` | string | 错误描述（如"源货币类型不能为空"） |

---

## 注意事项

- **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端代码或客户端日志中。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）两类错误，建议展示友好提示而非原始错误码。
- **计费**: 该接口启用计费，折扣单价 **¥0.02 / 次**（原价 ¥0.10 / 次），每次调用均计费，请避免不必要的重复调用（如轮询或频繁刷新）。
- **数据时效**: 汇率数据为实时行情，但更新时间由上游决定，`updatetime` 字段反映各货币对的最新同步时间，非 tick 级精度，不适用于高频交易场景。
- **fromCode 为空**: 传入空字符串或不传 `fromCode` 时，上游返回 `code: 400`，msg 为"源货币类型不能为空"。
- **查无数据**: 若货币代码不在支持范围内，上游返回 `code: 201`，msg 为"查无数据"。
