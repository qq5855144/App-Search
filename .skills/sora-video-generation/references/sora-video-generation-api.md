# Sora 视频生成（高级版）API 参考

## 插件基本信息

| 项 | 值 |
|----|-----|
| Plugin ID | `29ae39f9-88ff-4271-a328-1ff7e6cc8707` |
| Plugin Title | 视频生成（高级版） |
| Auth 模式 | `platform_managed`（traefik: true） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 支持平台 | Web, MiniProgram |

---

## API 一览

| API ID | Title | Endpoint | Method | Content-Type |
|--------|-------|----------|--------|--------------|
| `api-Xa6Jew6JjAqa` | Create Video | `https://app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com/openai/v1/videos` | POST | multipart/form-data |
| `api-M9v0w87KjxoY` | Query Status | `https://app-cblk1rqa5fk1-api-M9v0w87KjxoY-gateway.appmiaoda.com/query` | POST | application/json |
| `api-W9z3qro1AVZL` | Video from Reference | `https://app-cblk1rqa5fk1-api-W9z3qro1AVZL-gateway.appmiaoda.com/openai/v1/videos` | POST | multipart/form-data |
| `api-M9v0wP10kQjY` | Remix Video | `https://app-cblk1rqa5fk1-api-M9v0wP10kQjY-gateway.appmiaoda.com/openai/v1/videos/remix` | POST | application/json |

---

## 1. Create Video（文生视频 / 图生视频）

**API ID:** `api-Xa6Jew6JjAqa`
**third_part_domain:** `app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com`
**计费:** 启用（`enable_billing: true`, `need_count_calls: true`）

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 否 | `"sora-2"` | 模型名称 |
| `prompt` | string | 是 | — | 自然语言描述视频场景 |
| `size` | string | 否 | `"720x1280"` | 分辨率：`"720x1280"`（竖屏）或 `"1280x720"`（横屏） |
| `seconds` | string | 否 | `4` | 视频时长：4 / 8 / 12 秒 |
| `input_reference` | file | 否 | — | 参考图（JPEG/PNG/WebP），用作首帧锚点；**分辨率须与 size 完全匹配**（仅支持 720x1280 / 1280x720）；**文件大小 ≤ 10 MB**；**严禁压缩或重新编码，须保留原始字节流** |
| `remix_video_id` | string | 否 | — | 已完成视频的 ID，用于 Remix 模式 |

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 视频任务 ID，格式 `video_...` |
| `status` | string | 任务初始状态：`queued` |
| `model` | string | 所用模型名 |
| `prompt` | string | 输入的 prompt |

### Status 枚举

| 值 | 含义 |
|----|------|
| `queued` | 等待开始 |
| `started` | 已开始处理（仅适用于 Video from Reference 接口的初始状态） |
| `in_progress` | 生成中 |
| `completed` | 生成完成 |
| `failed` | 生成失败 |
| `cancelled` | 已取消 |

---

## 2. Query Status（任务查询）

**API ID:** `api-M9v0w87KjxoY`
**third_part_domain:** `app-cblk1rqa5fk1-api-M9v0w87KjxoY-gateway.appmiaoda.com`
**计费:** 不启用（`enable_billing: false`）

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `video_id` | string | 是 | 视频任务 ID，格式 `video_[hash]` |

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 视频任务 ID |
| `object` | string | 固定值 `"video"` |
| `created_at` | integer | 任务创建时间戳 |
| `status` | string | 当前状态（见状态枚举） |
| `completed_at` | integer \| null | 完成时间戳，未完成时为 null |
| `error` | string \| null | 错误信息，无错误时为 null |
| `expires_at` | integer \| null | 过期时间戳，未完成时为 null |
| `model` | string | 使用的模型，如 `"sora-2"` |
| `progress` | integer | 进度百分比（0-100） |
| `prompt` | string | 原始 prompt |
| `remixed_from_video_id` | string \| null | Remix 源视频 ID |
| `seconds` | string | 视频时长 |
| `size` | string | 视频分辨率 |
| `video_url` | string | **仅 status 为 completed 时存在**，视频下载 URL |

