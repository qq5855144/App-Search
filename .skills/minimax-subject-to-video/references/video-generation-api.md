# 提交视频生成任务 API — 主体参考视频生成（MiniMax）

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `17196c7a-fca2-41ec-85f3-1e303e1a3ee1` |
| API ID | `api-oLpZbv47qvea` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-oLpZbv47qvea-gateway.appmiaoda.com/v1/video_generation` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-oLpZbv47qvea-gateway.appmiaoda.com` |
| 计费 | 是（`need_count_calls: true`，具体价格以平台实际配置为准）|

---

## 请求参数表

### 请求头

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `Content-Type` | string | 是 | 请求体的媒介类型，设置为 `application/json` |

### 请求体

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型名称，可用值：`S2V-01` |
| `prompt` | string | 否 | — | 视频的文本描述，最大 2000 字符 |
| `prompt_optimizer` | boolean | 否 | `true` | 是否自动优化 prompt；设为 `false` 可进行更精确控制 |
| `subject_reference` | array | 是 | — | 主体参考数组，目前仅支持单个主体 |
| `subject_reference[].type` | string | 是 | — | 主体类型，当前仅支持 `character`（人物面部） |
| `subject_reference[].image` | array | 是 | — | 主体参考图数组（目前仅支持单张），支持 JPG/JPEG/PNG/WebP，< 20MB，短边 > 300px，长宽比 2:5 ~ 5:2 |
| `callback_url` | string | 否 | — | 接收任务状态更新通知的回调 URL |
| `aigc_watermark` | boolean | 否 | `false` | 是否在生成的视频中添加水印 |

---

## 响应字段表

### 成功响应（200）

```json
{
  "task_id": "106916112212032",
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `task_id` | string | 视频生成任务的 ID，用于后续查询任务状态 |
| `base_resp.status_code` | integer | 状态码（见下表） |
| `base_resp.status_msg` | string | 错误详情；成功时为 `success` |

### 状态码说明

| status_code | 含义 |
|-------------|------|
| 0 | 请求成功 |
| 1002 | 触发限流，请稍后再试 |
| 1004 | 账号鉴权失败，请检查 API-Key |
| 1008 | 账号余额不足 |
| 1026 | 视频描述涉及敏感内容 |
| 2013 | 传入参数异常 |
| 2049 | 无效的 api key |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface SubjectReference {
  type: "character";
  image: string[];
}

interface VideoGenerationRequest {
  model: "S2V-01";
  prompt?: string;
  prompt_optimizer?: boolean;
  subject_reference: SubjectReference[];
  callback_url?: string;
  aigc_watermark?: boolean;
}

interface VideoGenerationResponse {
  task_id: string;
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * 提交主体参考视频生成任务。
 *
 * @param imageUrl - 人物主体参考图片 URL（JPG/JPEG/PNG/WebP，< 20MB，短边 > 300px）
 * @param prompt - 视频文本描述，最大 2000 字符（可选）
 * @param options - 可选配置：prompt_optimizer、callback_url、aigc_watermark
 * @returns 任务 ID，用于后续查询状态
 */
async function submitVideoGeneration(
  imageUrl: string,
  prompt?: string,
  options?: {
    promptOptimizer?: boolean;
    callbackUrl?: string;
    aigcWatermark?: boolean;
  },
): Promise<string> {
  const requestBody: VideoGenerationRequest = {
    model: "S2V-01",
    subject_reference: [{ type: "character", image: [imageUrl] }],
  };
  if (prompt !== undefined) requestBody.prompt = prompt;
  if (options?.promptOptimizer !== undefined) requestBody.prompt_optimizer = options.promptOptimizer;
  if (options?.callbackUrl) requestBody.callback_url = options.callbackUrl;
  if (options?.aigcWatermark !== undefined) requestBody.aigc_watermark = options.aigcWatermark;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-oLpZbv47qvea-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json: VideoGenerationResponse = await response.json();
  if (json.base_resp.status_code !== 0) {
    throw new Error(`API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }
  return json.task_id;
}

// 使用示例
const taskId = await submitVideoGeneration(
  "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg",
  "A girl runs toward the camera and winks with a smile.",
);
console.log("taskId:", taskId);
```

---

## Edge Function 代码

### Web 平台

```typescript
// edge-functions/minimax-video-generation.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let imageUrl: string;
  let prompt: string | undefined;
  let promptOptimizer: boolean | undefined;
  let callbackUrl: string | undefined;
  let aigcWatermark: boolean | undefined;
  try {
    const body = await req.json();
    imageUrl = body.imageUrl;
    if (!imageUrl) throw new Error("Missing imageUrl");
    prompt = body.prompt;
    promptOptimizer = body.promptOptimizer;
    callbackUrl = body.callbackUrl;
    aigcWatermark = body.aigcWatermark;
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

  // --- 构建请求体 ---
  const requestBody: Record<string, unknown> = {
    model: "S2V-01",
    subject_reference: [{ type: "character", image: [imageUrl] }],
  };
  if (prompt !== undefined) requestBody.prompt = prompt;
  if (promptOptimizer !== undefined) requestBody.prompt_optimizer = promptOptimizer;
  if (callbackUrl) requestBody.callback_url = callbackUrl;
  if (aigcWatermark !== undefined) requestBody.aigc_watermark = aigcWatermark;

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-oLpZbv47qvea-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  if (data.base_resp?.status_code !== 0) {
    return new Response(
      JSON.stringify({
        error: `API error ${data.base_resp?.status_code}: ${data.base_resp?.status_msg}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### MiniProgram 平台

MiniProgram 与 Web 的 Edge Function 实现相同，无需分开部署。

---

## 前端调用代码

### Web 平台（推荐 supabase client）

```typescript
interface SubmitVideoResult {
  task_id: string;
  base_resp: { status_code: number; status_msg: string };
}

/**
 * 前端调用提交视频生成任务的 Edge Function。
 *
 * @param imageUrl - 人物主体参考图片 URL
 * @param prompt - 视频文本描述（可选）
 * @returns 任务 ID
 */
async function submitVideoGenerationTask(
  imageUrl: string,
  prompt?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-video-generation", {
    body: { imageUrl, prompt },
  });
  if (error) throw error;
  return (data as SubmitVideoResult).task_id;
}
```

### MiniProgram 平台（Taro + supabase client）

```typescript
/**
 * MiniProgram 调用提交视频生成任务，与 Web 调用方式相同。
 *
 * @param imageUrl - 人物主体参考图片 URL
 * @param prompt - 视频文本描述（可选）
 * @returns 任务 ID
 */
async function submitVideoGenerationTask(
  imageUrl: string,
  prompt?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-video-generation", {
    body: { imageUrl, prompt },
  });
  if (error) throw error;
  return (data as { task_id: string }).task_id;
}
```

---

## 注意事项

- **计费**：此接口计费信息以平台实际配置为准，`need_count_calls: true`，避免不必要的重复提交。
- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **图片要求**：JPG/JPEG/PNG/WebP 格式，小于 20MB，短边像素大于 300px，长宽比在 2:5 和 5:2 之间。
- **主体参考**：目前 `subject_reference` 仅支持单个主体，`type` 固定为 `character`，`image` 数组目前只支持单张图片。
- **prompt 优化**：`prompt_optimizer` 默认为 `true`，如需精确控制请设为 `false`。
- **callback_url**：配置回调 URL 后，MiniMax 服务器会先发送含 `challenge` 字段的 POST 请求验证，服务端需在 3 秒内原样返回 `challenge` 值。
