# 编辑图片接口 — 完整规格与实现

## API 基本信息

| 字段 | 值                                                                   |
|------|---------------------------------------------------------------------|
| Plugin ID | `e480d4b6-835c-45f8-a494-d38da962b394`                              |
| API ID | `api-baBw3XMNVmv9`                                                  |
| Endpoint | `POST http://app-cblk1rqa5fk1-api-baBw3XMNVmv9-gateway.appmiaoda.com/v1/images/edits` |
| Content-Type | `multipart/form-data`                                               |
| 认证模式 | `platform_managed`                                                  |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`           |
| 支持平台 | Web、MiniProgram                                                     |

---

## 请求参数表

### 顶层参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `model` | `string` | 是 | 固定值：`gpt-image-2`，**必须传递**，否则上游返回 403 |
| `prompt` | `string` | 是 | 图片编辑描述词，控制最终生成效果 |
| `size` | `string` | 否 | 输出图片尺寸，如 `2848x1152` |
| `n` | `integer` | 否 | 输出图片数量，默认 1 |
| `image[0]` | `file` | 是 | 主图片文件 |
| `image[1]` | `file` | 否 | 附加图片文件 |
| `image[2]` | `file` | 否 | 附加图片文件 |

---

## 响应字段表

### 成功响应（HTTP 200）

```json
{
  "created": 1778148759,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",
      "revised_prompt": "Edit the provided images into a cinematic movie poster with dramatic lighting and unified composition"
    }
  ],
  "background": "auto",
  "output_format": "png",
  "quality": "auto",
  "size": "2848x1152",
  "model": "gpt-image-2",
  "usage": {
    "input_tokens": 842,
    "input_tokens_details": {
      "image_tokens": 782,
      "text_tokens": 60
    },
    "output_tokens": 1756,
    "output_tokens_details": {
      "image_tokens": 1756,
      "text_tokens": 0
    },
    "total_tokens": 2598
  }
}
```

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `created` | `number` | 创建时间戳 |
| `data` | `array` | 生成结果列表 |
| `data[].b64_json` | `string` | Base64 编码后的图片内容，需解码后保存为 png/jpg 文件 |
| `data[].revised_prompt` | `string` | 模型自动优化后的提示词 |
| `background` | `string` | 背景设置（如 `auto`） |
| `output_format` | `string` | 输出格式（如 `png`） |
| `quality` | `string` | 图片质量（如 `auto`） |
| `size` | `string` | 输出尺寸 |
| `model` | `string` | 使用的模型 |
| `usage` | `object` | 本次图片生成的 token 消耗统计 |
| `usage.input_tokens` | `number` | 输入 token 数 |
| `usage.input_tokens_details.image_tokens` | `number` | 图片输入 token 数 |
| `usage.input_tokens_details.text_tokens` | `number` | 文本输入 token 数 |
| `usage.output_tokens` | `number` | 输出 token 数 |
| `usage.output_tokens_details.image_tokens` | `number` | 图片输出 token 数 |
| `usage.output_tokens_details.text_tokens` | `number` | 文本输出 token 数 |
| `usage.total_tokens` | `number` | 总 token 数 |

---

## 生成期代码（TypeScript）

生成期由 Agent 直接调用上游 API。认证使用 `platform_managed` 模式，密钥由平台注入。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface EditImageParams {
  model: "gpt-image-2";
  prompt: string;
  size?: string;
  n?: number;
  images: File[]; // 1–3 张图片文件
}

interface EditImageResult {
  created: number;
  data: Array<{
    b64_json: string;
    revised_prompt: string;
  }>;
  background: string;
  output_format: string;
  quality: string;
  size: string;
  model: string;
  usage?: {
    input_tokens: number;
    input_tokens_details: { image_tokens: number; text_tokens: number };
    output_tokens: number;
    output_tokens_details: { image_tokens: number; text_tokens: number };
    total_tokens: number;
  };
}

async function editImage(params: EditImageParams): Promise<EditImageResult> {
  const formData = new FormData();
  formData.append("model", params.model);
  formData.append("prompt", params.prompt);
  if (params.size) formData.append("size", params.size);
  if (params.n) formData.append("n", String(params.n));
  params.images.forEach((file, index) => {
    formData.append(`image[${index}]`, file);
  });

  const response = await fetch(
    "http://app-cblk1rqa5fk1-api-baBw3XMNVmv9-gateway.appmiaoda.com/v1/images/edits",
    {
      method: "POST",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.error) throw new Error(`API error: ${JSON.stringify(json.error)}`);

  return json;
}
```

