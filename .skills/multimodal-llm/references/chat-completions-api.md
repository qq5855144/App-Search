# chat-completions-api — 文心一言多模态输入大模型接口

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `822bc679-0277-46ac-b8aa-b91f49a3605b` |
| API ID | `api-k93RZBjPykEa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com/v2/chat/completions` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| 响应类型 | SSE 流式（`text/event-stream`） |
| third_part_domain | `app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `messages` | `array` | 是 | 聊天历史信息列表，支持 system / user / assistant 角色 |
| `messages[].role` | `string` | 是 | 角色类型：`system` / `user` / `assistant` |
| `messages[].content` | `array` | 是 | 多模态内容数组 |
| `messages[].content[].type` | `string` | 是 | 内容类型：`text` / `image_url` |
| `messages[].content[].text` | `string` | 条件必填 | 文本信息（`type` 为 `text` 时必填） |
| `messages[].content[].image_url` | `object` | 条件必填 | 图像 URL 信息（`type` 为 `image_url` 时有效） |
| `messages[].content[].image_url.url` | `string` | 条件必填 | 图像 URL 或 Base64 编码；不超过 1024 字节；单图不超过 10 MB |
| `enable_thinking` | `boolean` | 否 | 是否开启思考模式，默认 `false` |

> **messages 规则**：
> - 数组不能为空；1 个成员表示单轮对话，多个成员表示多轮对话
> - 输入总长度上限：上下文 32k token，单次最大 27k token
> - 图片格式：JPG / JPEG / PNG / BMP，单图不超过 10 MB
> - `image_url.url` 支持图片链接或 Base64 编码（格式：`data:image/<格式>;base64,<编码>`）

---

## 响应字段表

### 成功响应（流式 chunk）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `id` | `string` | 会话唯一标识，如 `as-9ki4hm6kkp` |
| `choices` | `array` | 生成结果数组 |
| `choices[].index` | `number` | 选项索引，通常为 `0` |
| `choices[].delta.role` | `string` | 角色，通常为 `assistant` |
| `choices[].delta.content` | `string` | 本块生成的文本内容 |
| `choices[].finish_reason` | `string` | 结束原因：`stop` / `length` / `content_filter` / `tool_calls` |
| `choices[].flag` | `number` | `0` 表示正常，非 `0` 表示触发安全检测 |

### 错误响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error.type` | `string` | 错误类型，如 `invalid_request_error` |
| `error.code` | `string` | 错误码，如 `invalid_model` |
| `error.message` | `string` | 错误描述信息 |

### 常见错误码

| 错误码 | 说明 |
|--------|------|
| `invalid_model` | 模型不存在或无访问权限 |
| `characters_too_long` | 输入字符超过限制 |
| `tokens_too_long` | 输入 token 超过限制 |
| `image_url_unsafe` | 图像 URL 内容不安全 |
| `rpm_rate_limit_exceeded` | 达到每分钟请求数限制 |
| `tpm_rate_limit_exceeded` | 达到每分钟 token 数限制 |

---

## 生成期代码

在 Deno 脚本中直接调用上游 SSE 接口（生成期验证/批处理场景）。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface MultimodalMessage {
  role: "system" | "user" | "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
}

interface ChatChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
    flag: number;
  }>;
}

/**
 * 调用文心一言多模态接口，收集完整流式响应后返回拼接文本。
 * @param messages 聊天消息数组（支持 text 和 image_url 混合）
 * @param enableThinking 是否开启思考模式，默认 false
 * @returns 模型生成的完整文本内容
 */
async function callMultimodalChat(
  messages: MultimodalMessage[],
  enableThinking = false
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, enable_thinking: enableThinking }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === "[DONE]") break;
      try {
        const parsed: ChatChunk = JSON.parse(raw);
        fullContent += parsed.choices[0]?.delta?.content ?? "";
      } catch {
        // 不完整 chunk，跳过
      }
    }
  }

  return fullContent;
}

