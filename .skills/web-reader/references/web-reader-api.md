# Web Reader API

## API 基本信息

| 字段 | 值 |
|------|----|
| API ID | `api-ELbWqODdAgNY` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-ELbWqODdAgNY-gateway.appmiaoda.com/{url}` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 响应格式 | `text/plain`（默认 Markdown）或 `text/event-stream`（SSE 流式） |
| 计费 | 免费（`enable_billing: false`） |

---

## 请求参数表

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | string | 是 | 目标网页的完整 URL，使用 `encodeURIComponent` 编码后直接拼接在 Base URL 后 |

### 请求头参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-Gateway-Authorization` | string | 是 | 平台注入的鉴权 Token，格式：`Bearer ${INTEGRATIONS_API_KEY}` |
| `Accept` | string | 否 | 响应类型：`text/html`（默认，普通响应）或 `text/event-stream`（开启 SSE 流式模式） |
| `X-Return-Format` | string | 否 | 返回格式：`markdown`（默认）/ `html` / `text` / `screenshot` / `pageshot` |
| `X-With-Images-Summary` | boolean | 否 | 是否附加图片描述摘要 |
| `X-With-Links-Summary` | boolean | 否 | 是否附加链接汇总 |
| `X-Target-Selector` | string | 否 | CSS 选择器，仅提取页面特定元素内容 |
| `X-Remove-Selector` | string | 否 | CSS 选择器，从结果中移除特定元素 |
| `X-Timeout` | number | 否 | 页面加载超时时间（秒） |
| `X-No-Cache` | boolean | 否 | 设为 `true` 禁用缓存，强制重新抓取 |

---

## 响应格式

### 普通响应（默认，`Accept: text/html`）

HTTP 200，响应体为 `text/plain` 格式的 Markdown 文本，包含：

```
Title: Example Domain

URL Source: http://example.com

Markdown Content:
# Example Domain

This domain is for use in illustrative examples in documents...
```

### SSE 流式响应（`Accept: text/event-stream`）

HTTP 200，响应体为 SSE 流，每个事件携带部分 Markdown 文本，结束时发送 `[DONE]` 事件：

```
data: # Example Domain

data: This domain is for use in illustrative examples...

data: [DONE]

```

### 响应头

| 响应头 | 说明 |
|--------|------|
| `Content-Type` | `text/plain; charset=utf-8` 或 `text/event-stream` |
| `x-usage-tokens` | 本次请求消耗的 Token 数量 |
| `cf-cache-status` | Cloudflare 缓存状态 |
| `x-amzn-RequestId` | AWS Lambda 请求 ID |

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功，响应体为解析后的 Markdown 文本（或 SSE 流） |
| 401 | JWT Token 缺失或无效 |
| 403 | Token 有效但目标 URL 被 GFW 过滤 |
| 429 | 配额超限 |
| 402 | 余额不足 |

---

## 生成期代码示例

### 普通模式

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 抓取目标网页并返回 Markdown 格式的正文内容（普通模式）。
 * @param targetUrl - 目标网页的完整 URL
 * @param options - 可选的输出控制参数
 * @param options.returnFormat - 返回格式，默认 markdown
 * @param options.withImagesSummary - 是否附加图片摘要
 * @param options.withLinksSummary - 是否附加链接汇总
 * @param options.targetSelector - CSS 选择器，仅提取特定元素
 * @param options.removeSelector - CSS 选择器，移除特定元素
 * @param options.timeout - 页面加载超时时间（秒）
 * @param options.noCache - 是否禁用缓存
 * @returns 网页的 Markdown 文本内容
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

  const response = await fetch(endpoint, { method: "GET", headers });

  if (response.status === 401) throw new Error("鉴权失败：JWT Token 缺失或无效");
  if (response.status === 403) throw new Error("目标 URL 被 GFW 过滤，无法访问");
  if (!response.ok) throw new Error(`HTTP 错误：${response.status}`);

  return await response.text();
}

const markdown = await fetchWebPage("https://example.com", { withLinksSummary: true });
console.log(markdown);
```

### SSE 流式模式

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

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **URL 编码**：目标 URL 需经过 `encodeURIComponent` 编码后再拼接到路径中，避免特殊字符导致路由解析错误。
- **GFW 过滤**：被 GFW 屏蔽的域名将返回 403，可通过 JWT Payload 中的 `filter_gfw` 字段控制。
- **SSE 模式**：流式模式下响应为 `text/event-stream`，需使用流式读取方式处理，不能直接 `await response.text()`。
- **计费**：本接口免费（`enable_billing: false`），但仍会统计调用次数。
