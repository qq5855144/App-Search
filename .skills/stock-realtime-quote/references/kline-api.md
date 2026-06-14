# 沪深K线 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-oLpZ74noWmBa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-oLpZ74noWmBa-gateway.appmiaoda.com/stock/hs/kline` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-oLpZ74noWmBa-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `code` | string | 是 | — | 品种代码，如 `000001.SZ` |
| `period` | string | 是 | — | K线类型：`1`-1分钟，`5`-5分钟，`15`-15分钟，`30`-30分钟，`60`-60分钟，`101`-日K，`102`-周K，`103`-月K，`104`-季K，`105`-半年K，`106`-年K |
| `fuquan` | string | 是 | — | 复权状态：`0`-不复权，`1`-前复权，`2`-后复权 |
| `pageSize` | string | 否 | `10` | 返回数量 |

---

## 响应字段

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `taskNo` | string | 本次请求号 |
| `data.code` | string | 品种代码 |
| `data.type` | string | 数据类型，如 `stock` |
| `data.candle[]` | array | K线数组，每项为数值数组 |
| `data.fields[]` | array | candle 中每列的字段名 |

`data.fields` 顺序说明（与 `candle` 数组各元素一一对应）：

| 索引 | 字段名 | 说明 |
|------|--------|------|
| 0 | `tick_at` | 时间戳（Unix） |
| 1 | `open_px` | 开盘价 |
| 2 | `close_px` | 收盘价 |
| 3 | `high_px` | 最高价 |
| 4 | `low_px` | 最低价 |
| 5 | `turnover_volume` | 成交量 |
| 6 | `turnover_value` | 成交额 |
| 7 | `px_change` | 涨跌额 |
| 8 | `px_change_rate` | 涨跌率（%） |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface KLineData {
  code: string;
  type: string;
  candle: number[][];
  fields: string[];
}

/**
 * 获取沪深股票 K 线数据。
 * @param code - 品种代码，如 000001.SZ
 * @param period - K 线类型，如 101 为日 K
 * @param fuquan - 复权：0-不复权，1-前复权，2-后复权
 * @param pageSize - 返回数量，默认 10
 * @returns K 线数据（candle 数组 + fields 说明）
 */
async function fetchKLine(
  code: string,
  period: string,
  fuquan: "0" | "1" | "2",
  pageSize = "10"
): Promise<KLineData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-oLpZ74noWmBa-gateway.appmiaoda.com/stock/hs/kline",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ code, period, fuquan, pageSize }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as KLineData;
}

// 使用示例：查询平安银行日K（前复权）最近10条
const result = await fetchKLine("000001.SZ", "101", "1", "10");
console.log("fields:", result.fields);
console.log("candle:", result.candle);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-kline.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let code: string;
  let period: string;
  let fuquan: string;
  let pageSize: string;
  try {
    const body = await req.json();
    code = body.code;
    period = body.period;
    fuquan = body.fuquan;
    if (!code) throw new Error("Missing code");
    if (!period) throw new Error("Missing period");
    if (fuquan === undefined || fuquan === null) throw new Error("Missing fuquan");
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
    "https://app-cblk1rqa5fk1-api-oLpZ74noWmBa-gateway.appmiaoda.com/stock/hs/kline",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ code, period, fuquan, pageSize }).toString(),
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
 * 查询沪深 K 线数据。
 * @param code - 品种代码，如 000001.SZ
 * @param period - K 线类型，如 101 日 K
 * @param fuquan - 复权：0/1/2
 * @param pageSize - 返回数量，默认 10
 * @returns K 线数据
 */
async function fetchKLine(
  code: string,
  period: string,
  fuquan: string,
  pageSize = "10"
) {
  const { data, error } = await supabase.functions.invoke("stock-kline", {
    body: { code, period, fuquan, pageSize },
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
- **candle 解析：** `candle` 是数值数组，`fields` 字段描述每个索引的含义，按 fields 顺序读取 candle 元素。
- **period 说明：** 分钟K（1/5/15/30/60）为分钟级，101-106 为日/周/月/季/半年/年K。
