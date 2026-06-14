# 百度AI搜索接口（SSE 流式）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `be049c59-00cf-420d-b21a-1486dc4c6812` |
| API ID | `api-DYJwo27V8Qya` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DYJwo27V8Qya-gateway.appmiaoda.com/v2/ai_search/chat/completions` |
| 认证模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| 响应类型 | SSE 流式（text/event-stream） |
| third_part_domain | `app-cblk1rqa5fk1-api-DYJwo27V8Qya-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `messages` | array | 是 | — | 搜索输入，role 必须是 user-assistant-user 交替 |
| `messages[].role` | string | 是 | — | 角色设定，可选值：`user`、`assistant` |
| `messages[].content` | string | 是 | — | 对话内容，不能为空 |
| `instruction` | string | 否 | `""` | 人设指令，用于设定输出风格 |
| `enable_deep_search` | boolean | 否 | `false` | 是否开启深搜索（最多 10 次智能搜索，每种类型最多返回 100 个结果） |
| `resource_type_filter` | array | 否 | — | 搜索资源类型过滤 |
| `resource_type_filter[].type` | string | 是 | — | 搜索资源类型：`video`、`image`、`web` |
| `resource_type_filter[].top_k` | integer | 是 | — | 指定模态最大返回个数 |
| `search_recency_filter` | string | 否 | — | 按网页发布时间筛选：`week`、`month`、`semiyear`、`year` |
| `enable_reasoning` | boolean | 否 | `true` | 是否开启深度思考（支持 DeepSeek-R1、文心X1） |
| `max_completion_tokens` | integer | 否 | `2048` | 最大输出 token 数 |
| `response_format` | string | 否 | `auto` | 输出内容样式：`auto`、`text`、`rich_text` |
| `enable_followup_queries` | boolean | 否 | `false` | 是否开启追问建议 |

---

## 响应字段表

### 成功响应（每条 SSE 事件的 data JSON）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `is_safe` | boolean | 内容安全标识 |
| `choices` | array | 生成结果数组 |
| `choices[].finish_reason` | string | 结束原因，如 `stop` |
| `choices[].index` | integer | 结果索引 |
| `choices[].delta.content` | string | 本次增量输出内容 |
| `choices[].delta.reasoning_content` | string? | 推理过程增量内容（开启 reasoning 时） |
| `choices[].delta.role` | string | 角色，固定为 `assistant` |
| `usage` | object? | Token 用量统计（最后一条事件携带） |
| `usage.prompt_tokens` | integer | 输入 token 数 |
| `usage.completion_tokens` | integer | 输出 token 数 |
| `usage.total_tokens` | integer | 总 token 数 |
| `references` | array? | 引用来源列表（部分事件携带） |
| `references[].id` | integer | 引用编号 |
| `references[].title` | string | 网页标题 |
| `references[].url` | string | 网页地址 |
| `references[].web_anchor` | string | 网站锚文本 |
| `references[].content` | string | 网站内容摘要 |
| `references[].date` | string | 网页发布日期 |
| `references[].type` | string | 资源类型：`web`、`image`、`video` |
| `followup_queries` | array? | 推荐追问问题列表（开启 enable_followup_queries 时） |

---

## 生成期代码

以下代码可在 Deno 脚本或生成期 Agent 中直接运行，逐行读取 SSE 并累积输出。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResourceTypeFilter {
  type: "video" | "image" | "web";
  top_k: number;
}

interface AiSearchRequest {
  messages: Message[];
  instruction?: string;
  enable_deep_search?: boolean;
  resource_type_filter?: ResourceTypeFilter[];
  search_recency_filter?: "week" | "month" | "semiyear" | "year";
  enable_reasoning?: boolean;
  max_completion_tokens?: number;
  response_format?: "auto" | "text" | "rich_text";
  enable_followup_queries?: boolean;
}

/**
 * 调用百度AI搜索接口，流式读取并累积返回全部内容。
 * @param params - 搜索请求参数，messages 必须以 user 角色开头
 * @returns 累积的完整回答文本及最终引用列表
 */
