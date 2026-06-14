# 文生视频 — 创建文生视频任务

## API 基本信息

| 项目 | 值 |
|------|-----|
| Plugin ID | `284585aa-3c6e-4827-b46e-a1e610aa3100` |
| API ID | `api-o9wN672BkyMa` |
| Endpoint | `POST https://api-o9wN672BkyMa@qianfan.baidubce.com/beta/video/generations/kling/text2video` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| 第三方域名 | `qianfan.baidubce.com` |
| 计费 | 启用（原价 ¥130.00 / 折扣价 ¥85.00，按调用次数计费） |

---

## 请求参数表

> **说明：** APIDOC context 仅记录了 `prompt` 和 `duration` 两个参数，以下完整参数列表来自 Kling 原始 API 文档（与 SKILL.md 调用代码一致）。

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model_name` | string | 是 | — | 用于生成视频的模型，枚举值：`kling-v1`、`kling-v1-6`、`kling-v2-master`、`kling-v2-1-master` |
| `prompt` | string | 是 | — | 正向文本提示词，最大 2500 字符 |
| `duration` | string | 否 | `"5"` | 生成视频时长（秒），枚举值：`"5"`、`"10"` |
| `mode` | string | 否 | `"std"` | 生成模式，枚举值：`std`（标准，性价比高）、`pro`（高品质，效果更佳） |
| `aspect_ratio` | string | 否 | `"16:9"` | 视频宽高比，如 `"16:9"`、`"9:16"`、`"1:1"` |
| `negative_prompt` | string | 否 | — | 负向文本提示词，描述不希望出现在视频中的内容 |
| `callback_url` | string | 否 | — | 任务完成后的回调地址，任务状态变更时将 POST 通知到该 URL |

---

## 响应字段表

### 成功响应（HTTP 200，`code: 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 表示成功 |
| `message` | string | 错误信息，成功时为空字符串 |
| `request_id` | string | 请求 ID，用于排查问题 |
| `data.task_id` | string | 任务 ID，系统生成 |
| `data.task_status` | string | 任务状态：`submitted`（已提交）、`processing`（处理中）、`succeed`（成功）、`failed`（失败） |
| `data.created_at` | number | 任务创建时间，Unix 时间戳（单位 ms） |
| `data.updated_at` | number | 任务更新时间，Unix 时间戳（单位 ms） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 0 的错误码 |
| `message` | string | 错误信息描述 |
| `request_id` | string | 请求 ID |

---

## 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 创建文生视频任务（生成期直接调用）
 * @param prompt - 正向文本提示词，最大 2500 字符
 * @param duration - 视频时长（秒），枚举值："5"、"10"，默认 "5"
 * @returns 包含 task_id 等信息的任务数据
 */
async function submitTextToVideo(
  prompt: string,
  duration: string = "5"
): Promise<{ task_id: string; task_status: string; created_at: number; updated_at: number }> {
  const response = await fetch(
    "https://api-o9wN672BkyMa@qianfan.baidubce.com/beta/video/generations/kling/text2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt, duration }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data;
}
```

---

## Edge Function 代码

> **重要**：此接口为异步接口，Edge Function 必须在调用后立即将 `task_id` 返回给前端，
> 不可在 Edge Function 内部轮询。前端负责每 5 秒调用查询接口。

```typescript
// edge-functions/text-to-video-submit.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let prompt: string;
  let duration: string;
  let modelName: string;
  let mode: string | undefined;
  let aspectRatio: string | undefined;
  let negativePrompt: string | undefined;
  let callbackUrl: string | undefined;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    duration = body.duration ?? "5";
    modelName = body.model_name ?? "kling-v1-6";
    mode = body.mode;
    aspectRatio = body.aspect_ratio;
    negativePrompt = body.negative_prompt;
    callbackUrl = body.callback_url;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const requestBody: Record<string, unknown> = { model_name: modelName, prompt, duration };
  if (mode !== undefined) requestBody.mode = mode;
  if (aspectRatio !== undefined) requestBody.aspect_ratio = aspectRatio;
  if (negativePrompt !== undefined) requestBody.negative_prompt = negativePrompt;
  if (callbackUrl !== undefined) requestBody.callback_url = callbackUrl;

  const upstream = await fetch(
    "https://api-o9wN672BkyMa@qianfan.baidubce.com/beta/video/generations/kling/text2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  // 转发配额超限 / 余额不足错误
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
  // 立即返回 task_id，不轮询
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台

```typescript
/**
 * 提交文生视频任务（Web 前端）
 * @param prompt - 正向文本提示词
 * @param duration - 视频时长（秒），枚举值："5"、"10"
 * @returns task_id，供后续轮询使用
 */
async function submitTextToVideoTask(
  prompt: string,
  duration: "5" | "10" = "5"
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("text-to-video-submit", {
    body: { prompt, duration },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}
```

### MiniProgram 平台

```typescript
/**
 * 提交文生视频任务（MiniProgram 前端）
 * @param prompt - 正向文本提示词
 * @param duration - 视频时长（秒），枚举值："5"、"10"
 * @returns task_id，供后续轮询使用
 */
async function submitTextToVideoTask(
  prompt: string,
  duration: "5" | "10" = "5"
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("text-to-video-submit", {
    body: { prompt, duration },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **异步设计**：Edge Function 必须立即返回 `task_id`，不可在函数内轮询，避免超时。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：创建任务接口启用计费，原价 ¥130.00 / 折扣价 ¥85.00，按调用次数计费；查询接口不计费。避免因重复提交产生不必要的费用。
