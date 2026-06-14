# chat-completions-api — 文心文本生成大模型接口

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `b4e50937-a645-487a-bbf0-0a70156a8271` |
| API ID | `api-zYkZz8qovQ1L` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions` |
| Content-Type | `application/json` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 认证模式 | `platform_managed`（密钥由平台注入，读取 `INTEGRATIONS_API_KEY`） |
| Third-party Domain | `app-cblk1rqa5fk1-api-zYkZz8qovQ1L-gateway.appmiaoda.com` |
| 响应模式 | SSE 流式 |
| 计费 | 原价 ¥0.20 / 0.1单位，优惠价 ¥0.10 / 0.1单位 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `messages` | `array` | 是 | — | 聊天上下文信息，包含 `role` 和 `content` 字段 |
| `messages[].role` | `string` | 是 | — | 角色类型：`user` / `assistant` / `system` |
| `messages[].content` | `string` | 是 | — | 对话内容，不能为空 |
| `enable_thinking` | `boolean` | 否 | `false` | 是否开启思考模式 |

---

## 响应字段表

### 成功响应（200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `id` | `string` | 本次响应唯一标识 |
| `choices` | `array` | 响应内容数组 |
| `choices[].index` | `number` | 候选结果序号 |
| `choices[].delta.role` | `string` | 角色（assistant） |
| `choices[].delta.content` | `string` | 本帧增量文本内容 |
| `choices[].finish_reason` | `string \| null` | 结束原因：`stop`（自然停止）/ `length`（达到最大 token）/ `content_filter`（内容过滤）/ `tool_calls`（函数调用）/ `null`（未结束） |
| `choices[].flag` | `number` | 安全细分类型，`0` 表示正常 |
| `choices[].ban_round?` | `number` | 敏感信息所在轮次，`-1` 表示当前问题 |

### 错误响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error.type` | `string` | 错误类型，如 `invalid_request_error` |
| `error.code` | `string` | 错误代码，见下方错误码说明 |
| `error.message` | `string` | 错误详情 |

### 常见错误码

| 错误码 | 说明 |
|--------|------|
| `invalid_appid` | 应用 ID 无权限 |
| `tokens_too_long` | 输入 tokens 超限（上限 27k token） |
| `rpm_rate_limit_exceeded` | RPM 限流 |
| `tpm_rate_limit_exceeded` | TPM 限流 |
| `image_url_unsafe` | 图片 URL 内容不安全 |
| `internal_error` | 内部错误 |
| `invalid_model` | model 为空或无效 |

---

## 生成期代码（Agent 直接调用）

适用于在 Deno 脚本 / 生成期任务中直接调用上游 SSE 流式接口。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatCompletionChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
    flag: number;
  }>;
}

/**
 * 调用文心文本生成大模型（流式），将所有增量内容拼接后返回完整回复。
 * @param messages - 对话上下文消息数组
 * @param enableThinking - 是否开启思考模式，默认 false
 * @returns 完整的模型回复文本
 */
async function callTextGenerationLLM(
  messages: Message[],
  enableThinking = false
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, enable_thinking: enableThinking }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8");
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") break;
      try {
        const chunk: ChatCompletionChunk = JSON.parse(raw);
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        fullContent += delta;
      } catch {
        // 跳过无法解析的帧
      }
    }
  }

  return fullContent;
}

// 使用示例
const reply = await callTextGenerationLLM([
  { role: "system", content: "你是一个文本处理助手" },
  { role: "user", content: "请将以下内容翻译成英文：人工智能改变世界" },
]);
console.log(reply);
```

---

## Edge Function 代码（SSE Proxy 模式）

Edge Function 将上游 SSE 流直接透传给前端，适用于 Web 和 MiniProgram 平台（两者共用同一个 Edge Function）。

```typescript
// edge-functions/wenxin-text-generation.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // 1. 解析请求参数
  let messages: Array<{ role: string; content: string }>;
  let enableThinking = false;

  try {
    const body = await req.json();
    messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Missing or invalid messages");
    }
    if (body.enable_thinking !== undefined) {
      enableThinking = Boolean(body.enable_thinking);
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Invalid request body: ${(err as Error).message}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. 读取平台注入的密钥
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error: missing API key" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. 调用上游 SSE 接口
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, enable_thinking: enableThinking }),
    }
  );

  // 转发限流 / 余额不足错误
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. 直接透传 SSE 流，不缓冲
  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