async function callBaiduAiSearch(
  params: AiSearchRequest
): Promise<{ content: string; references: unknown[] }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DYJwo27V8Qya-gateway.appmiaoda.com/v2/ai_search/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf8");
  let buffer = "";
  let fullContent = "";
  let references: unknown[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        fullContent += delta;
        if (parsed.references?.length) {
          references = parsed.references;
        }
      } catch {
        // 跳过不完整的 chunk
      }
    }
  }

  return { content: fullContent, references };
}

// 使用示例
const result = await callBaiduAiSearch({
  messages: [{ role: "user", content: "近日油价调整消息" }],
  resource_type_filter: [
    { type: "web", top_k: 4 },
    { type: "image", top_k: 4 },
    { type: "video", top_k: 4 },
  ],
  search_recency_filter: "week",
  enable_deep_search: false,
  enable_reasoning: true,
  enable_followup_queries: false,
});

console.log("回答：", result.content);
console.log("引用来源：", result.references);
```

---

## Edge Function 代码

此接口为 SSE 流式，Edge Function 必须将上游 SSE 流直接 proxy 给前端，**不可缓冲后返回**。

### Web & MiniProgram（统一版本）

```typescript
// edge-functions/baidu-ai-search.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let messages: Array<{ role: string; content: string }>;
  let instruction: string | undefined;
  let enableDeepSearch: boolean | undefined;
  let resourceTypeFilter: Array<{ type: string; top_k: number }> | undefined;
  let searchRecencyFilter: string | undefined;
  let enableReasoning: boolean | undefined;
  let maxCompletionTokens: number | undefined;
  let responseFormat: string | undefined;
  let enableFollowupQueries: boolean | undefined;

  try {
    const body = await req.json();
    messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Missing or invalid messages");
    }
    instruction = body.instruction;
    enableDeepSearch = body.enable_deep_search;
    resourceTypeFilter = body.resource_type_filter;
    searchRecencyFilter = body.search_recency_filter;
    enableReasoning = body.enable_reasoning;
    maxCompletionTokens = body.max_completion_tokens;
    responseFormat = body.response_format;
    enableFollowupQueries = body.enable_followup_queries;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构建上游请求体（剔除 undefined 字段） ---
  const upstreamBody: Record<string, unknown> = { messages };
  if (instruction !== undefined) upstreamBody.instruction = instruction;
  if (enableDeepSearch !== undefined) upstreamBody.enable_deep_search = enableDeepSearch;
  if (resourceTypeFilter !== undefined) upstreamBody.resource_type_filter = resourceTypeFilter;
  if (searchRecencyFilter !== undefined) upstreamBody.search_recency_filter = searchRecencyFilter;
  if (enableReasoning !== undefined) upstreamBody.enable_reasoning = enableReasoning;
  if (maxCompletionTokens !== undefined) upstreamBody.max_completion_tokens = maxCompletionTokens;
  if (responseFormat !== undefined) upstreamBody.response_format = responseFormat;
  if (enableFollowupQueries !== undefined) upstreamBody.enable_followup_queries = enableFollowupQueries;

  // --- 调用上游（SSE 流式） ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DYJwo27V8Qya-gateway.appmiaoda.com/v2/ai_search/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    }
  );

  // 透传配额/余额错误
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 直接 proxy SSE 流，不缓冲 ---
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
```

---

## 前端调用代码

> **⚠️ 平台差异：Web 和 MiniProgram 的 SSE 消费方式完全不同，不可混用。**
> - **Web**：使用 `ky` + `eventsource-parser`（浏览器 Fetch API）
> - **MiniProgram**：使用 `miaoda-taro-utils` 的 `sendStream`（`ky`/`eventsource-parser`/`fetch` 在 weapp 运行时不存在）
>
> 请根据目标平台选择对应章节。

### Web 依赖安装

```bash
npm install ky@^1.2.3 eventsource-parser@^3.0.3
# 可选：流式 Markdown 渲染
npm install streamdown@^1.4.0
```

或使用 pnpm：

```bash
pnpm add ky@^1.2.3 eventsource-parser@^3.0.3 streamdown@^1.4.0
```

### Web SSE 工具函数（`lib/sse.ts`）

> **仅适用于 Web 平台。** MiniProgram 请跳至下方「MiniProgram 前端调用示例」章节。

以下工具函数来自已验证的实现，支持分块 base64 编码及 SSE 事件解析器，
直接复制到 `lib/sse.ts` 或内联使用：

```typescript
import ky, { type KyResponse, type AfterResponseHook, type NormalizedOptions } from "ky";
import { createParser, type EventSourceParser } from "eventsource-parser";