---

## 3. Video from Reference（图生视频）

**API ID:** `api-W9z3qro1AVZL`
**third_part_domain:** `app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com`
**计费:** 启用（`enable_billing: true`, `need_count_calls: true`）

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 使用 `"sora-2"` |
| `prompt` | string | 是 | — | 描述期望输出（在参考图/视频上下文中） |
| `size` | string | 是 | — | 视频分辨率，支持 `"720x1280"`、`"1280x720"` |
| `seconds` | integer | 是 | — | 视频时长，使用 `8` |
| `input_reference` | file/binary | 是 | — | 参考图文件（JPEG/PNG/WebP），**分辨率须与 size 完全匹配**；**文件大小 ≤ 10 MB**；**严禁压缩或重新编码，须保留原始字节流** |

**注意：** 参考图分辨率必须与 `size` 参数保持一致（只支持 720x1280 / 1280x720）。

### 响应字段

与 Create Video 相同（返回视频任务信息，初始 `status` 为 `started`）。

---

## 4. Remix Video（视频 Remix）

**API ID:** `api-M9v0wP10kQjY`
**third_part_domain:** `app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com`
**计费:** 启用（`enable_billing: true`, `need_count_calls: true`）

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `video_id` | string | 是 | 已完成视频的 ID（如 `"video_abc123"`），源视频必须 `status === "completed"` |
| `prompt` | string | 是 | 描述希望做出的修改（建议每次只描述一项明确修改，如颜色调整、光照变化等） |

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 新视频任务 ID |
| `status` | string | 初始状态 `"queued"` |
| `model` | string | 使用的模型 |
| `prompt` | string | 修改指令 |
| `remix_video_id` | string | 源视频 ID |

---

## 生成期代码

以下 TypeScript 代码可在脚本中直接运行。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

// --- Create Video（文生视频）---
async function createVideo(params: {
  prompt: string;
  size?: "720x1280" | "1280x720";
  seconds?: 4 | 8 | 12;
  model?: string;
}): Promise<string> {
  const form = new FormData();
  form.append("model", params.model ?? "sora-2");
  form.append("prompt", params.prompt);
  form.append("size", params.size ?? "720x1280");
  form.append("seconds", String(params.seconds ?? 4));

  const res = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com/openai/v1/videos",
    {
      method: "POST",
      headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(`Create video failed: ${res.status}`);
  const json = await res.json();
  return json.id as string;
}

// --- Create Video from Reference（图生视频）---
async function createVideoFromReference(params: {
  prompt: string;
  size: "720x1280" | "1280x720";
  seconds: 8;
  imageUrl: string; // 参考图 URL（会自动下载）
}): Promise<string> {
  const imageResp = await fetch(params.imageUrl);
  if (!imageResp.ok) throw new Error(`Failed to fetch reference image: ${imageResp.status}`);
  const imageBlob = await imageResp.blob();

  // --- 校验 input_reference ---
  // 1. 格式：仅允许 JPEG / PNG / WebP
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(imageBlob.type)) {
    throw new Error(
      `input_reference 格式不支持：${imageBlob.type}，仅允许 image/jpeg、image/png、image/webp`,
    );
  }
  // 2. 文件大小：≤ 10 MB
  const MAX_BYTES = 10 * 1024 * 1024;
  if (imageBlob.size > MAX_BYTES) {
    throw new Error(
      `input_reference 文件过大：${(imageBlob.size / 1024 / 1024).toFixed(1)} MB，上限 10 MB`,
    );
  }
  // 注意：直接使用原始字节流，严禁 resize / 重新编码 / 有损压缩

  const filename = params.imageUrl.split("/").pop() ?? "reference.jpg";

  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", params.prompt);
  form.append("size", params.size);
  form.append("seconds", String(params.seconds));
  form.append("input_reference", imageBlob, filename);

  const res = await fetch(
    "https://app-cblk1rqa5fk1-api-W9z3qro1AVZL-gateway.appmiaoda.com/openai/v1/videos",
    {
      method: "POST",
      headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(`Create video from reference failed: ${res.status}`);
  const json = await res.json();
  return json.id as string;
}

// --- Remix Video ---
async function remixVideo(params: {
  video_id: string;
  prompt: string;
}): Promise<string> {
  const res = await fetch(
    "https://app-cblk1rqa5fk1-api-M9v0wP10kQjY-gateway.appmiaoda.com/openai/v1/videos/remix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    },
  );
  if (!res.ok) throw new Error(`Remix video failed: ${res.status}`);
  const json = await res.json();
  return json.id as string;
}

// --- Query Status ---
async function queryVideoStatus(videoId: string): Promise<{
  id: string;
  status: string;
  progress: number;
  video_url?: string;
  error?: string | null;
}> {
  const res = await fetch(
    "https://app-cblk1rqa5fk1-api-M9v0w87KjxoY-gateway.appmiaoda.com/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ video_id: videoId }),
    },
  );
  if (!res.ok) throw new Error(`Query failed: ${res.status}`);
  return res.json();
}

// --- 完整轮询工作流 ---
async function generateAndWait(videoId: string): Promise<string> {
  const POLL_INTERVAL_MS = 8000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoStatus(videoId);
    if (result.status === "completed") {
      if (!result.video_url) throw new Error("completed but no video_url");
      return result.video_url;
    }
    if (result.status === "failed") {
      throw new Error(`Video ${videoId} failed: ${JSON.stringify(result.error)}`);
    }
    if (result.status === "cancelled") {
      throw new Error(`Video ${videoId} was cancelled`);
    }
    console.log(`[${videoId}] Progress: ${result.progress}% (${result.status})`);
  }
  throw new Error(`Video ${videoId} timed out after 10 minutes`);
}

