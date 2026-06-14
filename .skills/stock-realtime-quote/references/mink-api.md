# 沪深分钟K含均线 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-NLZ1o2xd6DE9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-NLZ1o2xd6DE9-gateway.appmiaoda.com/stock/hs/mink` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-NLZ1o2xd6DE9-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `code` | string | 是 | — | 股票代码，如 `000001.SZ` |
| `period` | string | 否 | `1` | K线类型（分钟）：`1`、`5`、`15`、`30`、`60`、`120` |
| `pageSize` | string | 否 | `10` | 返回数量 |

---

## 响应字段

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `taskNo` | string | 本次请求号 |
| `data.list[]` | array | 分钟K线列表 |
| `data.list[].day` | string | 时间，格式 `YYYY-MM-DD HH:mm:ss` |
| `data.list[].open` | string | 开盘价 |
| `data.list[].close` | string | 收盘价 |
| `data.list[].high` | string | 最高价 |
| `data.list[].low` | string | 最低价 |
| `data.list[].volume` | string | 成交量 |
| `data.list[].ma_price5` | number | 5 周期均价 |
| `data.list[].ma_price10` | number | 10 周期均价 |
| `data.list[].ma_price30` | number | 30 周期均价 |
| `data.list[].ma_volume5` | number | 5 周期均量 |
| `data.list[].ma_volume10` | number | 10 周期均量 |
| `data.list[].ma_volume30` | number | 30 周期均量 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface MinkItem {
  day: string;
  open: string;
  close: string;
  high: string;
  low: string;
  volume: string;
  ma_price5: number;
  ma_price10: number;
  ma_price30: number;
  ma_volume5: number;
  ma_volume10: number;
  ma_volume30: number;
}

/**
 * 获取沪深股票分钟 K 线数据（含均线指标）。
 * @param code - 股票代码，如 000001.SZ
 * @param period - K 线类型（分钟）：1/5/15/30/60/120，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 分钟 K 线列表
 */
async function fetchMink(
  code: string,
  period = "1",
  pageSize = "10"
): Promise<MinkItem[]> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-NLZ1o2xd6DE9-gateway.appmiaoda.com/stock/hs/mink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ code, period, pageSize }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data.list as MinkItem[];
}

// 使用示例：查询平安银行 1 分钟 K 线最近 10 条
const minkData = await fetchMink("000001.SZ", "1", "10");
for (const item of minkData) {
  console.log(`${item.day} 收=${item.close} MA5=${item.ma_price5}`);
}
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-mink.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let code: string;
  let period: string;
  let pageSize: string;
  try {
    const body = await req.json();
    code = body.code;
    if (!code) throw new Error("Missing code");
    period = body.period ?? "1";
    pageSize = body.pageSize ?? "10";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-NLZ1o2xd6DE9-gateway.appmiaoda.com/stock/hs/mink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ code, period, pageSize }).toString(),
    }
  );

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

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 查询沪深分钟 K 线（含均线）。
 * @param code - 股票代码，如 000001.SZ
 * @param period - K 线类型（分钟），默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 分钟 K 线列表
 */
async function fetchMink(code: string, period = "1", pageSize = "10") {
  const { data, error } = await supabase.functions.invoke("stock-mink", {
    body: { code, period, pageSize },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data.list;
}
```

---

## 注意事项

- **密钥安全：** `INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理：** 务必处理 429（配额超限）和 402（余额不足）。
- **计费：** 每次调用计费，折扣价 ¥0.13/次。
- **数值类型注意：** `open`/`close`/`high`/`low`/`volume` 为 string 类型，使用时需 `parseFloat()`；均线字段已是 number 类型。
- **period 说明：** 仅支持 1、5、15、30、60、120 分钟，如需日K及以上请使用 kline 接口。