// 使用示例：图文分析
const result = await callMultimodalChat([
  {
    role: "user",
    content: [
      { type: "text", text: "分析这张图片的季节和主要元素" },
      { type: "image_url", image_url: { url: "https://example.com/autumn.jpg" } },
    ],
  },
]);
console.log(result);
```

---

## Edge Function 代码

### Web 平台 Edge Function

SSE 流直接透传给前端，前端使用 `eventsource-parser` 解析。

```typescript
// edge-functions/multimodal-chat.ts（Web 平台）
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
  let messages: unknown[];
  let enableThinking: boolean | undefined;
  try {
    const body = await req.json();
    messages = body.messages;
    enableThinking = body.enable_thinking;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages 不能为空");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. 读取平台密钥（严禁暴露至前端）
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. 调用上游 SSE 接口
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, enable_thinking: enableThinking ?? false }),
    }
  );

  // 转发配额/余额错误
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

  // 4. 直接透传 SSE 流
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

### MiniProgram 平台 Edge Function

与 Web 端相同——同样直接透传 SSE 流，前端使用 `sendChatStream`（`miaoda-taro-utils`）接收。

```typescript
// edge-functions/multimodal-chat.ts（MiniProgram 平台，与 Web 端实现相同）
// 注意：Taro.request 会将 SSE 流二次序列化，必须使用 miaoda-taro-utils 的 sendChatStream
// 而非 Taro.request 直接请求此 Edge Function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let messages: unknown[];
  let enableThinking: boolean | undefined;
  try {
    const body = await req.json();
    messages = body.messages;
    enableThinking = body.enable_thinking;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages 不能为空");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, enable_thinking: enableThinking ?? false }),
    }
  );

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

  return new Response(upstream.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
```

---

## 前端调用代码

### Web 平台前端

依赖安装：

```bash
npm install ky@^1.2.3 eventsource-parser@^3.0.3
# 可选：流式 Markdown 渲染
npm install streamdown@^1.4.0
```

SSE 工具函数（`lib/sse.ts`）：

```typescript
import ky, { type AfterResponseHook } from "ky";
import { createParser } from "eventsource-parser";

export interface SSEOptions {
  onData: (data: string) => void;
  onEvent?: (event: unknown) => void;
  onCompleted?: (error?: Error) => void;
  onAborted?: () => void;
}

/**
 * 创建 SSE AfterResponseHook，用于解析流式响应。
 * @param options SSE 回调选项
 * @returns ky AfterResponseHook
 */
export function createSSEHook(options: SSEOptions): AfterResponseHook {
  return async (request, _opts, response) => {
    if (!response.ok || !response.body) return;

    let done = false;
    const finish = (err?: Error) => {
      if (!done) { done = true; options.onCompleted?.(err); }
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const parser = createParser({
      onEvent: (event) => {
        if (!event.data) return;
        options.onEvent?.(event);
        for (const chunk of event.data.split("\n")) options.onData(chunk);
      },
    });

    const read = (): void => {
      reader.read().then(({ done: streamDone, value }) => {
        if (streamDone) { finish(); return; }
        parser.feed(decoder.decode(value, { stream: true }));
        read();
      }).catch((err) => {
        if (request.signal.aborted) { options.onAborted?.(); return; }
        finish(err as Error);
      });
    };
    read();
    return response;
  };
}

export interface StreamRequestOptions {
  functionUrl: string;
  requestBody: unknown;
  supabaseAnonKey: string;
  onData: (data: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * 发送流式请求到 Supabase Edge Function，通过 SSE 接收响应。
 * @param options 流式请求选项
 */
export async function sendStreamRequest(options: StreamRequestOptions): Promise<void> {
  const { functionUrl, requestBody, supabaseAnonKey, onData, onComplete, onError, signal } = options;

  const sseHook = createSSEHook({
    onData,
    onCompleted: (err) => (err ? onError(err) : onComplete()),
    onAborted: () => console.log("Stream aborted"),
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
  } catch (err) {
    if (!signal?.aborted) onError(err as Error);
  }
}
```

React 组件调用示例：