// 使用示例：文生视频
const videoId = await createVideo({
  prompt: "A video of a cool cat on a motorcycle in the night",
  size: "1280x720",
  seconds: 8,
});
const videoUrl = await generateAndWait(videoId);
console.log("Video URL:", videoUrl);
```

---

## Edge Function 代码

### Edge Function 公共工具（Supabase Storage 转存）

参考图片下方的 `streamMediaToStorage` 函数需要在每个 Edge Function 文件中引用。

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * 将远端媒体资源（图片/视频/音频）流式写入 Supabase Storage，返回持久化公开 URL。
 * @param mediaUrl 远端资源 URL
 * @param bucketName 目标 bucket 名
 * @param upsert 是否覆盖已有文件
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
  upsert = false,
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl);
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const isAllowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream";
    if (!isAllowed) throw new Error(`Unsupported content type: ${contentType}`);
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, path: data.path, publicUrl: urlData.publicUrl, contentType };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

---

### sora-create-video Edge Function（Web & MiniProgram 通用）

```typescript
// edge-functions/sora-create-video.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let prompt: string;
  let size: string;
  let seconds: string;
  let model: string;
  let inputReferenceUrl: string | undefined;

  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    size = body.size ?? "720x1280";
    seconds = String(body.seconds ?? 4);
    model = body.model ?? "sora-2";
    inputReferenceUrl = body.input_reference_url; // 可选：参考图 URL
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构建 form-data ---
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", seconds);

  if (inputReferenceUrl) {
    const imgResp = await fetch(inputReferenceUrl);
    if (!imgResp.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch reference image: ${imgResp.status}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const imgBlob = await imgResp.blob();
    // 校验格式
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imgBlob.type)) {
      return new Response(
        JSON.stringify({ error: `input_reference 格式不支持：${imgBlob.type}，仅允许 JPEG/PNG/WebP` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    // 校验文件大小（≤ 10 MB）
    const MAX_BYTES = 10 * 1024 * 1024;
    if (imgBlob.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: `input_reference 文件过大：${(imgBlob.size / 1024 / 1024).toFixed(1)} MB，上限 10 MB` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    // 直接使用原始字节流，严禁压缩或重新编码
    const filename = inputReferenceUrl.split("/").pop() ?? "reference.jpg";
    form.append("input_reference", imgBlob, filename);
  }

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com/openai/v1/videos",
    {
      method: "POST",
      headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      body: form,
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  // 返回 videoId 供客户端轮询
  return new Response(JSON.stringify({ videoId: data.id, status: data.status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

### sora-video-from-reference Edge Function（Video from Reference，api-W9z3qro1AVZL）

> 此 Edge Function 专用于 Video from Reference 接口，`input_reference_url` 为**必填参数**，
> 且 `seconds` 固定传 `8`。区别于 `sora-create-video`（调用 `api-Xa6Jew6JjAqa`）。

```typescript
// edge-functions/sora-video-from-reference.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求 ---
  let prompt: string;
  let size: string;
  let inputReferenceUrl: string;

  try {
    const body = await req.json();
    prompt = body.prompt;
    inputReferenceUrl = body.input_reference_url;
    if (!prompt) throw new Error("Missing prompt");
    if (!inputReferenceUrl) throw new Error("Missing input_reference_url");
    size = body.size ?? "720x1280";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 下载参考图并校验 ---
  const imgResp = await fetch(inputReferenceUrl);
  if (!imgResp.ok) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch reference image: ${imgResp.status}` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const imgBlob = await imgResp.blob();
  // 校验格式
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(imgBlob.type)) {
    return new Response(
      JSON.stringify({ error: `input_reference 格式不支持：${imgBlob.type}，仅允许 JPEG/PNG/WebP` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  // 校验文件大小（≤ 10 MB）
  const MAX_BYTES = 10 * 1024 * 1024;
  if (imgBlob.size > MAX_BYTES) {
    return new Response(
      JSON.stringify({ error: `input_reference 文件过大：${(imgBlob.size / 1024 / 1024).toFixed(1)} MB，上限 10 MB` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  // 直接使用原始字节流，严禁压缩或重新编码
  const filename = inputReferenceUrl.split("/").pop() ?? "reference.jpg";

  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", "8"); // Video from Reference 固定使用 8 秒
  form.append("input_reference", imgBlob, filename);

  // --- 调用 api-W9z3qro1AVZL（Video from Reference 专用接口）---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-W9z3qro1AVZL-gateway.appmiaoda.com/openai/v1/videos",
    {
      method: "POST",
      headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      body: form,
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  // 初始 status 为 "started"（区别于 Create Video 的 "queued"）
  return new Response(JSON.stringify({ videoId: data.id, status: data.status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

### sora-query-video Edge Function（Web & MiniProgram 通用，含 Storage 转存）

```typescript
// edge-functions/sora-query-video.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// streamMediaToStorage 函数同公共工具（粘贴到此文件中）
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp4";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let videoId: string;
  try {
    const body = await req.json();
    videoId = body.video_id;
    if (!videoId) throw new Error("Missing video_id");
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
    "https://app-cblk1rqa5fk1-api-M9v0w87KjxoY-gateway.appmiaoda.com/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ video_id: videoId }),
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();

  // 若已完成，将 video_url 转存至 Supabase Storage
  if (data.status === "completed" && data.video_url) {
    const transfer = await streamMediaToStorage(data.video_url, "generated-media");
    if (transfer.success) {
      return new Response(
        JSON.stringify({ ...data, publicUrl: transfer.publicUrl }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // 转存失败时退回原始 URL（不阻塞主流程）
    console.error("Storage transfer failed:", transfer.error);
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

### sora-remix-video Edge Function（Web & MiniProgram 通用）

```typescript
// edge-functions/sora-remix-video.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let videoId: string;
  let prompt: string;
  try {
    const body = await req.json();
    videoId = body.video_id;
    prompt = body.prompt;
    if (!videoId) throw new Error("Missing video_id");
    if (!prompt) throw new Error("Missing prompt");
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
    "https://app-cblk1rqa5fk1-api-M9v0wP10kQjY-gateway.appmiaoda.com/openai/v1/videos/remix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ video_id: videoId, prompt }),
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify({ videoId: data.id, status: data.status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（React + supabase-js）

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

/**
 * 发起文生视频任务，返回 videoId。
 * @param prompt 视频描述
 * @param size 分辨率，默认 720x1280
 * @param seconds 时长（秒），默认 8
 */
async function startVideoGeneration(
  prompt: string,
  size: "720x1280" | "1280x720" = "720x1280",
  seconds: 4 | 8 | 12 = 8,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("sora-create-video", {
    body: { prompt, size, seconds },
  });
  if (error) throw error;
  return data.videoId as string;
}

/**
 * 查询视频状态，completed 时返回 Supabase Storage 公开 URL。
 * @param videoId 任务 ID
 */
async function queryVideoStatus(videoId: string): Promise<{
  status: string;
  progress: number;
  publicUrl?: string;
}> {
  const { data, error } = await supabase.functions.invoke("sora-query-video", {
    body: { video_id: videoId },
  });
  if (error) throw error;
  return data;
}

/**
 * 完整轮询工作流：提交任务 → 轮询完成 → 返回视频 URL。
 * @param prompt 视频描述
 * @param onProgress 进度回调（0-100）
 */
async function generateVideoAndWait(
  prompt: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const videoId = await startVideoGeneration(prompt);

  const POLL_INTERVAL_MS = 8000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoStatus(videoId);
    onProgress?.(result.progress);
    if (result.status === "completed") {
      if (!result.publicUrl) throw new Error("completed but no publicUrl");
      return result.publicUrl;
    }
    if (result.status === "failed") throw new Error(`Video generation failed: ${videoId}`);
    if (result.status === "cancelled") throw new Error(`Video generation cancelled: ${videoId}`);
  }
  throw new Error(`Video ${videoId} timed out after 10 minutes`);
}

/**
 * Remix 已完成的视频，返回新任务 videoId（再调用轮询获取结果）。
 * @param sourceVideoId 源视频 ID（status 须为 completed）
 * @param modificationPrompt 修改描述（建议每次只描述一项修改）
 */
async function remixVideo(sourceVideoId: string, modificationPrompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("sora-remix-video", {
    body: { video_id: sourceVideoId, prompt: modificationPrompt },
  });
  if (error) throw error;
  return data.videoId as string;
}

// React 组件示例
export function VideoGeneratorComponent() {
  const [videoUrl, setVideoUrl] = React.useState<string>("");
  const [progress, setProgress] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setProgress(0);
    try {
      const url = await generateVideoAndWait(
        "A video of a cool cat on a motorcycle in the night",
        (p) => setProgress(p),
      );
      setVideoUrl(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? `生成中 ${progress}%` : "生成视频"}
      </button>
      {videoUrl && <video src={videoUrl} controls />}
    </div>
  );
}
```

---

### MiniProgram 平台（Taro + supabase-js）

```typescript
import Taro from "@tarojs/taro";
import { Video } from "@tarojs/components";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!,
);

/**
 * 发起文生视频任务，返回 videoId。
 * @param prompt 视频描述
 * @param size 分辨率，默认 720x1280
 * @param seconds 时长（秒），默认 8
 */
async function startVideoGeneration(
  prompt: string,
  size: "720x1280" | "1280x720" = "720x1280",
  seconds: 4 | 8 | 12 = 8,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("sora-create-video", {
    body: { prompt, size, seconds },
  });
  if (error) throw error;
  return data.videoId as string;
}

/**
 * 查询视频状态，completed 时返回 Supabase Storage 公开 URL。
 * @param videoId 任务 ID
 */
async function queryVideoStatus(videoId: string): Promise<{
  status: string;
  progress: number;
  publicUrl?: string;
}> {
  const { data, error } = await supabase.functions.invoke("sora-query-video", {
    body: { video_id: videoId },
  });
  if (error) throw error;
  return data;
}

/**
 * 完整轮询工作流：提交任务 → 轮询完成 → 返回视频 URL。
 * @param prompt 视频描述
 * @param onProgress 进度回调（0-100）
 */
async function generateVideoAndWait(
  prompt: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const videoId = await startVideoGeneration(prompt);

  const POLL_INTERVAL_MS = 8000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoStatus(videoId);
    onProgress?.(result.progress);
    if (result.status === "completed") {
      if (!result.publicUrl) throw new Error("completed but no publicUrl");
      return result.publicUrl;
    }
    if (result.status === "failed") throw new Error(`Video generation failed: ${videoId}`);
    if (result.status === "cancelled") throw new Error(`Video generation cancelled: ${videoId}`);
  }
  throw new Error(`Video ${videoId} timed out after 10 minutes`);
}

// Taro 组件示例
export function VideoGeneratorMiniProgram() {
  const [videoUrl, setVideoUrl] = Taro.useState<string>("");
  const [progress, setProgress] = Taro.useState(0);
  const [loading, setLoading] = Taro.useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setProgress(0);
    try {
      const url = await generateVideoAndWait(
        "A cute kitten chasing a butterfly in a garden",
        (p) => setProgress(p),
      );
      setVideoUrl(url);
    } catch (err) {
      Taro.showToast({ title: "生成失败", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? `生成中 ${progress}%` : "生成视频"}
      </Button>
      {videoUrl && <Video src={videoUrl} controls={true} autoPlay={false} />}
    </View>
  );
}
```

---

## 注意事项

### 密钥安全

- `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get("INTEGRATIONS_API_KEY")` 读取，**严禁暴露到前端**。

### 计费

| 接口 | 计费状态 | 说明 |
|------|----------|------|
| Create Video | 启用 | 每次调用计费，避免重复发起任务 |
| Query Status | 不计费 | 可频繁轮询 |
| Video from Reference | 启用 | 每次调用计费 |
| Remix Video | 启用 | 每次调用计费 |

**original_price:** `0.00`（当前插件原价配置）

### 错误处理

- 务必处理 `429`（配额超限）和 `402`（余额不足），Edge Function 中已转发原始错误体。
- 轮询时注意 `status === "failed"` 需立即终止循环并抛出错误，避免无效等待。
- `video_url` **仅在 `status === "completed"` 时出现**，访问前须检查字段存在性。
- 视频 URL 有过期时间（`expires_at`），转存至 Supabase Storage 后使用持久化 `publicUrl`。

### 分辨率约束

- 图生视频（Video from Reference）时，参考图分辨率**必须**与 `size` 参数完全匹配。
- 仅支持 `720x1280`（竖屏）和 `1280x720`（横屏）两种分辨率。

### input_reference 校验要点

- **格式**：仅支持 JPEG / PNG / WebP；其他格式（如 GIF、BMP、HEIC）须在提交前转换，不可直接上传。
- **文件大小**：≤ 10 MB；超出时应在生成期 / Edge Function 侧提前报错，避免浪费计费调用次数。
- **严禁压缩或重新编码**：获取到原始字节后，直接以 Blob 形式传入 FormData，**不得** resize、调整 quality、或做任何有损处理。压缩会改变像素数据，可能导致上游校验失败或参考帧生成质量下降。
- **分辨率须与 size 一致**：若用户上传图片尺寸不符，应提示用户自行裁剪到对应分辨率后重新上传，而非在服务端静默缩放（缩放同样属于重新编码，且会破坏像素对齐）。

### 内容限制

- 仅可生成适龄（18 岁以下）内容。
- 不得包含版权角色、版权音乐、真实公众人物。
- 含人脸的参考图需要特殊权限。

### Remix 最佳实践

- 每次 Remix 建议**仅描述一项修改**（如颜色调整、光照变化），过多修改会降低保真度。
- 源视频必须处于 `completed` 状态才可发起 Remix。