/** SSE 选项接口 */
export interface SSEOptions {
  /** 接收到每条数据时的回调 */
  onData: (data: string) => void;
  /** 接收到事件时的回调（可选） */
  onEvent?: (event: unknown) => void;
  /** 流式响应完成时的回调（可选） */
  onCompleted?: (error?: Error) => void;
  /** 请求被中断时的回调（可选） */
  onAborted?: () => void;
}

/**
 * 创建 SSE Hook 用于处理 ky 流式响应。
 * @param options - SSE 回调选项
 * @returns ky AfterResponseHook
 */
export const createSSEHook = (options: SSEOptions): AfterResponseHook => {
  const hook: AfterResponseHook = async (
    request: Request,
    _options: NormalizedOptions,
    response: KyResponse
  ) => {
    if (!response.ok || !response.body) return;

    let completed = false;
    const innerOnCompleted = (error?: Error): void => {
      if (completed) return;
      completed = true;
      options.onCompleted?.(error);
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf8");
    const parser: EventSourceParser = createParser({
      onEvent: (event) => {
        if (event.data) {
          options.onEvent?.(event);
          // 处理单 message 多 data 字段的场景
          const dataArray: string[] = event.data.split("\n");
          for (const data of dataArray) {
            options.onData(data);
          }
        }
      },
    });

    const read = (): void => {
      reader.read().then((result) => {
        if (result.done) {
          innerOnCompleted();
          return;
        }
        parser.feed(decoder.decode(result.value, { stream: true }));
        read();
      }).catch((error) => {
        if (request.signal.aborted) {
          options.onAborted?.();
          return;
        }
        innerOnCompleted(error as Error);
      });
    };

    read();
    return response;
  };

  return hook;
};

/** 流式请求选项接口 */
export interface StreamRequestOptions {
  /** Edge Function URL */
  functionUrl: string;
  /** 请求体 */
  requestBody: unknown;
  /** Supabase 匿名密钥 */
  supabaseAnonKey: string;
  /** 接收到每个 SSE 数据块的回调 */
  onData: (data: string) => void;
  /** 请求完成回调 */
  onComplete: () => void;
  /** 错误处理回调 */
  onError: (error: Error) => void;
  /** 中断信号（可选） */
  signal?: AbortSignal;
}

/**
 * 发送流式请求到 Supabase Edge Function。
 * @param options - 流式请求选项
 */
export const sendStreamRequest = async (options: StreamRequestOptions): Promise<void> => {
  const {
    functionUrl,
    requestBody,
    supabaseAnonKey,
    onData,
    onComplete,
    onError,
    signal,
  } = options;

  const sseHook = createSSEHook({
    onData,
    onCompleted: (error?: Error) => {
      if (error) {
        onError(error);
      } else {
        onComplete();
      }
    },
    onAborted: () => {
      console.log("请求已中断");
    },
  });

  try {
    await ky.post(functionUrl, {
      json: requestBody,
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      signal,
      hooks: {
        afterResponse: [sseHook],
      },
    });
  } catch (error) {
    if (!signal?.aborted) {
      onError(error as Error);
    }
  }
};
```

### Web 前端调用示例（React）

```typescript
import { useState, useRef } from "react";
import { sendStreamRequest } from "@/lib/sse";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface SearchMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 调用百度AI搜索 Edge Function，流式累积返回内容。
 * @param messages - 对话消息数组
 * @param onChunk - 每收到一段增量内容时的回调
 * @param onComplete - 流式完成回调
 * @param onError - 错误回调
 * @param signal - AbortSignal（可选，用于中断）
 */
async function streamBaiduAiSearch(
  messages: SearchMessage[],
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  await sendStreamRequest({
    functionUrl: `${supabaseUrl}/functions/v1/baidu-ai-search`,
    requestBody: {
      messages,
      resource_type_filter: [
        { type: "web", top_k: 4 },
        { type: "image", top_k: 4 },
        { type: "video", top_k: 4 },
      ],
      search_recency_filter: "year",
      enable_deep_search: false,
      enable_reasoning: true,
      enable_followup_queries: false,
    },
    supabaseAnonKey,
    onData: (data) => {
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        // 百度AI搜索响应格式：choices[0].delta.content
        const chunk = parsed.choices?.[0]?.delta?.content ?? "";
        if (chunk) onChunk(chunk);
      } catch {
        // 跳过不完整或无效的 chunk
      }
    },
    onComplete,
    onError,
    signal,
  });
}