### 生成期文件保存（必须执行）

本接口直接返回 **Base64 编码的媒体数据**（不含 URL），在生成期获得 Base64 数据后，**必须立即使用 Bash 工具将其解码并保存到本地**，以便用户查看结果。

```bash
echo "<base64_data>" | base64 -d > <本地路径>.png
```

**完整生成期工作流（含保存步骤）：**

1. 准备图片文件（1–3 张）
2. 调用 `editImage(params)` 获取响应
3. 从 `json.data[0].b64_json` 提取 Base64 数据
4. 使用 Bash 工具将 Base64 解码并保存：`echo "<b64_json>" | base64 -d > <本地路径>.png`
5. 告知用户文件已保存到对应路径，同时展示 `revised_prompt`

> **注意**：Base64 数据仅存在于当次响应中，必须及时保存，否则数据丢失。

---

## Edge Function 代码

### Web 平台

编辑接口使用 `multipart/form-data`，由于图片编辑耗时较长（可能超过中间路由的超时时间），Edge Function 采用 **SSE（Server-Sent Events）流式响应**：每 15 秒发送心跳事件保持连接活跃，上游返回后将结果以 SSE 事件推送给前端。

**SSE 事件格式：**

| 事件类型 | 说明 | 示例 |
|----------|------|------|
| `heartbeat` | 心跳，防止连接超时 | `{"type":"heartbeat","elapsed":15000}` |
| `result` | 成功结果 | `{"type":"result","data":{...ImageResult...}}` |
| `error` | 错误信息 | `{"type":"error","status":429,"message":"..."}` |

```typescript
// edge-functions/image-edits.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// SSE 响应头（含 CORS）
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 序列化一条 SSE 事件行
function sseEvent(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

serve(async (req: Request): Promise<Response> => {
  const t0 = Date.now();

  // 处理 CORS 预检
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // --- 校验 multipart/form-data ---
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // --- 解析 FormData 并注入 model（必须字段，缺失会被上游网关 403 拒绝）---
  // 注意：不能用 req.arrayBuffer() 直接透传，必须解析后确保 model 字段存在
  const formData = await req.formData();
  if (!formData.get("model")) {
    formData.set("model", "gpt-image-2");
  }

  // --- 构造 SSE 流式响应 ---
  const stream = new ReadableStream({
    start(controller) {
      // 心跳定时器：每 15 秒发送一次心跳，防止连接超时
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            sseEvent({ type: "heartbeat", elapsed: Date.now() - t0 })
          );
        } catch (_) {
          clearInterval(heartbeatInterval);
        }
      }, 15_000);

      // 异步向上游发请求
      (async () => {
        // --- 超时控制（540s）---
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 540_000);

        let upstream: Response;
        try {
          upstream = await fetch(
            "http://app-cblk1rqa5fk1-api-baBw3XMNVmv9-gateway.appmiaoda.com/v1/images/edits",
            {
              method: "POST",
              signal: abortController.signal,
              headers: {
                "X-Gateway-Authorization": `Bearer ${apiKey}`,
              },
              body: formData,
            }
          );
        } catch (err) {
          clearTimeout(timeoutId);
          clearInterval(heartbeatInterval);
          controller.enqueue(sseEvent({ type: "error", message: `Fetch exception: ${err}` }));
          controller.close();
          return;
        }
        clearTimeout(timeoutId);

        // 透传 4xx 业务错误
        if (upstream.status === 400 || upstream.status === 402 || upstream.status === 429) {
          const errText = await upstream.text();
          clearInterval(heartbeatInterval);
          controller.enqueue(
            sseEvent({ type: "error", status: upstream.status, message: errText })
          );
          controller.close();
          return;
        }

        if (!upstream.ok) {
          const errText = await upstream.text();
          clearInterval(heartbeatInterval);
          controller.enqueue(
            sseEvent({ type: "error", status: upstream.status, message: `Upstream error: ${upstream.status}`, detail: errText })
          );
          controller.close();
          return;
        }

        // 成功：读取完整 JSON 并推送结果
        const data = await upstream.json();
        clearInterval(heartbeatInterval);
        controller.enqueue(sseEvent({ type: "result", data }));
        controller.close();
      })();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
```

### MiniProgram 平台

MiniProgram 的 Edge Function 逻辑与 Web 平台相同（SSE 流式响应），前端处理图片的方式略有不同（需写入临时文件后用 `<image>` 组件展示，weapp 真机不支持 `data:` URI 直接渲染）。

---

## 前端调用代码

### Web 平台（React / Vue / 原生 TypeScript）

