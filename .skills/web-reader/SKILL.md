---
name: web-reader
description: 抓取任意 URL 的网页内容并返回干净的 Markdown 文本，适用于用户分享链接需要阅读、分析、摘要或翻译网页内容的场景。
license: MIT
---

## 能力概述

基于 AWS Lambda 部署的 Jina AI Reader 代理服务，通过 JWT 鉴权抓取并解析目标网页内容，自动清除广告、导航、脚本等噪声，返回结构化的 Markdown 格式文本。

| 项目 | 说明 |
|------|------|
| Endpoint | `GET https://app-cblk1rqa5fk1-api-ELbWqODdAgNY-gateway.appmiaoda.com/{url}` |
| 响应格式 | `text/plain`（默认 Markdown） |
| 鉴权方式 | platform_managed（`INTEGRATIONS_API_KEY`） |

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | string | 是 | 目标网页的完整 URL，直接拼接在 Base URL 后 |

**可选请求头（控制输出行为）：**

| 请求头 | 类型 | 说明 |
|--------|------|------|
| `X-Return-Format` | string | 返回格式：`markdown`（默认）/ `html` / `text` / `screenshot` / `pageshot` |
| `X-With-Images-Summary` | boolean | 是否附加图片描述摘要 |
| `X-With-Links-Summary` | boolean | 是否附加链接汇总 |
| `X-Target-Selector` | string | CSS 选择器，仅提取特定元素内容 |
| `X-Remove-Selector` | string | CSS 选择器，移除特定元素 |
| `X-Timeout` | number | 页面加载超时时间（秒） |
| `X-No-Cache` | boolean | 设为 `true` 禁用缓存，强制重新抓取 |
| `Accept` | string | 设为 `text/event-stream` 开启流式响应（SSE） |

**响应示例：**

```
Title: Example Domain

URL Source: http://example.com

Markdown Content:
# Example Domain

This domain is for use in illustrative examples in documents...
```

**响应头：**

| 响应头 | 说明 |
|--------|------|
| `Content-Type` | `text/plain; charset=utf-8` |
| `x-usage-tokens` | 本次请求消耗的 Token 数量 |
| `cf-cache-status` | Cloudflare 缓存状态 |
| `x-amzn-RequestId` | AWS Lambda 请求 ID |

**错误码：**

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功，响应体为解析后的 Markdown 文本 |
| 401 | JWT Token 缺失或无效 |
| 403 | Token 有效但目标 URL 被 GFW 过滤 |

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 抓取目标网页并返回 Markdown 格式的正文内容。
 * @param targetUrl - 目标网页的完整 URL
 * @param options - 可选的输出控制参数
 * @param options.returnFormat - 返回格式，默认 markdown
 * @param options.withImagesSummary - 是否附加图片摘要
 * @param options.withLinksSummary - 是否附加链接汇总
 * @param options.targetSelector - CSS 选择器，仅提取特定元素
 * @param options.removeSelector - CSS 选择器，移除特定元素
 * @param options.timeout - 页面加载超时时间（秒）
 * @param options.noCache - 是否禁用缓存
 * @param options.accept - Accept 请求头，设为 `text/event-stream` 可开启 SSE 流式模式，默认 `text/html`
 * @returns 网页的 Markdown 文本内容（非流式）或 SSE 流（流式）
 */
async function fetchWebPage(
  targetUrl: string,
  options?: {
    returnFormat?: "markdown" | "html" | "text" | "screenshot" | "pageshot";
    withImagesSummary?: boolean;
    withLinksSummary?: boolean;
    targetSelector?: string;
    removeSelector?: string;
    timeout?: number;
    noCache?: boolean;
    accept?: "text/html" | "text/event-stream";
  }
): Promise<string> {
  const encodedUrl = encodeURIComponent(targetUrl);
  const endpoint =
    `https://app-cblk1rqa5fk1-api-ELbWqODdAgNY-gateway.appmiaoda.com/${encodedUrl}`;

  const headers: Record<string, string> = {
    "X-Gateway-Authorization": `Bearer ${apiKey}`,
  };

  if (options?.returnFormat) headers["X-Return-Format"] = options.returnFormat;
  if (options?.withImagesSummary !== undefined) {
    headers["X-With-Images-Summary"] = String(options.withImagesSummary);
  }
  if (options?.withLinksSummary !== undefined) {
    headers["X-With-Links-Summary"] = String(options.withLinksSummary);
  }
  if (options?.targetSelector) headers["X-Target-Selector"] = options.targetSelector;
  if (options?.removeSelector) headers["X-Remove-Selector"] = options.removeSelector;
  if (options?.timeout !== undefined) headers["X-Timeout"] = String(options.timeout);
  if (options?.noCache) headers["X-No-Cache"] = "true";
  if (options?.accept) headers["Accept"] = options.accept;

  const response = await fetch(endpoint, { method: "GET", headers });

  if (response.status === 401) throw new Error("鉴权失败：JWT Token 缺失或无效");
  if (response.status === 403) throw new Error("目标 URL 被 GFW 过滤，无法访问");
  if (!response.ok) throw new Error(`HTTP 错误：${response.status}`);

  return await response.text();
}