// --- React 组件示例 ---
export function BaiduSearchDemo() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;

    setAnswer("");
    setLoading(true);
    abortRef.current = new AbortController();

    await streamBaiduAiSearch(
      [{ role: "user", content: query }],
      (chunk) => setAnswer((prev) => prev + chunk),
      () => setLoading(false),
      (err) => {
        console.error("搜索失败：", err);
        setLoading(false);
      },
      abortRef.current.signal
    );
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入搜索问题" />
      <button onClick={handleSearch} disabled={loading}>搜索</button>
      {loading && <button onClick={handleAbort}>停止</button>}
      <div>{answer}</div>
    </div>
  );
}
```

### 可选：流式 Markdown 渲染

```typescript
import { Streamdown } from "streamdown";

<Streamdown
  parseIncompleteMarkdown={true}
  isAnimating={loading}
>
  {answer}
</Streamdown>
```

### MiniProgram 前端调用示例（Taro）

**CRITICAL：小程序环境不可使用 `ky` / `eventsource-parser` / `fetch` 流式方案**，这些依赖浏览器 Fetch API，在 weapp 运行时不存在。必须使用 `miaoda-taro-utils` 的 `sendStream`。

依赖安装：

```bash
pnpm add miaoda-taro-utils@^0.1.0
```

**`sendStream` 与 `sendChatStream` 的区别：**
- `sendChatStream`：只发 `{ messages, enable_thinking }` 固定结构，适用于纯对话场景（如 wenxin-text-generation）
- `sendStream`：支持自定义 `data`（任意请求体），适用于需要传入额外参数的场景（如 AI 搜索的 `resource_type_filter`、`search_recency_filter` 等）

```typescript
import { sendStream } from "miaoda-taro-utils/stream";

const SUPABASE_URL = process.env.TARO_APP_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.TARO_APP_SUPABASE_ANON_KEY!;

/**
 * 小程序端调用百度AI搜索，流式累积内容。
 * sendStream 内部处理了 enableChunked + onChunkReceived + SSE 解析，
 * onUpdate 回调直接给出去掉 "data: " 前缀的原始 JSON 字符串。
 */
function streamSearchMiniProgram(
  query: string,
  onChunk: (chunk: string) => void,
  onReferences: (refs: any[]) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): { abort: () => void } {
  return sendStream({
    url: `${SUPABASE_URL}/functions/v1/baidu-ai-search`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    data: {
      messages: [{ role: "user", content: query }],
      resource_type_filter: [{ type: "web", top_k: 6 }],
      search_recency_filter: "month",
      enable_deep_search: false,
      enable_reasoning: false,
      enable_followup_queries: true,
      max_completion_tokens: 3000,
    },
    timeout: 120000,
    onUpdate: (rawData: string) => {
      if (rawData === "[DONE]") return;
      try {
        const parsed = JSON.parse(rawData);
        const chunk = parsed.choices?.[0]?.delta?.content ?? "";
        if (chunk) onChunk(chunk);
        if (parsed.references?.length) onReferences(parsed.references);
      } catch {}
    },
    onComplete,
    onError,
  });
}
```

### App 前端调用示例（Expo）

依赖安装：

```bash
pnpm add eventsource-parser react-native-marked
```

- `expo/fetch`：Expo 内置，**必须使用此包而非全局 fetch**（RN 原生 fetch 不支持流式 `response.body`）
- `eventsource-parser`：SSE 事件解析器，纯 JS 实现，兼容 React Native
- `react-native-marked`：Markdown 渲染组件

**SSE 流处理工具函数：**

```ts
// utils/sseStream.ts
import { createParser, type EventSourceParser } from 'eventsource-parser';

export interface SSEOptions {
  onData: (data: string) => void;
  onCompleted?: (error?: Error) => void;
  onAborted?: () => void;
}