由于编辑图片 Edge Function 采用 SSE 流式响应，前端需使用原生 `fetch` + `getReader()` 消费流事件。

**SSE 事件类型定义：**

```typescript
type SseEvent =
  | { type: "heartbeat"; elapsed: number }
  | { type: "result"; data: ImageResult }
  | { type: "error"; status?: number; message: string; detail?: string };
```

**推荐方式（SSE 流式消费）：**

> **重要**：FormData 中必须包含 `model` 字段（值为 `gpt-image-2`），否则上游网关返回 403。

```typescript
async function editImage(
  params: { prompt: string; size?: string; n?: number; images: File[] },
  onHeartbeat?: (elapsed: number) => void
): Promise<ImageResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const formData = new FormData();
  formData.append("model", "gpt-image-2");
  formData.append("prompt", params.prompt);
  if (params.size) formData.append("size", params.size);
  if (params.n) formData.append("n", String(params.n));
  params.images.forEach((file, index) => {
    formData.append(`image[${index}]`, file);
  });

  const response = await fetch(`${supabaseUrl}/functions/v1/image-edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) throw new Error("配额已用尽");
    if (response.status === 402) throw new Error("余额不足");
    throw new Error(`请求失败（${response.status}）：${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;

      const event: SseEvent = JSON.parse(line.slice(5).trim());

      if (event.type === "heartbeat") {
        onHeartbeat?.(event.elapsed);
      } else if (event.type === "result") {
        reader.cancel();
        return event.data;
      } else if (event.type === "error") {
        reader.cancel();
        if (event.status === 429) throw new Error("配额已用尽");
        if (event.status === 402) throw new Error("余额不足");
        throw new Error(event.message || "编辑失败");
      }
    }
  }

  throw new Error("编辑失败：服务端未返回结果");
}
```

**前端解码 Base64：**

```typescript
const base64 = json.data[0].b64_json;
const byteCharacters = atob(base64);
const byteNumbers = new Array(byteCharacters.length);
for (let i = 0; i < byteCharacters.length; i++) {
  byteNumbers[i] = byteCharacters.charCodeAt(i);
}
const byteArray = new Uint8Array(byteNumbers);
const blob = new Blob([byteArray], { type: "image/png" });
const imageUrl = URL.createObjectURL(blob);
// 使用 imageUrl 在 <img> 中展示
```

### MiniProgram 平台（Taro / 原生小程序）

MiniProgram 环境不支持标准 SSE 流式读取，可使用轮询或通过 Taro 的 `request` 配置较长超时时间。若平台支持流式，逻辑与 Web 平台一致。

```typescript
import Taro from "@tarojs/taro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!
);

async function editImage(params: { prompt: string; size?: string; n?: number; images: File[] }) {
  const formData = new FormData();
  formData.append("model", "gpt-image-2");
  formData.append("prompt", params.prompt);
  if (params.size) formData.append("size", params.size);
  if (params.n) formData.append("n", String(params.n));
  params.images.forEach((file, index) => {
    formData.append(`image[${index}]`, file);
  });

  const { data, error } = await supabase.functions.invoke("image-edits", {
    body: formData,
  });
  if (error) throw error;
  return data;
}

// 获取 Base64 后写入临时文件并展示
async function saveAndPreviewBase64(base64: string): Promise<string> {
  const fs = Taro.getFileSystemManager();
  const filePath = `${Taro.env.USER_DATA_PATH}/edited_${Date.now()}.png`;
  const buffer = Taro.base64ToArrayBuffer(base64);

  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: buffer,
      encoding: "binary",
      success: () => resolve(filePath),
      fail: reject,
    });
  });
}
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。

2. **文件上传限制**：编辑接口最多支持 3 张图片（`image[0]` 必填，`image[1]`、`image[2]` 可选），需确保图片格式和大小符合上游要求。

3. **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种错误状态码，这两种错误会通过 SSE `error` 事件从上游直接转发。

4. **Base64 格式**：返回的 `b64_json` 是纯 Base64 字符串，不含 `data:image/xxx;base64,` 前缀，前端需自行拼接或转为 Blob。

5. **支持的图片格式**：输出固定为 PNG 格式。输入支持常见图片格式（jpg、png、webp 等），具体以上游限制为准。

6. **SSE 流式响应**：由于图片编辑耗时较长（数十秒至数分钟），同步接口容易被中间路由（网关/CDN）因超时断开。Edge Function 采用 SSE 流式响应 + 15 秒心跳机制保持连接活跃，前端需使用 `fetch` + `ReadableStream` 消费事件流。
