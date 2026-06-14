# 沪深大盘涨跌数 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-wYqgz8WoB0A9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-wYqgz8WoB0A9-gateway.appmiaoda.com/stock/hs/overview` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | 无（本接口无需请求体，不需要设置 Content-Type 请求头） |
| Third-party domain | `app-cblk1rqa5fk1-api-wYqgz8WoB0A9-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

本接口无需请求参数，直接 POST 即可。

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| （无） | — | — | 无需任何参数 |

---

## 响应字段

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `taskNo` | string | 本次请求号 |
| `data.sh.flat` | number | 上证平盘股票数量 |
| `data.sh.up` | number | 上证上涨股票数量 |
| `data.sh.down` | number | 上证下跌股票数量 |
| `data.sz.flat` | number | 深证平盘股票数量 |
| `data.sz.up` | number | 深证上涨股票数量 |
| `data.sz.down` | number | 深证下跌股票数量 |
| `data.cyb.flat` | number | 创业板平盘股票数量 |
| `data.cyb.up` | number | 创业板上涨股票数量 |
| `data.cyb.down` | number | 创业板下跌股票数量 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface MarketStat {
  flat: number;
  up: number;
  down: number;
}

interface OverviewData {
  sh: MarketStat;
  sz: MarketStat;
  cyb: MarketStat;
}

/**
 * 获取沪深大盘实时涨跌数统计（上证、深证、创业板）。
 * @returns 大盘涨跌平统计数据
 */
async function fetchOverview(): Promise<OverviewData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-wYqgz8WoB0A9-gateway.appmiaoda.com/stock/hs/overview",
    {
      method: "POST",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as OverviewData;
}

// 使用示例
const overview = await fetchOverview();
console.log(`上证: 涨=${overview.sh.up} 平=${overview.sh.flat} 跌=${overview.sh.down}`);
console.log(`深证: 涨=${overview.sz.up} 平=${overview.sz.flat} 跌=${overview.sz.down}`);
console.log(`创业板: 涨=${overview.cyb.up} 平=${overview.cyb.flat} 跌=${overview.cyb.down}`);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-overview.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
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
    "https://app-cblk1rqa5fk1-api-wYqgz8WoB0A9-gateway.appmiaoda.com/stock/hs/overview",
    {
      method: "POST",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
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
 * 获取沪深大盘涨跌数统计。
 * @returns 大盘涨跌平数据（sh/sz/cyb）
 */
async function fetchOverview() {
  const { data, error } = await supabase.functions.invoke("stock-overview", {
    body: {},
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

---

## 注意事项

- **密钥安全：** `INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理：** 务必处理 429（配额超限）和 402（余额不足）。
- **计费：** 每次调用计费，折扣价 ¥0.13/次。
- **数据说明：** 返回当日实时涨跌平统计，可用于展示大盘情绪指标。
