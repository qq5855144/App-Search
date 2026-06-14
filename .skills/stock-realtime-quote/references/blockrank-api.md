# 沪深板块排名 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-zYkZz8qovO1L` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-zYkZz8qovO1L-gateway.appmiaoda.com/stock/hs/blockrank` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-zYkZz8qovO1L-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `type` | string | 是 | — | 板块类型：`1`-地域板块，`2`-行业板块，`3`-概念板块 |
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
| `data.candle[]` | array | 板块列表 |
| `data.candle[].block_code` | string | 板块代码 |
| `data.candle[].block_name` | string | 板块名称 |
| `data.candle[].last_px` | number | 最新价 |
| `data.candle[].px_change` | number | 价格涨跌 |
| `data.candle[].px_change_rate` | number | 涨跌幅（%） |
| `data.candle[].open_px` | number | 开盘价 |
| `data.candle[].high_px` | number | 最高价 |
| `data.candle[].low_px` | number | 最低价 |
| `data.candle[].preclose_px` | number | 昨收价 |
| `data.candle[].member_count` | number | 板块成员数量 |
| `data.candle[].rise_count` | number | 上涨股票数量 |
| `data.candle[].fall_count` | number | 下跌股票数量 |
| `data.candle[].update_time` | number | 数据时间戳（Unix） |
| `data.count` | number | 总记录数 |
| `data.limit` | number | 每页返回数量 |
| `data.page` | number | 当前页码 |
| `data.type` | number | 板块类型 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface BlockRankItem {
  block_code: string;
  block_name: string;
  last_px: number;
  px_change: number;
  px_change_rate: number;
  open_px: number;
  high_px: number;
  low_px: number;
  preclose_px: number;
  member_count: number;
  rise_count: number;
  fall_count: number;
  update_time: number;
}

interface BlockRankData {
  candle: BlockRankItem[];
  count: number;
  limit: number;
  page: number;
  type: number;
}

/**
 * 获取沪深板块排名信息。
 * @param type - 板块类型：1-地域板块，2-行业板块，3-概念板块
 * @param pageNo - 页码，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 板块排名数据
 */
async function fetchBlockRank(
  type: "1" | "2" | "3",
  pageNo = "1",
  pageSize = "10"
): Promise<BlockRankData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-zYkZz8qovO1L-gateway.appmiaoda.com/stock/hs/blockrank",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ type, pageNo, pageSize }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as BlockRankData;
}

// 使用示例
const result = await fetchBlockRank("2", "1", "10");
console.log(`行业板块共 ${result.count} 条，当前页：`, result.candle);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-blockrank.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let type: string;
  let pageNo: string;
  let pageSize: string;
  try {
    const body = await req.json();
    type = body.type;
    if (!type) throw new Error("Missing type");
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
    "https://app-cblk1rqa5fk1-api-zYkZz8qovO1L-gateway.appmiaoda.com/stock/hs/blockrank",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ type, pageNo, pageSize }).toString(),
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
 * 查询沪深板块排名。
 * @param type - 板块类型：1-地域，2-行业，3-概念
 * @param pageNo - 页码，默认 1
 * @param pageSize - 返回数量，默认 10
 * @returns 板块排名数据
 */
async function fetchBlockRank(
  type: "1" | "2" | "3",
  pageNo = "1",
  pageSize = "10"
) {
  const { data, error } = await supabase.functions.invoke("stock-blockrank", {
    body: { type, pageNo, pageSize },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无 supabase client）：**

```typescript
async function fetchBlockRank(
  type: "1" | "2" | "3",
  pageNo = "1",
  pageSize = "10"
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stock-blockrank`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, pageNo, pageSize }),
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
- **计费：** 每次调用计费，折扣价 ¥0.13/次，避免无效重复请求。
- **板块代码：** `block_code`（如 `BK1037`）可传入沪深板块成分股接口（`/stock/hs/blocklist`）查询成分股列表。
