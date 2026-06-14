# 图生视频（MiniMax）— 视频生成接口

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `ad629bb9-46ea-41c1-8eb0-7acfc3e37381` |
| API ID（单帧） | `api-VaOw5VAJdQBa` |
| API ID（首尾帧） | `api-nYWNRQr5pV1L` |
| Endpoint（单帧） | `POST https://app-cblk1rqa5fk1-api-VaOw5VAJdQBa-gateway.appmiaoda.com/v1/video_generation` |
| Endpoint（首尾帧） | `POST https://app-cblk1rqa5fk1-api-nYWNRQr5pV1L-gateway.appmiaoda.com/v1/video_generation` |
| Auth | `platform_managed`，`X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-VaOw5VAJdQBa-gateway.appmiaoda.com` |
| 计费 | 单帧：按调用次数计费；首尾帧：按调用次数计费 |

---

## 请求参数表

### 单帧图生视频（api-VaOw5VAJdQBa）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型名称，可选值：`MiniMax-Hailuo-02`（标准视频生成）、`video-01-live`（真实感增强模型，适合人物/场景写实风格）、`video-01-director`（导演模型，支持更精细的运镜指令控制）|
| `first_frame_image` | string | 是 | — | 视频起始帧图片，支持公网 URL 或 Base64 Data URL；格式 JPG/JPEG/PNG/WebP，体积 < 20MB，短边 > 300px，长宽比 2:5 ~ 5:2 |
| `prompt` | string | 否 | `""` | 视频文本描述，最大 2000 字符；支持 `[指令]` 运镜语法（15 种：左移/右移/左摇/右摇/推进/拉远/上升/下降/上摇/下摇/变焦推近/变焦拉远/晃动/跟随/固定）|
| `prompt_optimizer` | boolean | 否 | `true` | 是否自动优化 prompt |
| `fast_pretreatment` | boolean | 否 | `false` | 是否缩短 prompt_optimizer 耗时（仅对部分模型生效）|
| `duration` | integer | 否 | `6` | 视频时长（秒）；768P 支持 6 或 10，1080P 仅支持 6 |
| `resolution` | string | 否 | `768P` | 视频分辨率，可选：`768P`、`1080P`（**勿用 512P/720P**，会返回 2013 错误）|
| `callback_url` | string | 否 | — | 任务状态更新回调 URL |
| `aigc_watermark` | boolean | 否 | `false` | 是否添加水印 |

### 首尾帧生成视频（api-nYWNRQr5pV1L）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型名称，可选值：`MiniMax-Hailuo-02`（首尾帧不支持 512P）、`video-01-live`（真实感增强模型）、`video-01-director`（导演模型）|
| `last_frame_image` | string | 是 | — | 视频结束帧图片，要求同首帧；当首尾帧尺寸不一致时，模型参考首帧对尾帧裁剪 |
| `first_frame_image` | string | 否 | — | 视频起始帧图片（可选，若提供则视频尺寸遵循首帧）|
| `prompt` | string | 否 | `""` | 视频文本描述，最大 2000 字符；支持 `[指令]` 运镜语法 |
| `prompt_optimizer` | boolean | 否 | `true` | 是否自动优化 prompt |
| `duration` | integer | 否 | `6` | 视频时长（秒）；768P 支持 6 或 10，1080P 仅支持 6 |
| `resolution` | string | 否 | `768P` | 视频分辨率，可选：`768P`（默认）、`1080P`（不支持 512P）|
| `callback_url` | string | 否 | — | 任务状态更新回调 URL |
| `aigc_watermark` | boolean | 否 | `false` | 是否添加水印 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `task_id` | string | 视频生成任务 ID，用于后续查询 |
| `base_resp.status_code` | integer | 0 = 成功，其他值见错误码 |
| `base_resp.status_msg` | string | 状态详情，成功时为 `"success"` |

响应示例：
```json
{
  "task_id": "106916112212032",
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

### 错误码

| status_code | 说明 |
|-------------|------|
| 0 | 请求成功 |
| 1002 | 触发限流，稍后重试 |
| 1004 | 账号鉴权失败，检查 API Key |
| 1008 | 账号余额不足 |
| 1026 | 视频描述涉及敏感内容 |
| 2013 | 传入参数异常（常见：resolution/duration 组合不合法）|
| 2049 | 无效的 API Key |

---

## 关键约束（来自 examples，MiniMax-Hailuo-02）

**resolution 和 duration 约束：**
- `resolution`：仅支持 `768P` 和 `1080P`；`720P`/`512P` 会触发 2013 错误，**默认用 `768P`**
- `duration`：`768P` 支持 6s 或 10s；`1080P` **仅支持 6s**（传 3s/5s 会触发 2013 错误）
- 始终默认 `duration=6`

**前端 UI 约束（分辨率选择器）：**
```typescript
// 当 resolution=1080P 时，强制 duration=6 并禁用其他选项
onClick={() => { setResolution('1080P'); setDuration(6) }}
// 3s/5s 按钮：disabled={resolution === '1080P'}
```

---

## 生成期代码（TypeScript）

### 单帧图生视频

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 提交单帧图生视频任务。
 * @param firstFrameImage - 首帧图片 URL 或 Base64 Data URL
 * @param prompt - 视频文本描述（可选，支持运镜指令）
 * @param duration - 视频时长（秒），默认 6；768P 支持 6/10，1080P 仅支持 6
 * @param resolution - 分辨率，默认 768P；勿用 720P/512P
 * @returns 任务 ID
 */
async function submitImageToVideo(
  firstFrameImage: string,
  prompt = "",
  duration = 6,
  resolution = "768P"
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-VaOw5VAJdQBa-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-Hailuo-02",
        first_frame_image: firstFrameImage,
        prompt,
        duration,
        resolution,
        prompt_optimizer: true,
      }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(
      `API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`
    );
  }
  return json.task_id;
}
```

