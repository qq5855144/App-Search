# MiniMax Chat Completions API参考

## API 基本信息

| 属性 | 值 |
|------|----|
| 能力 | 文本对话补全、图片理解、视频理解、深度思考、工具调用、SSE 流式输出 |
| 主调用接口 | `POST https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions` |
| Endpoint 形式 | `https://{APP_ID}@app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions` |
| 官方来源接口 | `POST https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions`（仅用于接口来源说明，Skill 调用使用 `APP_ID@` 网关形式） |
| Third-party Domain | `app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com` |
| Auth 模式 | Platform Managed |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| 推荐模型 | `MiniMax-M3` |
| 流式支持 | 是（`stream: true` 开启 SSE） |

MiniMax-M3 支持 1M 超长上下文、Coding/Agentic 场景、多模态理解和可控深度思考。当前 Skill 使用平台托管网关调用 MiniMax Chat Completions API，Endpoint 必须采用 `APP_ID@app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com` 形式，密钥由平台注入，文档中不要写入真实 API Key。

## 目录

- [API 基本信息](#api-基本信息)
- [请求参数表](#请求参数表)
- [messages 结构](#messages-结构)
- [响应字段表](#响应字段表)
- [请求示例](#请求示例)
- [生成期代码](#生成期代码)
- [Edge Function 代码](#edge-function-代码)
- [前端调用代码](#前端调用代码)
- [注意事项](#注意事项)

---

## 请求参数表

### 请求头

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `Content-Type` | string | 是 | 固定为 `application/json` |
| `X-Gateway-Authorization` | string | 是 | `Bearer ${INTEGRATIONS_API_KEY}`，平台托管密钥 |

### 请求体

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型 ID，推荐 `MiniMax-M3` |
| `messages` | array | 是 | — | 对话历史消息列表，支持文本、图片、视频和工具消息 |
| `thinking` | object | 否 | `{ "type": "adaptive" }` | 控制深度思考，`type` 可为 `disabled` 或 `adaptive` |
| `reasoning_split` | boolean | 否 | `false` | 启用后将思考内容拆分到 `reasoning_content` 和 `reasoning_details` |
| `stream` | boolean | 否 | `false` | 是否使用 SSE 流式传输 |
| `stream_options` | object | 否 | — | 流式配置，如 `{ "include_usage": true }` |
| `max_completion_tokens` | integer | 否 | — | 生成内容长度上限；MiniMax-M3 推荐 131072，上限 524288 |
| `temperature` | number | 否 | `1` | 温度系数，范围 `[0, 2]` |
| `top_p` | number | 否 | `0.95` | 核采样参数，范围 `[0, 1]` |
| `tools` | array | 否 | — | function 工具定义列表 |
| `tool_choice` | string | 否 | `auto` | 工具调用策略，常用 `none` / `auto` |
| `response_format` | object | 否 | — | 可用于结构化输出，如 JSON Schema |
| `max_tokens` | integer | 否 | — | 已弃用，请改用 `max_completion_tokens` |

### 可用模型

| 模型 | 说明 |
|------|------|
| `MiniMax-M3` | 推荐模型，支持 1M 上下文、多模态和 thinking |
| `MiniMax-M2.7` / `MiniMax-M2.7-highspeed` | M2.7 系列 |
| `MiniMax-M2.5` / `MiniMax-M2.5-highspeed` | M2.5 系列 |
| `MiniMax-M2.1` / `MiniMax-M2.1-highspeed` | M2.1 系列 |
| `MiniMax-M2` | M2 系列 |

### `thinking` 参数

```json
{
  "thinking": { "type": "adaptive" }
}
```

| 字段 | 类型 | 取值 | 说明 |
|------|------|------|------|
| `type` | string | `disabled` / `adaptive` | `disabled` 关闭思考；`adaptive` 由模型自主判断是否需要思考，推荐默认使用 |

---

## messages 结构

### Message 字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `role` | string | 是 | `system` / `user` / `assistant` / `tool` |
| `name` | string | 否 | 发送者名称，同类角色多个时可用于区分 |
| `content` | string \| array | tool 角色除外 | 文本内容或多模态内容块数组 |
| `tool_calls` | array | 否 | assistant 消息中的工具调用列表 |
| `tool_call_id` | string | tool 角色必填 | 对应上一轮 assistant `tool_calls[].id` |

### 多模态内容块

MiniMax-M3 的 `content` 支持数组形式：

```json
[
  { "type": "text", "text": "这张图片的内容是什么？" },
  {
    "type": "image_url",
    "image_url": {
      "url": "https://example.com/image.jpg",
      "detail": "default"
    }
  }
]
```

| 内容块类型 | 字段 | 说明 |
|------------|------|------|
| `text` | `text` | 文本内容 |
| `image_url` | `image_url.url` | 图片 URL 或 Base64 data URL |
| `image_url` | `image_url.detail` | 图片解析分辨率，`low` / `default` / `high` |
| `image_url` | `image_url.max_long_side_pixel` | 图片最长边像素限制 |
| `video_url` | `video_url.url` | 视频 URL、Base64 data URL 或 `mm_file://{file_id}` |
| `video_url` | `video_url.detail` | 视频抽帧分辨率，`low` / `default` / `high` |
| `video_url` | `video_url.fps` | 视频抽帧频率，范围 `[0.2, 5]`，默认 `1` |
| `video_url` | `video_url.max_long_side_pixel` | 视频单帧最长边像素限制 |

### 多模态限制

| 输入方式 | 限制 |
|----------|------|
| 图片 URL / Base64 | 单张图片最大 10 MB |
| 视频 URL / Base64 | 单个视频最大 50 MB |
| 请求体 | 最大 64 MB |
| Files API 视频 | 单个视频最大 512 MB，使用 `mm_file://{file_id}` 引用 |

支持的图片格式包括 JPEG、PNG、GIF、WEBP。支持的视频格式包括 MP4、AVI、MOV、MKV。

---

## 响应字段表

### 非流式响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `id` | string | 响应唯一 ID |
| `object` | string | `chat.completion` |
| `created` | integer | Unix 时间戳（秒） |
| `model` | string | 使用的模型 ID |
| `choices` | array | 响应选择列表 |
| `choices[].index` | integer | 选项索引 |
| `choices[].finish_reason` | string | `stop` / `length` / `content_filter` / `tool_calls` |
| `choices[].message.role` | string | 固定为 `assistant` |
| `choices[].message.content` | string | 模型回复内容 |
| `choices[].message.reasoning_content` | string | 思考内容，仅启用 `reasoning_split` 时返回 |
| `choices[].message.reasoning_details` | array | 结构化思考内容，仅启用 `reasoning_split` 时返回 |
| `choices[].message.tool_calls` | array | 工具调用列表，仅工具调用时返回 |
| `usage.total_tokens` | integer | 总 token 数 |
| `usage.prompt_tokens` | integer | 输入 token 数，响应中可能返回 |
| `usage.completion_tokens` | integer | 输出 token 数，响应中可能返回 |
| `usage.prompt_tokens_details.cached_tokens` | integer | 命中缓存的输入 token 数，响应中可能返回 |
| `input_sensitive` | boolean | 输入内容是否命中敏感词 |
| `input_sensitive_type` | integer | 输入敏感词类型 |
| `output_sensitive` | boolean | 输出内容是否命中敏感词 |
| `output_sensitive_type` | integer | 输出敏感词类型 |
| `base_resp.status_code` | integer | 业务状态码，`0` 表示成功 |
| `base_resp.status_msg` | string | 错误详情 |

### 流式响应

流式响应通过 SSE 返回，每个 chunk 的 `object` 为 `chat.completion.chunk`。核心增量字段为 `choices[].delta.content`。

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `choices[].delta.role` | string | 固定为 `assistant` |
| `choices[].delta.content` | string | 本 chunk 的文本增量 |
| `choices[].delta.reasoning_content` | string | 思考增量，启用相关能力时可能出现 |
| `choices[].delta.tool_calls` | array | 工具调用增量，需按 index 拼接 |
| `choices[].finish_reason` | string \| null | 未结束时为空，结束时为 `stop` / `length` / `tool_calls` 等 |
| `usage` | object \| null | 设置 `stream_options.include_usage: true` 后，最后一个 chunk 可包含用量 |

### 错误状态码

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

## 请求示例

### 文本对话

```json
{
  "model": "MiniMax-M3",
  "thinking": { "type": "adaptive" },
  "messages": [
    { "role": "user", "content": "请用一句话介绍 MiniMax-M3。" }
  ],
  "max_completion_tokens": 500
}
```

### 图片理解

```json
{
  "model": "MiniMax-M3",
  "thinking": { "type": "adaptive" },
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "这张图片的内容是什么？" },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/image.jpg",
            "detail": "default"
          }
        }
      ]
    }
  ],
  "max_completion_tokens": 500
}
```

### 视频理解

```json
{
  "model": "MiniMax-M3",
  "thinking": { "type": "adaptive" },
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "这个视频里发生了什么？" },
        {
          "type": "video_url",
          "video_url": {
            "url": "https://example.com/video.mp4",
            "fps": 1,
            "detail": "default"
          }
        }
      ]
    }
  ],
  "max_completion_tokens": 500
}
```

### 深度思考与思考拆分

```json
{
  "model": "MiniMax-M3",
  "thinking": { "type": "adaptive" },
  "reasoning_split": true,
  "messages": [
    { "role": "user", "content": "9.11 和 9.9 哪个更大？" }
  ],
  "max_completion_tokens": 500
}
```

### 流式输出

```json
{
  "model": "MiniMax-M3",
  "thinking": { "type": "adaptive" },
  "messages": [
    { "role": "user", "content": "请介绍一下你自己。" }
  ],
  "stream": true,
  "stream_options": { "include_usage": true },
  "max_completion_tokens": 500
}
```

### 工具调用

```json
{
  "model": "MiniMax-M3",
  "messages": [
    { "role": "user", "content": "旧金山现在天气怎么样？" }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather for a given location.",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state/country, e.g. San Francisco, US"
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

工具调用返回后，下一轮请求需要回带 assistant 的 `tool_calls`，并追加工具结果：

```json
{
  "role": "tool",
  "tool_call_id": "call_function_xxx",
  "content": "{\"temperature\":18,\"condition\":\"Cloudy\"}"
}
```

---

## 生成期代码

直接在脚本或 Agent 中调用托管网关接口，密钥从平台环境变量读取。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface TextContentPart {
  type: "text";
  text: string;
}

interface ImageContentPart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "default" | "high";
    max_long_side_pixel?: number;
  };
}

interface VideoContentPart {
  type: "video_url";
  video_url: {
    url: string;
    detail?: "low" | "default" | "high";
    fps?: number;
    max_long_side_pixel?: number;
  };
}

type MessageContent = string | Array<TextContentPart | ImageContentPart | VideoContentPart>;

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: MessageContent;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  thinking?: { type: "disabled" | "adaptive" };
  reasoning_split?: boolean;
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: Array<{
    type: "function";
    function: { name: string; description?: string; parameters: object };
  }>;
  tool_choice?: "none" | "auto";
  response_format?: object;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
    index: number;
    message: {
      content: string;
      reasoning_content?: string;
      reasoning_details?: Array<Record<string, unknown>>;
      role: "assistant";
      name?: string;
      tool_calls?: ToolCall[];
      audio_content?: string;
    };
  }>;
  created: number;
  model: string;
  object: "chat.completion";
  usage?: {
    total_tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  input_sensitive?: boolean;
  input_sensitive_type?: number;
  output_sensitive?: boolean;
  output_sensitive_type?: number;
  base_resp?: { status_code: number; status_msg: string };
}

async function callMiniMaxChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions",
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

  const json = (await response.json()) as ChatCompletionResponse;
  if (json.base_resp && json.base_resp.status_code !== 0) {
    throw new Error(`MiniMax API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }

  return json;
}

const result = await callMiniMaxChat({
  model: "MiniMax-M3",
  thinking: { type: "adaptive" },
  messages: [{ role: "user", content: "请用一句话介绍 MiniMax-M3。" }],
  max_completion_tokens: 500,
});

console.log(result.choices[0].message.content);
```

---

## Edge Function 代码

### 非流式版本（Web + MiniProgram 通用）

```typescript
// edge-functions/minimax-m3.ts
import { serve } from "https://deno.land/std/http/server.ts";

const ALLOWED_FIELDS = [
  "model",
  "messages",
  "thinking",
  "reasoning_split",
  "max_completion_tokens",
  "temperature",
  "top_p",
  "tools",
  "tool_choice",
  "response_format",
] as const;

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    const body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("Missing or empty messages");
    }
    payload = { model: "MiniMax-M3" };
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) payload[field] = body[field];
    }
    payload.stream = false;
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

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 流式版本（SSE，Web 推荐）

```typescript
// edge-functions/minimax-m3-stream.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new Error("Missing or empty messages");
    }
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

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...body,
        model: body.model ?? "MiniMax-M3",
        stream: true,
        stream_options: { include_usage: true, ...(body.stream_options as object | undefined) },
      }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text();
    return new Response(errorText || JSON.stringify({ error: "Upstream error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
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

### Web 平台 — 非流式

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

async function fetchMiniMaxChat(
  messages: Array<{ role: string; content: unknown; name?: string }>,
  options: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-m3", {
    body: {
      model: "MiniMax-M3",
      thinking: { type: "adaptive" },
      messages,
      ...options,
    },
  });

  if (error) throw error;
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }

  return data.choices[0].message.content;
}
```

### Web 平台 — 流式 SSE

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function streamMiniMaxChat(
  messages: Array<{ role: string; content: unknown; name?: string }>,
  onChunk: (text: string) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/minimax-m3-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`,
      "apikey": supabaseAnonKey,
    },
    body: JSON.stringify({
      model: "MiniMax-M3",
      thinking: { type: "adaptive" },
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const data = dataLine.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta?.content ?? "";
      if (delta) onChunk(delta);
    }
  }

  onDone();
}
```

### MiniProgram 平台 — 非流式

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchMiniMaxChatMP(
  messages: Array<{ role: string; content: unknown; name?: string }>,
  options: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-m3", {
    body: {
      model: "MiniMax-M3",
      thinking: { type: "adaptive" },
      messages,
      ...options,
    },
  });

  if (error) throw error;
  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }

  return data.choices[0].message.content;
}
```

MiniProgram 平台的 `ReadableStream` / SSE 支持受运行时限制影响，推荐优先使用非流式接口；若需要流式体验，可通过轮询、分段请求或平台特定网络 API 实现近似效果。

---

## 注意事项

1. **密钥安全**：只在生成期脚本或 Edge Function 服务端读取 `${INTEGRATIONS_API_KEY}`，不要把真实密钥写入 Skill 文档、前端代码或日志。
2. **托管网关与官方接口**：当前 Skill 通过托管网关接口调用；如直接调用官方接口，应改用官方 Bearer API Key 和 `Authorization` Header。
3. **MiniMax-M3 推荐配置**：`thinking.type` 推荐 `adaptive`，`top_p` 推荐 `0.95`，长输出可设置 `max_completion_tokens: 131072`。
4. **Token 限制**：MiniMax-M3 `max_completion_tokens` 上限 524288；其他 M2.x 模型上限通常更低。
5. **思考内容**：不开启 `reasoning_split` 时，思考内容可能混在 `message.content` 中；开启后可读取 `reasoning_content` / `reasoning_details`。
6. **工具调用**：`finish_reason: "tool_calls"` 表示需要执行工具，再将工具结果以 `role: "tool"` 和 `tool_call_id` 回填继续调用。
7. **流式输出**：设置 `stream_options.include_usage: true` 后，最后一个 chunk 可能包含 usage；前端解析时需要允许 `usage` 为 `null`。
8. **多模态输入**：图片和视频 URL 应可公网访问；MiniProgram 中优先使用公网 URL，避免大型 Base64 请求体。
9. **敏感词处理**：检查 `input_sensitive` 和 `output_sensitive`；严重违规时回复内容可能为空或触发错误。
10. **错误处理**：同时检查 HTTP 状态码和 `base_resp.status_code`，对限流、余额不足、Token 超限和参数错误分别处理。