```

---

## 前端调用代码

### Web 平台

依赖安装：

```bash
npm install ky@^1.2.3 eventsource-parser@^3.0.3
# 可选：流式 Markdown 渲染
npm install streamdown@^1.4.0
```

**SSE 工具函数（`lib/sse.ts`）：**

```typescript
import ky, {
  type KyResponse,
  type AfterResponseHook,
  type NormalizedOptions,
} from "ky";
import { createParser, type EventSourceParser } from "eventsource-parser";

export interface SSEOptions {
  /** 接收到数据帧时的回调 */
  onData: (data: string) => void;
  /** 接收到事件时的回调（可选） */
  onEvent?: (event: unknown) => void;
  /** 流式响应完成时的回调（可选） */
  onCompleted?: (error?: Error) => void;
  /** 请求被中断时的回调（可选） */
  onAborted?: () => void;
}

/**
 * 创建 SSE AfterResponseHook，用于处理 ky 的流式响应。
 * @param options - SSE 回调选项
 * @returns AfterResponseHook
 */
export function createSSEHook(options: SSEOptions): AfterResponseHook {
  const hook: AfterResponseHook = async (
    request: Request,
    _options: NormalizedOptions,
    response: KyResponse
  ) => {
    if (!response.ok || !response.body) return;

    let completed = false;
    const finish = (error?: Error): void => {
      if (completed) return;
      completed = true;
      options.onCompleted?.(error);
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf8");
    const parser: EventSourceParser = createParser({
      onEvent: (event) => {
        if (!event.data) return;
        options.onEvent?.(event);
        // 处理单 message 多 data 字段的场景
        for (const chunk of event.data.split("\\ ")) {
          options.onData(chunk);
        }
      },
    });

    const read = (): void => {
      reader
        .read()
        .then((result) => {
          if (result.done) {
            finish();
            return;
          }
          parser.feed(decoder.decode(result.value, { stream: true }));
          read();
        })
        .catch((error) => {
          if (request.signal.aborted) {
            options.onAborted?.();
            return;
          }
          finish(error as Error);
        });
    };

    read();
    return response;
  };

  return hook;
}

export interface StreamRequestOptions {
  /** Edge Function URL */
  functionUrl: string;
  /** 请求体 */
  requestBody: unknown;
  /** Supabase 匿名密钥 */
  supabaseAnonKey: string;
  /** 接收到每个 SSE 数据帧的回调 */
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
export async function sendStreamRequest(options: StreamRequestOptions): Promise<void> {
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
      if (error) onError(error);
      else onComplete();
    },
    onAborted: () => console.log("请求已中断"),
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
      hooks: { afterResponse: [sseHook] },
    });
  } catch (error) {
    if (!signal?.aborted) onError(error as Error);
  }
}
```

**React 组件中使用（Web）：**

```typescript
import { useState, useRef } from "react";
import { sendStreamRequest } from "./lib/sse";
// 可选：流式 Markdown 渲染
// import { Streamdown } from "streamdown";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function ChatComponent() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * 发起流式对话请求，逐帧累积模型回复内容。
   * @param userMessage - 用户输入的消息文本
   */
  const handleChat = async (userMessage: string) => {
    setContent("");
    setIsStreaming(true);
    abortRef.current = new AbortController();

    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/wenxin-text-generation`,
      requestBody: {
        messages: [{ role: "user", content: userMessage }],
      },
      supabaseAnonKey,
      onData: (data) => {
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          // 文心大模型 SSE 格式：choices[0].delta.content
          const chunk = parsed.choices?.[0]?.delta?.content ?? "";
          setContent((prev) => prev + chunk);
        } catch {
          // 跳过无法解析的帧
        }
      },
      onComplete: () => setIsStreaming(false),
      onError: (error) => {
        console.error("Stream error:", error);
        setIsStreaming(false);
      },
      signal: abortRef.current.signal,
    });
  };

  /** 中断正在进行的流式请求 */
  const handleAbort = () => {
    abortRef.current?.abort();
  };

  return (
    <div>
      <div>{content}</div>
      {/* 使用 Streamdown 渲染 Markdown（可选）：
      <Streamdown parseIncompleteMarkdown isAnimating={isStreaming}>
        {content}
      </Streamdown>
      */}
      {isStreaming && <button onClick={handleAbort}>停止生成</button>}
    </div>
  );
}
```

---

### MiniProgram 平台

依赖安装（使用 pnpm）：

```bash
pnpm add miaoda-taro-utils@^0.0.4
```

**CRITICAL 注意事项（来自平台验证实现）：**

- `appId` 必须填入空字符串 `''`，否则会导致无法请求
- `sendChatStream` 的 `endpoint` 从接口 URL 中提取
- 前端传入完整的 `messages`，Edge Function 中仅进行合法性校验，不拼接或修改 messages，确保直接透传到上游 API
- 流式数据结构为：`data: {"id":"as-btb3y1g6iq","choices":[{"index":0,"delta":{"content":"经济"}}]}`
- 使用 `useCallback` 或 `useEffect` 时，避免监听流式数据，以免产生循环
- 需要使用 `@tarojs/components` 中的 `RichText` 来处理模型返回 Markdown 格式的内容展示

**Taro 小程序端调用示例：**

```typescript
import { sendChatStream } from "miaoda-taro-utils/chatStream";
import { useState, useCallback } from "react";
import { RichText } from "@tarojs/components";

const supabaseUrl = process.env.TARO_APP_SUPABASE_URL;

export function ChatMiniProgram() {
  const [fullContent, setFullContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  // 注意：不要在 useEffect 或 useCallback 中监听 fullContent，避免产生循环
  const abortRef = useRef<(() => void) | null>(null);

  /**
   * 发起小程序端流式对话请求。
   * @param userMessage - 用户输入的消息文本
   */
  const handleChat = useCallback(async (userMessage: string) => {
    setFullContent("");
    setIsStreaming(true);
    let accumulated = "";

    const { abort } = sendChatStream({
      endpoint: `${supabaseUrl}/functions/v1/wenxin-text-generation`,
      // CRITICAL: appId 必须填空字符串，否则请求失败
      appId: "",
      messages: [{ role: "user", content: userMessage }],
      /**
       * @param rawData - 原始流式数据字符串
       * 格式示例: {"id":"as-btb3y1g6iq","choices":[{"index":0,"delta":{"content":"内容"}}]}
       */
      onUpdate: (rawData: string) => {
        try {
          if (rawData === "[DONE]") return;
          const data = JSON.parse(rawData);
          const chunk = data.choices?.[0]?.delta?.content ?? "";
          accumulated += chunk;
          // 使用局部变量累积后统一 setState，避免 closure 陷阱
          setFullContent(accumulated);
        } catch (e) {
          console.error("解析流数据失败:", e);
        }
      },
      onComplete: () => {
        setIsStreaming(false);
        console.log("回复完成");
      },
      onError: (error: Error) => {
        console.error("回复出错:", error);
        setIsStreaming(false);
      },
    });

    abortRef.current = abort;
  }, []); // 注意：依赖项中不包含流式数据，避免产生循环

  /** 中断正在进行的流式请求 */
  const handleAbort = () => {
    abortRef.current?.();
  };

  return (
    <View>
      {/* 使用 RichText 渲染 Markdown 格式内容 */}
      <RichText nodes={fullContent} />
      {isStreaming && <Button onClick={handleAbort}>停止生成</Button>}
    </View>
  );
}
```

---

### App 平台

依赖安装：

```bash
pnpm add eventsource-parser react-native-marked
```

- `expo/fetch`：Expo 内置，无需安装，**必须使用此包而非全局 fetch**（RN 原生 fetch 不支持流式 `response.body`）
- `eventsource-parser`：SSE 事件解析器，纯 JS 实现，兼容 React Native
- `react-native-marked`：Markdown 渲染组件，用于在聊天界面富文本展示 AI 回复

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

**App 端调用示例：**

```tsx
import { useState, useCallback, useRef } from 'react';
import { View, Button } from 'react-native';
import Markdown from 'react-native-marked';
import { sendStreamRequest } from '@/utils/streamRequest';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export function ChatApp() {
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // 用 ref 累积内容，避免 onData 闭包捕获旧 state 导致循环
  const streamingContentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(async (userInput: string) => {
    streamingContentRef.current = '';
    abortControllerRef.current = new AbortController();
    setIsStreaming(true);

    // 插入用户消息 + 空 assistant 占位
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: userInput },
      { id: `assistant-${Date.now()}`, role: 'assistant', content: '' },
    ]);

    const flushToState = () => {
      const content = streamingContentRef.current;
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content };
        return copy;
      });
    };

    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/wenxin-text-generation`,
      requestBody: { messages: [{ role: 'user', content: userInput }] },
      supabaseAnonKey,
      signal: abortControllerRef.current.signal,
      onData: (data) => {
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
          if (!chunk) return;
          streamingContentRef.current += chunk;
          flushToState();
        } catch {}
      },
      onComplete: () => {
        flushToState();
        setIsStreaming(false);
      },
      onError: (error) => {
        setIsStreaming(false);
      },
    });
  }, []);

  const handleAbort = () => {
    abortControllerRef.current?.abort();
  };

  return (
    <View>
      {messages.map((msg) => (
        <View key={msg.id}>
          {msg.role === 'assistant' ? (
            <Markdown value={msg.content} flatListProps={{ scrollEnabled: false }} />
          ) : null}
        </View>
      ))}
      {isStreaming && <Button title="停止生成" onPress={handleAbort} />}
    </View>
  );
}
```

**CRITICAL 注意事项（App 平台）：**

- **必须使用 `expo/fetch`**，React Native 原生 fetch 不支持流式 `response.body`
- `onData` 会被反复调用，内部用 `useRef` 累积内容再 flush 到 state，避免死循环
- 避免在 `useEffect` 依赖数组中监听流式数据，以免产生循环
- 使用 `react-native-marked` 的 `Markdown` 组件渲染富文本，嵌套在列表中时需设置 `flatListProps={{ scrollEnabled: false }}` 避免滚动冲突

---

## 注意事项

### 密钥安全

- `INTEGRATIONS_API_KEY` 由平台注入到 Edge Function 的 Deno 运行时环境，**严禁暴露到前端**。
- Auth Header 统一使用 `X-Gateway-Authorization`，不使用原始 `authKey` 值。

### 计费

- **原价**：¥0.20 / 0.1单位
- **优惠价**：¥0.10 / 0.1单位
- `need_count_calls: true`，每次调用均计费，避免不必要的重复调用。

### 错误处理

- 务必处理 `429`（RPM/TPM 限流）和 `402`（余额不足）响应。
- 输入 messages 总长度不超过 32k token，单次输入不超过 27k token。
- `finish_reason` 为 `content_filter` 时表示内容被安全过滤，需提示用户修改输入。

### MiniProgram 特有注意事项

- `appId` 必须填空字符串 `''`，否则请求会失败。
- 不要在 `useCallback` / `useEffect` 的依赖项中监听流式累积内容，以免产生更新循环。
- 推荐使用 `@tarojs/components` 的 `RichText` 展示 Markdown 格式内容。