```typescript
import { useState, useRef } from "react";
import { sendStreamRequest } from "./lib/sse";
// 可选：import { Streamdown } from "streamdown";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface Message {
  role: "system" | "user" | "assistant";
  content: ContentItem[];
}

/**
 * Web 端：发送多模态流式聊天请求。
 * @param messages 聊天消息（支持 text 和 image_url 混合）
 * @param onChunk 每收到一块文本时的回调
 * @param onDone 流式完成回调
 * @param signal AbortSignal（可选，用于中断请求）
 */
async function sendMultimodalChat(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<void> {
  await sendStreamRequest({
    functionUrl: `${supabaseUrl}/functions/v1/multimodal-chat`,
    requestBody: { messages },
    supabaseAnonKey,
    onData: (rawData) => {
      try {
        if (rawData === "[DONE]") return;
        const parsed = JSON.parse(rawData);
        // 响应格式：{ choices: [{ delta: { content: "..." } }] }
        const chunk = parsed.choices?.[0]?.delta?.content ?? "";
        if (chunk) onChunk(chunk);
      } catch {
        // 不完整 chunk，跳过
      }
    },
    onComplete: onDone,
    onError: (err) => console.error("Stream error:", err),
    signal,
  });
}

// React 组件示例
export function MultimodalChatWeb() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = async (text: string, imageUrl?: string) => {
    setContent("");
    setIsLoading(true);
    abortRef.current = new AbortController();

    const contentItems: ContentItem[] = [{ type: "text", text }];
    if (imageUrl) {
      contentItems.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    await sendMultimodalChat(
      [{ role: "user", content: contentItems }],
      (chunk) => setContent((prev) => prev + chunk),
      () => setIsLoading(false),
      abortRef.current.signal
    );
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  return (
    <div>
      <div>{content}</div>
      {/* 可选 Markdown 渲染：<Streamdown parseIncompleteMarkdown isAnimating={isLoading}>{content}</Streamdown> */}
      <button onClick={() => handleSend("描述这张图片", "https://example.com/image.jpg")}>
        发送
      </button>
      {isLoading && <button onClick={handleAbort}>停止</button>}
    </div>
  );
}
```

---

### MiniProgram 平台前端

依赖安装：

```bash
pnpm add miaoda-taro-utils@^0.0.4
```

图片工具函数（`utils/image.ts`）：

> **重要**：在 H5 环境下，`Taro.getFileSystemManager` 不可用，必须使用以下 `imageToBase64` 方法确保 H5 和小程序均可将图片转为 Base64。

```typescript
import Taro from "@tarojs/taro";

/**
 * 将图片路径转换为 Base64 编码字符串（兼容小程序和 H5 环境）。
 * @param imagePath 本地图片路径或网络图片 URL
 * @returns Base64 编码字符串（含 data URI 前缀）
 */
export const imageToBase64 = async (imagePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
        // 小程序环境
        const fs = Taro.getFileSystemManager();
        fs.readFile({
          filePath: imagePath,
          encoding: "base64",
          success: (res) => {
            const extension = imagePath.split(".").pop()?.toLowerCase();
            const mimeTypeMap: Record<string, string> = {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
              bmp: "image/bmp",
            };
            const mimeType = mimeTypeMap[extension ?? ""] ?? "image/jpeg";
            resolve(`data:${mimeType};base64,${res.data}`);
          },
          fail: (error) => {
            console.error("读取图片文件失败:", error);
            reject(new Error("图片转换失败"));
          },
        });
      } else {
        // H5 环境
        if (imagePath.startsWith("data:")) {
          resolve(imagePath);
          return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          } catch (error) {
            console.error("Canvas 转换失败:", error);
            reject(new Error("图片处理失败"));
          }
        };
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = imagePath;
      }
    } catch (error) {
      console.error("图片转 base64 出错:", error);
      reject(new Error("图片处理失败"));
    }
  });
};

/**
 * 压缩图片（小程序环境调用原生 API，H5 环境直接返回原路径）。
 * @param imagePath 图片路径
 * @param quality 压缩质量，0-1，默认 0.8
 * @returns 压缩后的图片路径
 */
export function compressImage(imagePath: string, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
      resolve(imagePath);
    } else {
      Taro.compressImage({
        src: imagePath,
        quality: quality * 100,
        success: (res) => resolve(res.tempFilePath),
        fail: (error) => {
          console.warn("图片压缩失败，使用原图:", error);
          resolve(imagePath);
        },
      });
    }
  });
}
```

