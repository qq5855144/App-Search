# MiniMax 文本合成接口 API 参考

## API 基本信息

| 属性 | 值 |
|------|----|
| Plugin ID | `e5ac922c-fb39-4131-a4c3-bdc4121db2be` |
| API ID | `api-Aa2PqMJnJGwL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Aa2PqMJnJGwL-gateway.appmiaoda.com/v1/text/chatcompletion_v2` |
| Third-party Domain | `app-cblk1rqa5fk1-api-Aa2PqMJnJGwL-gateway.appmiaoda.com` |
| Auth 模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| 流式支持 | 是（`stream: true` 开启 SSE） |

---

## 请求参数表

### 请求头

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `Content-Type` | string | 是 | 必须为 `application/json` |

### 请求体

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型 ID，可选值：`MiniMax-M2.5` |
| `messages` | array | 是 | — | 包含对话历史的消息列表，每条含 `role`、`content`、`name` 等字段 |
| `stream` | boolean | 否 | `false` | 是否使用流式传输，设为 `true` 后响应分块返回 |
| `max_tokens` | integer | 否 | — | **（已弃用/Deprecated）** 请改用 `max_completion_tokens` |
| `max_completion_tokens` | integer | 否 | 10240 | 生成内容长度上限（Token 数）；MiniMax-M2.5 默认 10240 |
| `temperature` | number | 否 | 1.0 | 温度系数，影响输出随机性，取值范围 `(0, 1]`，MiniMax-M2.5 推荐 1.0 |
| `top_p` | number | 否 | 0.95 | 采样策略，取值范围 `(0, 1]`，MiniMax-M2.5 推荐 0.95 |
| `tools` | array | 否 | — | 可供模型调用的工具列表，每项含 `type`（固定 `"function"`）和 `function` 对象 |
| `tool_choice` | string | 否 | `"auto"` | 控制工具调用方式：`"none"` 不调用、`"auto"` 自主决定 |
| `response_format` | object | 否 | — | 指定输出格式，设为 `{"type":"json_schema","json_schema":{...}}` 可强制结构化输出 |
| `stream_options` | object | 否 | — | 流式输出配置，`{"include_usage": true}` 使最后一个 chunk 包含完整 usage 统计 |

### messages 数组元素

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `role` | string | 是 | 角色：`system` / `user` / `assistant` / `tool` |
| `content` | string \| array | 是（tool 角色除外） | 纯文本时为 string；图文混合时为 `[{type, text/image_url}]` 数组 |
| `name` | string | 否 | 发送者名称，同一类型角色有多个时须提供 |
| `tool_calls` | array | 否 | 模型决定调用的工具列表（`role: assistant` 时出现） |

---

## 响应字段表

### 成功响应（非流式，`object: "chat.completion"`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `id` | string | 响应的唯一 ID |
| `choices` | array | 响应选择列表 |
| `choices[].finish_reason` | string | 停止原因：`stop` / `length` / `tool_calls` |
| `choices[].index` | integer | 选项索引，从 0 开始 |
| `choices[].message.content` | string | 文本回复内容 |
| `choices[].message.role` | string | 固定为 `assistant` |
| `choices[].message.tool_calls` | array? | 模型请求调用的工具列表 |
| `choices[].message.tool_calls[].id` | string | 工具调用唯一 ID |
| `choices[].message.tool_calls[].type` | string | 固定为 `function` |
| `choices[].message.tool_calls[].function.name` | string | 要调用的函数名称 |
| `choices[].message.tool_calls[].function.arguments` | string | 包含函数参数的 JSON 字符串 |
| `created` | integer | 响应创建的 Unix 时间戳（秒） |
| `model` | string | 使用的模型 ID |
| `object` | string | `chat.completion`（非流式）或 `chat.completion.chunk`（流式） |
| `usage.total_tokens` | integer | 消耗的总 Token 数 |
| `usage.prompt_tokens` | integer | 输入 Token 数 |
| `usage.completion_tokens` | integer | 输出 Token 数 |
| `input_sensitive` | boolean | 输入内容是否命中敏感词 |
| `input_sensitive_type` | integer? | 输入敏感词类型（1 严重违规 / 2 色情 / 3 广告 / 4 违禁 / 5 谩骂 / 6 暴恐 / 7 其他） |
| `output_sensitive` | boolean | 输出内容是否命中敏感词 |
| `output_sensitive_type` | integer? | 输出敏感词类型 |
| `base_resp.status_code` | integer | 业务状态码（0 表示成功） |
| `base_resp.status_msg` | string | 错误详情（成功时为空字符串） |

### 流式响应（SSE，`object: "chat.completion.chunk"`）

每个 chunk 结构与非流式类似，但 `choices[].message` 替换为 `choices[].delta`：

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `choices[].delta.content` | string | 本 chunk 的文本增量内容 |
| `choices[].delta.role` | string | 固定为 `assistant` |
| `choices[].delta.reasoning_content` | string | 本 chunk 的思维链增量内容（推理模型输出，可能为空） |
| `choices[].delta.tool_calls` | array? | 工具调用增量列表；当模型决定调用工具时出现，每项含 `index`、`id`、`type`、`function.name`、`function.arguments`（分块累积，需拼接完整后解析） |
| `choices[].finish_reason` | string? | 最后一个 chunk 时出现 |