### 首尾帧生成视频

```typescript
/**
 * 提交首尾帧图生视频任务，实现从起始画面到结束画面的平滑过渡。
 * @param lastFrameImage - 尾帧图片 URL 或 Base64 Data URL（必填）
 * @param firstFrameImage - 首帧图片 URL 或 Base64 Data URL（可选）
 * @param prompt - 视频文本描述（可选）
 * @param duration - 视频时长（秒），默认 6
 * @param resolution - 分辨率，默认 768P；首尾帧不支持 512P
 * @returns 任务 ID
 */
async function submitFirstLastFrameToVideo(
  lastFrameImage: string,
  firstFrameImage?: string,
  prompt = "",
  duration = 6,
  resolution = "768P"
): Promise<string> {
  const body: Record<string, unknown> = {
    model: "MiniMax-Hailuo-02",
    last_frame_image: lastFrameImage,
    prompt,
    duration,
    resolution,
    prompt_optimizer: true,
  };
  if (firstFrameImage) body.first_frame_image = firstFrameImage;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-nYWNRQr5pV1L-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(
      `API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`
    );
  }
  return json.task_id;
}
```

---

## Edge Function 代码

> 单帧和首尾帧共用同一个 Edge Function，通过请求体中是否含 `last_frame_image` 区分模式。

```typescript
// edge-functions/submit-image-to-video.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let firstFrameImage: string | undefined;
  let lastFrameImage: string | undefined;
  let prompt: string;
  let duration: number;
  let resolution: string;

  try {
    const body = await req.json();
    firstFrameImage = body.first_frame_image;
    lastFrameImage = body.last_frame_image;
    prompt = body.prompt ?? "";
    duration = body.duration ?? 6;
    resolution = body.resolution ?? "768P";

    // 首尾帧模式必须有 last_frame_image；单帧模式必须有 first_frame_image
    if (!lastFrameImage && !firstFrameImage) {
      throw new Error("Missing first_frame_image or last_frame_image");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
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

  // 根据是否有 last_frame_image 选择 API ID
  const apiId = lastFrameImage ? "api-nYWNRQr5pV1L" : "api-VaOw5VAJdQBa";
  const requestBody: Record<string, unknown> = {
    model: "MiniMax-Hailuo-02",
    prompt,
    duration,
    resolution,
    prompt_optimizer: true,
  };
  if (firstFrameImage) requestBody.first_frame_image = firstFrameImage;
  if (lastFrameImage) requestBody.last_frame_image = lastFrameImage;

  const upstream = await fetch(
    `https://${apiId}@app-cblk1rqa5fk1-api-VaOw5VAJdQBa-gateway.appmiaoda.com/v1/video_generation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

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

---

## 前端调用代码

### Web 平台

```typescript
/**
 * 提交图生视频任务（Web）。
 * @param params - 请求参数，first_frame_image 或 last_frame_image 至少一个必填
 * @returns 任务 ID
 */
async function submitVideoTask(params: {
  first_frame_image?: string;
  last_frame_image?: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("submit-image-to-video", {
    body: params,
  });
  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`API 错误 ${data.base_resp?.status_code}: ${data.base_resp?.status_msg}`);
  }
  return data.task_id;
}
```

### MiniProgram 平台

```typescript
/**
 * 提交图生视频任务（MiniProgram）。
 * 注意：resolution=1080P 时 duration 只能为 6，前端需强制约束。
 */
async function submitVideoTask(params: {
  first_frame_image?: string;
  last_frame_image?: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("submit-image-to-video", {
    body: params,
  });
  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`API 错误 ${data.base_resp?.status_code}: ${data.base_resp?.status_msg}`);
  }
  return data.task_id;
}

// 分辨率选择器约束示例
// onClick={() => { setResolution('1080P'); setDuration(6); }}
// <Button disabled={resolution === '1080P'} onClick={() => setDuration(3)}>3s</Button>
// <Button disabled={resolution === '1080P'} onClick={() => setDuration(5)}>5s</Button>
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：单帧提交和首尾帧提交均按调用次数计费，避免因参数错误重复提交。
- **参数校验**：提交前在前端校验 resolution/duration 组合，防止 2013 错误导致无效计费。
- **错误处理**：务必处理 429（限流）和 402/1008（余额不足），以及 2013（参数异常）。
- **首尾帧尺寸**：首尾帧图片尺寸不一致时，模型以首帧为准对尾帧进行裁剪，需提前告知用户。