export const processSSEStream = (
  signal: AbortSignal | undefined,
  response: Response,
  options: SSEOptions
): void => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parser: EventSourceParser = createParser({
    onEvent: (event) => {
      if (event.data) {
        for (const data of event.data.split('\n')) {
          options.onData(data);
        }
      }
    },
  });

  const read = (): void => {
    reader.read()
      .then((result) => {
        if (result.done) { return; }
        parser.feed(decoder.decode(result.value, { stream: true }));
        read();
      })
      .catch((error: Error) => {
        if (signal?.aborted) { options.onAborted?.(); }
      });
  };

  read();
};
```

**通用流式请求函数：**

```ts
// utils/streamRequest.ts
import { fetch } from 'expo/fetch';
import { processSSEStream } from './sseStream';

export const sendStreamRequest = async (options: {
  functionUrl: string;
  requestBody: any;
  supabaseAnonKey: string;
  onData: (data: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}): Promise<void> => {
  const { functionUrl, requestBody, supabaseAnonKey, onData, onComplete, onError, signal } = options;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    processSSEStream(signal, response, {
      onData,
      onCompleted: (error) => error ? onError(error) : onComplete(),
      onAborted: () => {},
    });
  } catch (error) {
    if (!signal?.aborted) onError(error as Error);
  }
};
```

**App 端组件示例：**

```tsx
import { useState, useCallback, useRef } from 'react';
import { View, TextInput, Button } from 'react-native';
import Markdown from 'react-native-marked';
import { sendStreamRequest } from '@/utils/streamRequest';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export function AiSearchApp() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const streamingContentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || loading) return;
    streamingContentRef.current = '';
    setAnswer('');
    setLoading(true);
    abortControllerRef.current = new AbortController();

    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/baidu-ai-search`,
      requestBody: {
        messages: [{ role: 'user', content: query }],
        enable_reasoning: true,
        search_recency_filter: 'year',
      },
      supabaseAnonKey,
      signal: abortControllerRef.current.signal,
      onData: (data) => {
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
          if (!chunk) return;
          streamingContentRef.current += chunk;
          setAnswer(streamingContentRef.current);
        } catch {}
      },
      onComplete: () => {
        setAnswer(streamingContentRef.current);
        setLoading(false);
      },
      onError: () => setLoading(false),
    });
  }, [query, loading]);

  return (
    <View>
      <TextInput value={query} onChangeText={setQuery} placeholder="输入搜索问题" />
      <Button title="搜索" onPress={handleSearch} disabled={loading} />
      {loading && <Button title="停止" onPress={() => abortControllerRef.current?.abort()} />}
      <Markdown value={answer} flatListProps={{ scrollEnabled: false }} />
    </View>
  );
}
```

**CRITICAL 注意事项（App 平台）：**

- **必须使用 `expo/fetch`**，RN 原生 fetch 不支持流式 `response.body`
- 用 `useRef` 累积流式内容再 flush 到 state，避免闭包捕获旧 state 导致死循环
- 避免在 `useEffect` 依赖数组中监听流式数据
- 使用 `react-native-marked` 渲染 Markdown，嵌套列表中需设置 `flatListProps={{ scrollEnabled: false }}`

---

## 注意事项

### 密钥安全

`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get("INTEGRATIONS_API_KEY")`
读取，严禁暴露给前端或写入客户端代码。

### 错误处理

务必处理以下 HTTP 状态码：
- **429**：配额已用尽，需提示用户稍后重试或升级套餐。
- **402**：账户余额不足，需提示用户充值。
- **502**：上游服务异常，可重试一次。

### 计费说明

计费信息以平台实际配置为准。
- 建议合理设置 `max_completion_tokens` 以控制费用，避免不必要的长输出。

### SSE 流式注意事项

- Edge Function 必须直接 proxy 上游 SSE 流，**不可用 `upstream.json()` 缓冲后返回**。
- Web 前端使用 `eventsource-parser` 等 SSE 解析库处理事件，不可直接 `response.json()`；MiniProgram 前端使用 `miaoda-taro-utils` 的 `sendStream`（内部已处理 SSE 解析）。
- 深度搜索（`enable_deep_search: true`）会显著增加响应时间，建议在 UI 上展示加载动画。
- `reasoning_content` 字段仅在模型支持推理思考时携带（`enable_reasoning: true`）。
- 若需展示引用来源，注意 `references` 字段在多条 SSE 事件中可能重复出现，以最后一次为准。
