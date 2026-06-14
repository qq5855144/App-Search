# 沪深股票排行 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-wLNdo2j5e6ga` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-wLNdo2j5e6ga-gateway.appmiaoda.com/stock/hs/rank` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-wLNdo2j5e6ga-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `type` | string | 否 | `1` | 市场类型：`1`-沪深全市场，`2`-沪深主板，`3`-上证A股，`4`-深圳A股，`5`-创业板，`6`-中小板，`7`-科创版 |
| `sortField` | string | 否 | `px_change_rate` | 排序字段：`px_change_rate`-涨跌幅，`fundflow`-净流入，`turnover_ratio`-换手率，`volume_ratio`-量比，`turnover_value`-成交额 |
| `orderBy` | string | 否 | `desc` | 排序方式：`desc`-倒序，`asc`-正序 |
| `pageNo` | string | 否 | `1` | 页码 |
| `pageSize` | string | 否 | `10` | 返回数量 |

---

## 响应字段

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `taskNo` | string | 本次请求号 |
| `data.candle[]` | array | 股票排行数组，每项为数组 |
| `data.fields[]` | array | candle 中每列的字段名 |
| `data.count` | number | 总记录数 |
| `data.limit` | number | 每页返回数量 |
| `data.page` | number | 当前页码 |
| `data.type` | number | 市场类型 |

`data.fields` 顺序说明（与 `candle` 数组各元素一一对应）：

| 索引 | 字段名 | 说明 |
|------|--------|------|
| 0 | `prod_code` | 股票代码，如 `301611.SZ` |
| 1 | `prod_name` | 股票名称 |
| 2 | `last_px` | 最新价 |
| 3 | `px_change_rate` | 涨跌幅（%） |
| 4 | `fundflow` | 净流入 |
| 5 | `volume_ratio` | 量比 |
| 6 | `turnover_ratio` | 换手率（%） |
| 7 | `turnover_value` | 成交额 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface StockRankData {
  candle: (string | number)[][];
  fields: string[];
  count: number;
  limit: number;
  page: number;
  type: number;
}

/**
 * 获取沪深股票排行榜。
 * @param type - 市场类型，默认 1（沪深全市场）
 * @param sortField - 排序字段，默认 px_change_rate
 * @param orderBy - 排序方式，默认 desc
 * @param pageNo - 页码，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 股票排行数据
 */
async function fetchStockRank(
  type = "1",
  sortField = "px_change_rate",
  orderBy: "desc" | "asc" = "desc",
  pageNo = "1",
  pageSize = "10"
): Promise<StockRankData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-wLNdo2j5e6ga-gateway.appmiaoda.com/stock/hs/rank",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ type, sortField, orderBy, pageNo, pageSize }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as StockRankData;
}

// 使用示例：查询沪深全市场涨幅榜前10
const result = await fetchStockRank("1", "px_change_rate", "desc", "1", "10");
console.log("涨幅榜 fields:", result.fields);
console.log("top10:", result.candle);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-rank.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let type: string;
  let sortField: string;
  let orderBy: string;
  let pageNo: string;
  let pageSize: string;
  try {
    const body = await req.json();
    type = body.type ?? "1";
    sortField = body.sortField ?? "px_change_rate";
    orderBy = body.orderBy ?? "desc";
    pageNo = body.pageNo ?? "1";
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
    "https://app-cblk1rqa5fk1-api-wLNdo2j5e6ga-gateway.appmiaoda.com/stock/hs/rank",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ type, sortField, orderBy, pageNo, pageSize }).toString(),
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
 * 查询沪深股票排行榜。
 * @param type - 市场类型，默认 1
 * @param sortField - 排序字段，默认 px_change_rate
 * @param orderBy - 排序方式，默认 desc
 * @param pageNo - 页码，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 股票排行数据
 */
async function fetchStockRank(
  type = "1",
  sortField = "px_change_rate",
  orderBy = "desc",
  pageNo = "1",
  pageSize = "10"
) {
  const { data, error } = await supabase.functions.invoke("stock-rank", {
    body: { type, sortField, orderBy, pageNo, pageSize },
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
- **candle 解析：** `candle` 是混合类型数组，第 0 项为股票代码（string），其余为数值，按 `fields` 顺序读取。
