# 沪深股票信息 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-ELbWz8Om3b8Y` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-ELbWz8Om3b8Y-gateway.appmiaoda.com/stock/hs/info` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-ELbWz8Om3b8Y-gateway.appmiaoda.com` |
| 计费 | 启用，具体价格以平台实际配置为准 |

> **使用优先级提示（来自官方 examples）：** 涉及个股信息查询、股票搜索等功能时，请优先使用本接口（适用于 MiniProgram）。

---

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | string | 是 | 品种代码，从股票排行或板块排行接口获取，格式如 `000001.SZ` 或 `300117.SZ` |

---

## 响应字段

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `success` | boolean | 是否成功 |
| `data.prod_code` | string | 品种代码 |
| `data.prod_name` | string | 品种名称 |
| `data.last_px` | number | 最新价 |
| `data.px_change` | number | 价格涨跌 |
| `data.px_change_rate` | number | 涨跌幅（%） |
| `data.open_px` | number | 开盘价 |
| `data.high_px` | number | 最高价 |
| `data.low_px` | number | 最低价 |
| `data.preclose_px` | number | 昨收价 |
| `data.turnover_volume` | number | 成交量（手） |
| `data.turnover_value` | number | 成交额（元） |
| `data.market_value` | number | 总市值（元） |
| `data.circulation_value` | number | 流通市值（元） |
| `data.pe_rate` | number | 市盈率 |
| `data.pb_rate` | number | 市净率 |
| `data.turnover_ratio` | number | 换手率（%） |
| `data.amplitude` | number | 振幅（%） |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface StockInfo {
  prod_code: string;
  prod_name: string;
  last_px: number;
  px_change: number;
  px_change_rate: number;
  open_px: number;
  high_px: number;
  low_px: number;
  preclose_px: number;
  turnover_volume: number;
  turnover_value: number;
  market_value: number;
  circulation_value: number;
  pe_rate: number;
  pb_rate: number;
  turnover_ratio: number;
  amplitude: number;
}

/**
 * 获取沪深个股实时行情信息，包括价格、市值、财务指标等。
 * 涉及个股信息查询、股票搜索等功能时，优先使用本接口。
 * @param code - 品种代码，如 000001.SZ
 * @returns 股票详细信息
 */
async function fetchStockInfo(code: string): Promise<StockInfo> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8Om3b8Y-gateway.appmiaoda.com/stock/hs/info",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ code }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as StockInfo;
}

// 使用示例
const info = await fetchStockInfo("300117.SZ");
console.log(`${info.prod_name}(${info.prod_code}) 最新价: ${info.last_px} 涨跌幅: ${info.px_change_rate}%`);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-info.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let code: string;
  try {
    const body = await req.json();
    code = body.code;
    if (!code) throw new Error("Missing code");
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
    "https://app-cblk1rqa5fk1-api-ELbWz8Om3b8Y-gateway.appmiaoda.com/stock/hs/info",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ code }).toString(),
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

**推荐方式（supabase client 可用时，适用 Web 和 MiniProgram）：**

```typescript
/**
 * 查询沪深个股实时行情。
 * 涉及个股信息查询、股票搜索等功能时，优先使用本函数。
 * @param code - 品种代码，如 000001.SZ
 * @returns 股票信息
 */
async function fetchStockInfo(code: string) {
  const { data, error } = await supabase.functions.invoke("stock-info", {
    body: { code },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无 supabase client）：**

```typescript
async function fetchStockInfo(code: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stock-info`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
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

## 注意事项

- **密钥安全：** `INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理：** 务必处理 429（配额超限）和 402（余额不足）。
- **计费：** 每次调用计费，具体价格以平台实际配置为准。
- **使用优先级：** 官方推荐：涉及个股信息查询、股票搜索时，优先使用本接口。
- **code 格式：** 股票代码需带市场后缀，如 `000001.SZ`（深圳）或 `600000.SH`（上海）。