MiniProgram 组件调用示例：

```typescript
import Taro from "@tarojs/taro";
import { useState } from "@tarojs/taro";
import { sendChatStream } from "miaoda-taro-utils/chatStream";
import { imageToBase64, compressImage } from "./utils/image";

const supabaseUrl = process.env.TARO_APP_SUPABASE_URL;

interface ContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/**
 * MiniProgram 端：处理图片并发送多模态流式聊天请求。
 * @param text 文本输入内容
 * @param imagePath 本地图片路径（可选）
 * @param onChunk 每收到一块文本时的回调
 * @param onDone 流式完成回调
 */
const processAndSendChat = async (
  text: string,
  imagePath: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: () => void
) => {
  const contentItems: ContentItem[] = [{ type: "text", text }];

  if (imagePath) {
    // 1. 压缩图片（可选）
    const compressedPath = await compressImage(imagePath, 0.8);
    // 2. 转换为 Base64（必须使用 imageToBase64，不可使用 Taro.getFileSystemManager 直接在 H5 中调用）
    const base64Image = await imageToBase64(compressedPath);
    contentItems.push({ type: "image_url", image_url: { url: base64Image } });
  }

  const { abort } = sendChatStream({
    // 注意：appId 必须填入空字符串，否则会导致无法请求
    endpoint: `${supabaseUrl}/functions/v1/multimodal-chat?name=test`,
    appId: "",
    messages: [{ role: "user", content: contentItems }],
    /**
     * @param rawData 原始 SSE 数据字符串
     * 格式：data: {"id":"...","choices":[{"delta":{"content":"内容"}}]}
     * 注意：Taro.request 会将 SSE 二次序列化，需先 JSON.parse 还原再解析
     */
    onUpdate: (rawData: string) => {
      try {
        if (rawData !== "[DONE]") {
          const data = JSON.parse(rawData);
          const chunk = data.choices?.[0]?.delta?.content ?? "";
          if (chunk) onChunk(chunk);
        }
      } catch (e) {
        console.error("解析流数据失败:", e);
      }
    },
    onComplete: onDone,
    onError: (error: Error) => {
      console.error("流式请求失败:", error);
    },
  });

  return abort;
};

// Taro 组件示例
export function MultimodalChatMiniProgram() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  let abortFn: (() => void) | null = null;

  const handleSend = async () => {
    setContent("");
    setIsLoading(true);

    const imagePath = ""; // 通过 Taro.chooseImage 获取的本地路径

    abortFn = await processAndSendChat(
      "请描述这张图片",
      imagePath || undefined,
      // 注意：避免在 useCallback/useEffect 中监听流式数据，以免产生循环
      (chunk) => setContent((prev) => prev + chunk),
      () => setIsLoading(false)
    );
  };

  const handleAbort = () => {
    abortFn?.();
    setIsLoading(false);
  };

  return (
    <div>
      <div>{content}</div>
      <button onClick={handleSend}>发送</button>
      {isLoading && <button onClick={handleAbort}>停止</button>}
    </div>
  );
}
```

---

### App 平台

依赖安装：

```bash
pnpm add eventsource-parser react-native-marked
npx expo install expo-image-picker
```

- `expo/fetch`：Expo 内置，**必须使用此包而非全局 fetch**（RN 原生 fetch 不支持流式 `response.body`）
- `eventsource-parser`：SSE 事件解析器，纯 JS 实现，兼容 React Native
- `react-native-marked`：Markdown 渲染组件
- `expo-image-picker`：图片选择器，支持获取 base64

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

**App 端调用示例（图文多模态）：**

