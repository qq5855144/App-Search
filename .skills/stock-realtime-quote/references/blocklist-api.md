# 沪深板块成分股排行 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-Xa6JZxjyPlNa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Xa6JZxjyPlNa-gateway.appmiaoda.com/stock/hs/blocklist` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-Xa6JZxjyPlNa-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `blockCode` | string | 是 | — | 板块代码，从板块排行接口获取，如 `BK0736` |
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
| `data.candle[]` | array | 成分股列表 |
| `data.candle[].prod_code` | string | 产品代码，如 `300050.SZ` |
| `data.candle[].prod_name` | string | 产品名称 |
| `data.candle[].last_px` | number | 最新价 |
| `data.candle[].px_change` | number | 价格涨跌 |
| `data.candle[].px_change_rate` | number | 涨跌幅（%） |
| `data.candle[].open_px` | number | 开盘价 |
| `data.candle[].high_px` | number | 最高价 |
| `data.candle[].low_px` | number | 最低价 |
| `data.candle[].preclose_px` | number | 昨收价 |
| `data.candle[].update_time` | number | 数据时间戳（Unix） |
| `data.count` | number | 总记录数 |
| `data.page` | number | 当前页码 |
| `data.limit` | number | 每页返回数量 |
| `data.block_code` | string | 查询的板块代码 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface BlockListItem {
  prod_code: string;
  prod_name: string;
  last_px: number;
  px_change: number;
  px_change_rate: number;
  open_px: number;
  high_px: number;
  low_px: number;
  preclose_px: number;
  update_time: number;
}

interface BlockListData {
  candle: BlockListItem[];
  count: number;
  page: number;
  limit: number;
  block_code: string;
}

/**
 * 获取沪深板块成分股排行信息。
 * @param blockCode - 板块代码，如 BK0736，可从板块排名接口获取
 * @param pageNo - 页码，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 板块成分股排行数据
 */
async function fetchBlockList(
  blockCode: string,
  pageNo = "1",
  pageSize = "10"
): Promise<BlockListData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyPlNa-gateway.appmiaoda.com/stock/hs/blocklist",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ blockCode, pageNo, pageSize }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as BlockListData;
}

// 使用示例
const result = await fetchBlockList("BK0736", "1", "10");
console.log(`板块 ${result.block_code} 共 ${result.count} 只成分股：`, result.candle);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-blocklist.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let blockCode: string;
  let pageNo: string;
  let pageSize: string;
  try {
    const body = await req.json();
    blockCode = body.blockCode;
    if (!blockCode) throw new Error("Missing blockCode");
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
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyPlNa-gateway.appmiaoda.com/stock/hs/blocklist",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ blockCode, pageNo, pageSize }).toString(),
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
 * 查询沪深板块成分股排行。
 * @param blockCode - 板块代码，如 BK0736
 * @param pageNo - 页码，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 成分股排行数据
 */
async function fetchBlockList(blockCode: string, pageNo = "1", pageSize = "10") {
  const { data, error } = await supabase.functions.invoke("stock-blocklist", {
    body: { blockCode, pageNo, pageSize },
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
- **板块代码来源：** `blockCode` 需从板块排名接口（`/stock/hs/blockrank`）的 `block_code` 字段获取。
