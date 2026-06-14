---
name: webpage-summarizer
description: 访问并分析网页内容，生成总结或回答网页相关问题；适用于新闻摘要、文章总结、网页内容问答等场景
license: MIT
---

## 能力概述

调用千帆平台的网页内容总结组件，访问指定 URL 的网页并生成内容分析/总结文本。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-DY8MNXjBpKAa-gateway.appmiaoda.com/v2/components/c-wf-e1bc471f-1d33-4df1-ab42-87800e89c1ad`
- **认证方式**: platform_managed（密钥由平台注入，Header: `X-Gateway-Authorization: Bearer <key>`）
- **Content-Type**: `application/json`
- **响应格式**: JSON，分析结果在 `content[0].raw_data.origin_response.node_content[0].outputs.output`
- **超时限制**: apiClient timeout 60s
- **支持平台**: Web、MiniProgram

### 典型响应示例

```json
{
  "content": [
    {
      "raw_data": {
        "origin_response": {
          "node_content": [
            {
              "outputs": {
                "output": "网页内容分析：\n\n第一个网页是新浪体育的新闻页面，主要报道了国内足球比赛的相关新闻..."
              }
            }
          ]
        }
      },
      "event": {
        "error_code_int": 0,
        "error_message": ""
      }
    }
  ]
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 调用网页内容总结接口，分析指定网页并返回总结文本。
 *
 * @param sysOriginQuery - 用户诉求描述，例如"请帮我分析下网页的内容"
 * @param webUrl - 待分析的网页 URL 列表，当前只支持一个地址
 * @returns 网页内容分析/总结文本
 */
async function callWebPageSummary(
  sysOriginQuery: string,
  webUrl: string[]
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DY8MNXjBpKAa-gateway.appmiaoda.com/v2/components/c-wf-e1bc471f-1d33-4df1-ab42-87800e89c1ad",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        parameters: {
          _sys_origin_query: sysOriginQuery,
          web_url: webUrl,
        },
      }),
      signal: AbortSignal.timeout(60_000), // 平台要求 timeout 60s
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  const event = json?.content?.[0]?.event;
  if (event?.error_code_int !== 0) {
    throw new Error(`API error ${event?.error_code_int}: ${event?.error_message}`);
  }

  return json.content[0].raw_data.origin_response.node_content[0].outputs.output as string;
}

// 使用示例
const summary = await callWebPageSummary(
  "请帮我总结这篇文章的主要内容",
  ["https://example.com/article"]
);
console.log(summary);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/webpage-summarizer.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * 处理前端请求，转发至千帆网页内容总结接口并返回分析结果。
   * 注入平台密钥，避免在前端暴露 INTEGRATIONS_API_KEY。
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let sysOriginQuery: string;
  let webUrl: string[];
  try {
    const body = await req.json();
    sysOriginQuery = body.sysOriginQuery;
    webUrl = body.webUrl;
    if (!sysOriginQuery) throw new Error("Missing sysOriginQuery");
    if (!webUrl || !Array.isArray(webUrl) || webUrl.length === 0) {
      throw new Error("Missing or invalid webUrl");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露至前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  let upstream: Response;
  try {
    upstream = await fetch(
      "https://app-cblk1rqa5fk1-api-DY8MNXjBpKAa-gateway.appmiaoda.com/v2/components/c-wf-e1bc471f-1d33-4df1-ab42-87800e89c1ad",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          parameters: {
            _sys_origin_query: sysOriginQuery,
            web_url: webUrl,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: `Upstream fetch failed: ${(e as Error).message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 透传配额/余额错误
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

### 前端调用代码

**推荐方式（supabase client 可用时，Web 和 MiniProgram 通用）：**

```typescript
/**
 * 通过 Edge Function 调用网页内容总结接口。
 *
 * @param sysOriginQuery - 用户诉求描述
 * @param webUrl - 待分析的网页 URL 列表（当前只支持一个地址）
 * @returns 完整的 API 响应 JSON
 */
async function fetchWebPageSummary(
  sysOriginQuery: string,
  webUrl: string[]
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("webpage-summarizer", {
    body: { sysOriginQuery, webUrl },
  });
  if (error) throw error;

  const event = data?.content?.[0]?.event;
  if (event?.error_code_int !== 0) {
    throw new Error(`API 错误 ${event?.error_code_int}：${event?.error_message}`);
  }

  return data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchWebPageSummary(
  sysOriginQuery: string,
  webUrl: string[]
): Promise<unknown> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webpage-summarizer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sysOriginQuery, webUrl }),
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
  const event = json?.content?.[0]?.event;
  if (event?.error_code_int !== 0) {
    throw new Error(`API 错误 ${event?.error_code_int}：${event?.error_message}`);
  }

  return json;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `_sys_origin_query` | `string` | 是 | 用户诉求描述，例如"请帮我分析下网页的内容" |
| `web_url` | `array` | 是 | 待分析的网页 URL 列表，当前只支持添加一个地址 |

> 以上参数包裹在请求体的 `parameters` 对象中，示例：`{ "parameters": { "_sys_origin_query": "...", "web_url": ["..."] } }`

### 返回字段说明

**成功响应：**

| 字段路径 | 类型 | 说明 |
|---|---|---|
| `content[0].raw_data.origin_response.node_content[0].outputs.output` | `string` | 网页内容分析/总结文本 |
| `content[0].event.error_code_int` | `number` | 错误码，`0` 表示成功 |
| `content[0].event.error_message` | `string` | 错误信息，成功时为空字符串 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|---|---|---|
| `content[0].event.error_code_int` | `number` | 非 0 的错误码 |
| `content[0].event.error_message` | `string` | 错误描述信息 |

---

## 注意事项

- **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **超时设置**: 上游接口要求 apiClient timeout 60s，Edge Function 和生成期调用均需设置 `AbortSignal.timeout(60_000)`。
- **URL 数量限制**: `web_url` 数组当前只支持一个地址，传入多个地址可能导致异常。
- **错误处理**: 务必检查 `content[0].event.error_code_int` 是否为 0，同时处理 HTTP 429（配额超限）和 402（余额不足）。
- **计费**: 此插件当前免费（`original_price: "0"`，`enable_billing: false`），但 `need_count_calls: true`，调用次数会被统计，避免不必要的重复调用。
- **Plugin ID**: `c3f8d97a-7532-4927-9467-cb79344ae5eb`
- **API ID**: `api-DY8MNXjBpKAa`