```tsx
import { useState, useCallback, useRef } from 'react';
import { View, Button, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Markdown from 'react-native-marked';
import { sendStreamRequest } from '@/utils/streamRequest';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export function MultimodalChatApp() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const streamingContentRef = useRef('');
  const abortControllerRef = useRef<AbortController | null>(null);

  /** 选取图片并获取 base64 */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true, // 关键：获取 base64 数据
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSend = useCallback(async (userInput: string) => {
    streamingContentRef.current = '';
    abortControllerRef.current = new AbortController();
    setContent('');
    setIsStreaming(true);

    // 构建多模态 content
    const contentItems: Array<any> = [{ type: 'text', text: userInput }];
    if (selectedImage) {
      contentItems.push({ type: 'image_url', image_url: { url: selectedImage } });
    }

    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/multimodal-chat`,
      requestBody: { messages: [{ role: 'user', content: contentItems }] },
      supabaseAnonKey,
      signal: abortControllerRef.current.signal,
      onData: (data) => {
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
          if (!chunk) return;
          streamingContentRef.current += chunk;
          setContent(streamingContentRef.current);
        } catch {}
      },
      onComplete: () => {
        setContent(streamingContentRef.current);
        setIsStreaming(false);
      },
      onError: () => setIsStreaming(false),
    });
  }, [selectedImage]);

  return (
    <View>
      <Button title="选择图片" onPress={pickImage} />
      {selectedImage && <Image source={{ uri: selectedImage }} style={{ width: 100, height: 100 }} />}
      <Markdown value={content} flatListProps={{ scrollEnabled: false }} />
      {isStreaming && <Button title="停止生成" onPress={() => abortControllerRef.current?.abort()} />}
    </View>
  );
}
```

**CRITICAL 注意事项（App 平台）：**

- **必须使用 `expo/fetch`**，RN 原生 fetch 不支持流式 `response.body`
- 图片使用 `expo-image-picker` 选取，设置 `base64: true` 获取 base64 数据
- 图片传入格式为 `data:image/jpeg;base64,{base64Data}`，通过 `image_url.url` 字段传递
- 用 `useRef` 累积流式内容再 flush 到 state，避免闭包捕获旧 state 导致死循环
- 使用 `react-native-marked` 渲染 Markdown，嵌套列表中需设置 `flatListProps={{ scrollEnabled: false }}`

---

## 注意事项

### 密钥安全

- `INTEGRATIONS_API_KEY` 由平台注入 Deno 环境变量，**严禁暴露到前端**
- 前端只与 Supabase Edge Function 通信，不直接访问 `app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com`

### 计费

- **原价**：¥0.60 / 千次调用
- **优惠价**：¥0.45 / 千次调用
- 每次调用均计费（`need_count_calls: true`），避免重复调用或无意义的测试请求

### 错误处理

- 务必处理 `429`（RPM/TPM 速率限制）和 `402`（余额不足），Edge Function 已原样转发这两类错误
- `flag` 非 `0` 时表示内容触发安全检测，需在前端提示用户

### 图片限制

- 格式：JPG / JPEG / PNG / BMP
- 大小：单图不超过 10 MB
- MiniProgram 端 `image_url` **仅支持 Base64 格式**，不可直接传图片网络 URL（需先转 Base64）

### MiniProgram 特有注意事项

- **禁止使用 `Taro.request`** 直接接收 SSE：`Taro.request` 会将 SSE 流二次序列化，必须使用 `sendChatStream`（`miaoda-taro-utils`）
- **`appId` 必须填空字符串**：`sendChatStream` 的 `appId` 参数须传 `""`，否则请求失败
- **避免在 `useCallback` / `useEffect` 中监听流式数据**，防止产生循环更新
- `RichText` 组件（`@tarojs/components`）可用于渲染模型返回的 Markdown 内容

### Web 特有注意事项

- 推荐使用 `sendStreamRequest`（`ky` + `eventsource-parser`）而非原生 `EventSource`（不支持 POST）
- 可选使用 `streamdown` 组件渲染流式 Markdown 内容