### 错误状态码（`base_resp.status_code`）

| 状态码 | 含义 |
|--------|------|
| `0` | 成功 |
| `1000` | 未知错误 |
| `1001` | 请求超时 |
| `1002` | 触发限流 |
| `1004` | 鉴权失败 |
| `1008` | 余额不足 |
| `1013` | 服务内部错误 |
| `1027` | 输出内容错误 |
| `1039` | Token 超出限制 |
| `2013` | 参数错误 |

---

## 生成期代码

直接在 Deno 脚本或生成 Agent 中调用，密钥从平台环境变量读取。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: object };
  }>;
  tool_choice?: "none" | "auto";
  response_format?: { type: "json_schema"; json_schema: object };
  stream_options?: { include_usage?: boolean };
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    finish_reason: "stop" | "length" | "tool_calls";
    index: number;
    message: {
      content: string;
      role: "assistant";
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  created: number;
  model: string;
  object: string;
  usage: { total_tokens: number; prompt_tokens: number; completion_tokens: number };
  input_sensitive: boolean;
  output_sensitive: boolean;
  base_resp: { status_code: number; status_msg: string };
}

/**
 * 调用 MiniMax 文本对话补全接口（非流式）。
 * @param request - 请求体，必须包含 model 和 messages
 * @returns 模型返回的补全结果
 */
async function callMiniMaxChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Aa2PqMJnJGwL-gateway.appmiaoda.com/v1/text/chatcompletion_v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json: ChatCompletionResponse = await response.json();
  if (json.base_resp.status_code !== 0) {
    throw new Error(
      `MiniMax API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`
    );
  }

  return json;
}

// 示例：简单对话
const result = await callMiniMaxChat({
  model: "MiniMax-M2.5",
  messages: [
    { role: "system", content: "你是一个智能助手。", name: "MiniMax AI" },
    { role: "user", content: "你好，请用一句话介绍自己。", name: "用户" },
  ],
  temperature: 1.0,
  max_completion_tokens: 10240,
});

console.log(result.choices[0].message.content);
```

---

## Edge Function 代码

### 非流式版本（Web + MiniProgram 通用）

```typescript
// edge-functions/minimax-chat.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let model: string;
  let messages: unknown[];
  let options: Record<string, unknown> = {};

  try {
    const body = await req.json();
    model = body.model ?? "MiniMax-M2.5";
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Missing or empty messages");
    }
    // 可选参数透传
    const {
      stream: _stream, // 非流式版本忽略 stream
      max_completion_tokens,
      temperature,
      top_p,
      tools,
      tool_choice,
      response_format,
    } = body;
    if (max_completion_tokens !== undefined) options.max_completion_tokens = max_completion_tokens;
    if (temperature !== undefined) options.temperature = temperature;
    if (top_p !== undefined) options.top_p = top_p;
    if (tools !== undefined) options.tools = tools;
    if (tool_choice !== undefined) options.tool_choice = tool_choice;
    if (response_format !== undefined) options.response_format = response_format;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Aa2PqMJnJGwL-gateway.appmiaoda.com/v1/text/chatcompletion_v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, ...options }),
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

### 流式版本（SSE，Web 平台推荐）

```typescript
// edge-functions/minimax-chat-stream.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let model: string;
  let messages: unknown[];
  let options: Record<string, unknown> = {};

  try {
    const body = await req.json();
    model = body.model ?? "MiniMax-M2.5";
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Missing or empty messages");
    }
    const { max_completion_tokens, temperature, top_p, tools, tool_choice } = body;
    if (max_completion_tokens !== undefined) options.max_completion_tokens = max_completion_tokens;
    if (temperature !== undefined) options.temperature = temperature;
    if (top_p !== undefined) options.top_p = top_p;
    if (tools !== undefined) options.tools = tools;
    if (tool_choice !== undefined) options.tool_choice = tool_choice;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游（流式）---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Aa2PqMJnJGwL-gateway.appmiaoda.com/v1/text/chatcompletion_v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true, stream_options: { include_usage: true }, ...options }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: "Upstream error" }), { status: 502 });
  }

  // 直接透传 SSE 流，不缓冲
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

### Web 平台 — 非流式

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * 调用 MiniMax 非流式对话补全（通过 Edge Function）。
 * @param messages - 对话历史消息数组
 * @param options - 可选参数（temperature、max_completion_tokens 等）
 * @returns 模型回复的文本内容
 */
async function fetchMiniMaxChat(
  messages: Array<{ role: string; content: string; name?: string }>,
  options: {
    model?: string;
    max_completion_tokens?: number;
    temperature?: number;
    top_p?: number;
  } = {}
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-chat", {
    body: { messages, model: options.model ?? "MiniMax-M2.5", ...options },
  });

  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }

  return data.choices[0].message.content;
}

// 使用示例
const reply = await fetchMiniMaxChat([
  { role: "system", content: "你是一个智能助手。", name: "MiniMax AI" },
  { role: "user", content: "请用三句话介绍 MiniMax。", name: "用户" },
]);
console.log(reply);
```

