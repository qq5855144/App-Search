# 沪深分时成交 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-baBwZEjbeNP9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-baBwZEjbeNP9-gateway.appmiaoda.com/stock/hs/tick` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-baBwZEjbeNP9-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `code` | string | 是 | 品种代码，如 `000001.SZ`，可从股票排行或板块排行接口获取 |

---

## 响应字段

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `taskNo` | string | 本次请求号 |
| `data.list[]` | array | 逐笔成交列表，每项为格式化字符串 |

`data.list` 每项字符串格式为：`时间(HH:mm:ss),成交价,成交量,单数,涨跌`

| 位置 | 含义 | 示例 |
|------|------|------|
| 0（逗号分隔） | 成交时间 | `14:56:18` |
| 1 | 成交价 | `37.29` |
| 2 | 成交量（手） | `50` |
| 3 | 单数 | `24` |
| 4 | 涨跌（1-上涨，2-下跌，3-平） | `1` |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface TickData {
  list: string[];
}

/**
 * 获取沪深股票逐笔成交数据。
 * @param code - 品种代码，如 000001.SZ
 * @returns 逐笔成交列表，每项格式为"时间,成交价,成交量,单数,涨跌"
 */
async function fetchTick(code: string): Promise<TickData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-baBwZEjbeNP9-gateway.appmiaoda.com/stock/hs/tick",
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

  return json.data as TickData;
}

// 使用示例
const tickData = await fetchTick("000001.SZ");
for (const item of tickData.list) {
  const [time, price, volume, count, direction] = item.split(",");
  console.log(`${time} 成交价=${price} 量=${volume} 方向=${direction}`);
}
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-tick.ts
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
    "https://app-cblk1rqa5fk1-api-baBwZEjbeNP9-gateway.appmiaoda.com/stock/hs/tick",
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

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 查询沪深股票逐笔成交数据。
 * @param code - 品种代码，如 000001.SZ
 * @returns 逐笔成交列表
 */
async function fetchTick(code: string) {
  const { data, error } = await supabase.functions.invoke("stock-tick", {
    body: { code },
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
- **数据解析：** `list` 每项是逗号分隔字符串，需按位置解析各字段。
- **数据时效：** 为当日实时逐笔成交，非历史数据。