// 使用示例
const markdown = await fetchWebPage("https://example.com", {
  withLinksSummary: true,
});
console.log(markdown);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function 代码

```typescript
// edge-functions/web-reader.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * Web Reader Edge Function
   * 接收前端请求，注入平台密钥后转发至上游 Jina Reader 服务。
   * 请求体：{ url: string, options?: {...} }
   * 响应：{ content: string }
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let targetUrl: string;
  let returnFormat: string | undefined;
  let withImagesSummary: boolean | undefined;
  let withLinksSummary: boolean | undefined;
  let targetSelector: string | undefined;
  let removeSelector: string | undefined;
  let timeout: number | undefined;
  let noCache: boolean | undefined;

  try {
    const body = await req.json();
    targetUrl = body.url;
    if (!targetUrl) throw new Error("Missing url");
    returnFormat = body.returnFormat;
    withImagesSummary = body.withImagesSummary;
    withLinksSummary = body.withLinksSummary;
    targetSelector = body.targetSelector;
    removeSelector = body.removeSelector;
    timeout = body.timeout;
    noCache = body.noCache;
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

  // --- 构造请求头 ---
  const upstreamHeaders: Record<string, string> = {
    "X-Gateway-Authorization": `Bearer ${apiKey}`,
  };
  if (returnFormat) upstreamHeaders["X-Return-Format"] = returnFormat;
  if (withImagesSummary !== undefined) {
    upstreamHeaders["X-With-Images-Summary"] = String(withImagesSummary);
  }
  if (withLinksSummary !== undefined) {
    upstreamHeaders["X-With-Links-Summary"] = String(withLinksSummary);
  }
  if (targetSelector) upstreamHeaders["X-Target-Selector"] = targetSelector;
  if (removeSelector) upstreamHeaders["X-Remove-Selector"] = removeSelector;
  if (timeout !== undefined) upstreamHeaders["X-Timeout"] = String(timeout);
  if (noCache) upstreamHeaders["X-No-Cache"] = "true";

  // --- 调用上游服务 ---
  const encodedUrl = encodeURIComponent(targetUrl);
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-ELbWqODdAgNY-gateway.appmiaoda.com/${encodedUrl}`,
    { method: "GET", headers: upstreamHeaders }
  );

  // 转发鉴权/过滤错误
  if (upstream.status === 401 || upstream.status === 403) {
    const errText = await upstream.text();
    return new Response(JSON.stringify({ error: errText || `Upstream error: ${upstream.status}` }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 转发配额/余额错误
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

  const content = await upstream.text();
  return new Response(JSON.stringify({ content }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 前端调用代码（Web / MiniProgram 通用）

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 抓取网页内容。
 * @param url - 目标网页完整 URL
 * @param options - 可选的输出控制参数
 * @returns 网页 Markdown 文本
 */
async function fetchWebPage(
  url: string,
  options?: {
    returnFormat?: "markdown" | "html" | "text" | "screenshot" | "pageshot";
    withImagesSummary?: boolean;
    withLinksSummary?: boolean;
    targetSelector?: string;
    removeSelector?: string;
    timeout?: number;
    noCache?: boolean;
  }
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("web-reader", {
    body: { url, ...options },
  });
  if (error) throw error;
  if (!data?.content) throw new Error("返回内容为空");
  return data.content;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 抓取网页内容。
 * @param url - 目标网页完整 URL
 * @param options - 可选的输出控制参数
 * @returns 网页 Markdown 文本
 */
async function fetchWebPage(
  url: string,
  options?: {
    returnFormat?: "markdown" | "html" | "text";
    withImagesSummary?: boolean;
    withLinksSummary?: boolean;
    targetSelector?: string;
    removeSelector?: string;
    timeout?: number;
    noCache?: boolean;
  }
): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-reader`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, ...options }),
  });

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
  if (!json.content) throw new Error("返回内容为空");
  return json.content;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | string | 是 | 目标网页的完整 URL，含 scheme（如 `https://example.com`） |
| `returnFormat` | string | 否 | 返回格式：`markdown`（默认）/ `html` / `text` / `screenshot` / `pageshot` |
| `withImagesSummary` | boolean | 否 | 是否在内容中附加图片描述摘要 |
| `withLinksSummary` | boolean | 否 | 是否在内容末尾附加链接汇总 |
| `targetSelector` | string | 否 | CSS 选择器，仅提取页面特定元素内容 |
| `removeSelector` | string | 否 | CSS 选择器，从结果中移除特定元素 |
| `timeout` | number | 否 | 等待页面加载的超时时间（秒） |
| `noCache` | boolean | 否 | 设为 `true` 禁用缓存，强制重新抓取 |
| `accept` | string | 否 | 请求头 `Accept` 值：`text/html`（默认）或 `text/event-stream`（开启 SSE 流式模式） |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `content` | string | 目标网页的结构化 Markdown 文本，包含标题、正文及可选的图片摘要、链接列表 |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 401（Token 无效）、403（GFW 过滤）、429（配额超限）和 402（余额不足）。
- **计费**：本插件免费（`original_price: 0.00`，`enable_billing: false`），但仍会统计调用次数。
- **GFW 过滤**：JWT Payload 中的 `filter_gfw` 字段控制是否过滤 GFW 屏蔽域名，被过滤的 URL 将返回 403。
- **URL 编码**：目标 URL 需经过 `encodeURIComponent` 编码后再拼接到路径中，避免特殊字符导致路由解析错误。
- **响应格式**：默认返回 `text/plain` 格式的 Markdown，Edge Function 已将其包装为 `{ content: string }` JSON，方便前端直接使用。
- **流式响应**：如需流式接收内容，可在请求头中设置 `Accept: text/event-stream`，SSE 流式处理实现见下方"SSE 流式处理"章节。

---

## SSE 流式处理

当请求头设置 `Accept: text/event-stream` 时，上游服务以 SSE（Server-Sent Events）格式流式返回内容，每个 SSE 事件携带部分 Markdown 文本。流式模式适用于大页面实时渲染场景。

### SSE 事件格式

```
data: <部分 Markdown 文本>

data: <更多 Markdown 文本>

data: [DONE]

```

- 每条 `data:` 行携带一段内容片段。
- 收到 `data: [DONE]` 表示流结束。

### 生成期 SSE 流式调用示例

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 以 SSE 流式模式抓取目标网页，实时处理返回的 Markdown 片段。
 * @param targetUrl - 目标网页的完整 URL
 * @param onChunk - 每收到一段内容时的回调函数
 * @returns 完整 Markdown 文本
 */
async function fetchWebPageSSE(
  targetUrl: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const encodedUrl = encodeURIComponent(targetUrl);
  const endpoint =
    `https://app-cblk1rqa5fk1-api-ELbWqODdAgNY-gateway.appmiaoda.com/${encodedUrl}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
      "Accept": "text/event-stream",
    },
  });

  if (response.status === 401) throw new Error("鉴权失败：JWT Token 缺失或无效");
  if (response.status === 403) throw new Error("目标 URL 被 GFW 过滤，无法访问");
  if (!response.ok) throw new Error(`HTTP 错误：${response.status}`);
  if (!response.body) throw new Error("响应体为空，无法读取流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") break;
      if (payload) {
        fullContent += payload;
        onChunk?.(payload);
      }
    }
  }

  return fullContent;
}

// 示例：流式抓取并实时打印
await fetchWebPageSSE("https://example.com", (chunk) => {
  Deno.stdout.write(new TextEncoder().encode(chunk));
});
```

### 前端 SSE 流式调用示例（Web 平台）

前端需通过 Edge Function 中转流式请求，Edge Function 需将上游 SSE 流透传给客户端。

```typescript
/**
 * 通过 Edge Function SSE 代理抓取网页，实时处理内容片段。
 * @param url - 目标网页完整 URL
 * @param onChunk - 每收到一段内容时的回调函数
 * @returns 完整 Markdown 文本
 */
async function fetchWebPageStream(
  url: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-reader`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  if (!res.body) throw new Error("响应体为空");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") break;
      if (payload) {
        fullContent += payload;
        onChunk?.(payload);
      }
    }
  }

  return fullContent;
}
```