### Web 平台 — 流式（SSE）

安装依赖：
```bash
npm install ky@^1.2.3 eventsource-parser@^3.0.3
```

```typescript
import ky, { type AfterResponseHook } from "ky";
import { createParser } from "eventsource-parser";
import { useState, useRef } from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 创建 SSE Hook，将流式事件逐块转发给回调。
 * @param onChunk - 每收到一个文本增量时调用
 * @param onDone - 流结束时调用
 * @param onError - 出错时调用
 */
function createMiniMaxSSEHook(
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): AfterResponseHook {
  return async (_request, _opts, response) => {
    if (!response.ok || !response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf8");
    const parser = createParser({
      onEvent: (event) => {
        if (!event.data || event.data === "[DONE]") return;
        try {
          const parsed = JSON.parse(event.data);
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) onChunk(delta);
        } catch { /* 不完整 chunk，跳过 */ }
      },
    });

    const read = (): void => {
      reader.read().then(({ done, value }) => {
        if (done) { onDone(); return; }
        parser.feed(decoder.decode(value, { stream: true }));
        read();
      }).catch((err) => onError(err as Error));
    };

    read();
    return response;
  };
}

/**
 * 流式调用 MiniMax 对话补全，实时输出文本增量。
 * @param messages - 对话历史
 * @param onChunk - 每收到增量文本时调用
 * @param onDone - 流结束时调用
 * @param signal - AbortSignal，用于取消请求
 */
async function streamMiniMaxChat(
  messages: Array<{ role: string; content: string; name?: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  await ky.post(`${supabaseUrl}/functions/v1/minimax-chat-stream`, {
    json: { model: "MiniMax-M2.5", messages },
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    signal,
    hooks: {
      afterResponse: [createMiniMaxSSEHook(onChunk, onDone, (err) => { throw err; })],
    },
  });
}

// React 组件使用示例
function ChatDemo() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = async () => {
    setContent("");
    setLoading(true);
    abortRef.current = new AbortController();

    await streamMiniMaxChat(
      [
        { role: "system", content: "你是智能助手。", name: "MiniMax AI" },
        { role: "user", content: "介绍一下你自己。", name: "用户" },
      ],
      (chunk) => setContent((prev) => prev + chunk),
      () => setLoading(false),
      abortRef.current.signal
    );
  };

  const handleStop = () => abortRef.current?.abort();

  return (
    <div>
      <button onClick={handleSend} disabled={loading}>发送</button>
      <button onClick={handleStop} disabled={!loading}>停止</button>
      <p>{content}</p>
    </div>
  );
}
```

### MiniProgram 平台 — 非流式

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 小程序端调用 MiniMax 非流式对话补全。
 * @param messages - 对话历史
 * @param options - 可选参数
 * @returns 模型回复文本
 */
async function fetchMiniMaxChatMP(
  messages: Array<{ role: string; content: string; name?: string }>,
  options: { model?: string; temperature?: number; max_completion_tokens?: number } = {}
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-chat", {
    body: { messages, model: options.model ?? "MiniMax-M2.5", ...options },
  });

  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }

  return data.choices[0].message.content;
}
```

> **注意：** MiniProgram 平台（Taro/微信小程序）中，流式 SSE 的 ReadableStream API 支持有限，
> 建议优先使用非流式接口；如需流式效果，可在客户端用轮询或分段请求模拟。

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露给前端或客户端代码。
2. **错误处理**：
   - 务必检查 `base_resp.status_code`（非 0 表示业务错误）；
   - 处理 HTTP 429（触发限流）和 402（余额不足）；
   - 输入/输出命中敏感词时（`input_sensitive`/`output_sensitive` 为 `true`），回复内容可能为空。
3. **计费**：当前 original_price 为 0.00（免费），但 `need_count_calls: true` 表示调用次数仍会统计，避免不必要的重复调用。
4. **流式输出**：推理模型（MiniMax-M2.5）建议使用流式输出以获得最佳体验；流式请求结束后会在最后一个 chunk 中附带 `usage` 统计（需设置 `stream_options.include_usage: true`）。
5. **Token 限制**：MiniMax-M2.5 默认 `max_completion_tokens` 为 10240；若生成因 `length` 原因中断，请调高此值。
6. **图文混合输入**：`content` 传数组格式时，`image_url.url` 支持公网 URL 或 Base64 Data URL；MiniProgram 中建议使用公网 URL。
7. **工具调用**：使用 `tools` + `tool_choice: "auto"` 时，模型返回 `finish_reason: "tool_calls"`，需解析 `choices[].message.tool_calls` 并将工具执行结果以 `role: "tool"` 消息追加后继续调用。
