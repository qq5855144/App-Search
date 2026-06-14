# A股停牌信息查询 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `ea9ecacf-f5ab-4c56-9ed7-2fadaf6e62cc` |
| API ID | `api-qYGWoqjEKyzY` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-qYGWoqjEKyzY-gateway.appmiaoda.com/stock/a/stop` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party domain | `app-cblk1rqa5fk1-api-qYGWoqjEKyzY-gateway.appmiaoda.com` |
| 计费 | 启用，折扣价 ¥0.13/次，原价 ¥0.20/次 |

---

## 请求参数

本接口无需请求参数，直接 POST 即可返回全量停牌股票列表。

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
| `data.list[]` | array | 停牌股票列表 |
| `data.list[].market` | string | 所属市场，如"上交所风险警示板" |
| `data.list[].stock_code` | string | 股票代码，如 `600213` |
| `data.list[].stock_name` | string | 股票名称 |
| `data.list[].reason` | string | 停牌原因 |
| `data.list[].begin_time` | string | 停牌开始时间，格式 `YYYY-MM-DD HH:mm:ss` |
| `data.list[].end_time` | string | 停牌结束时间 |
| `data.list[].estimated_time` | string | 预计复牌时间 |
| `data.list[].time_limit` | string | 停牌期限，如"停牌一天"、"连续停牌" |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 的错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface StopItem {
  market: string;
  stock_code: string;
  stock_name: string;
  reason: string;
  begin_time: string;
  end_time: string;
  estimated_time: string;
  time_limit: string;
}

/**
 * 获取 A 股市场所有停牌股票信息。
 * @returns 停牌股票列表
 */
async function fetchAStopList(): Promise<StopItem[]> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-qYGWoqjEKyzY-gateway.appmiaoda.com/stock/a/stop",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data.list as StopItem[];
}

// 使用示例
const stopList = await fetchAStopList();
console.log(`当前共 ${stopList.length} 只停牌股票：`, stopList);
```

---

## Edge Function 代码

```typescript
// edge-functions/stock-a-stop.ts
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
    "https://app-cblk1rqa5fk1-api-qYGWoqjEKyzY-gateway.appmiaoda.com/stock/a/stop",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
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
 * 查询 A 股停牌股票列表。
 * @returns 停牌股票列表
 */
async function fetchAStopList() {
  const { data, error } = await supabase.functions.invoke("stock-a-stop", {
    body: {},
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
- **数据说明：** 返回当日全量停牌股票，`estimated_time` 仅供参考，实际复牌以交易所公告为准。
