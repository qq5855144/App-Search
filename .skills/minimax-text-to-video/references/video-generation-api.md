# 文生视频（MiniMax）API 参考

## 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `9906746a-a39d-46a0-bb61-d3f732db1974` |
| 认证模式 | `platform_managed` |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| 第三方域名 | `app-cblk1rqa5fk1-api-V9gDzg15D7BL-gateway.appmiaoda.com` |

---

## API 1：创建文生视频任务

| 项目 | 值 |
|------|----|
| API ID | `api-V9gDzg15D7BL` |
| 方法 | POST |
| Endpoint | `https://app-cblk1rqa5fk1-api-V9gDzg15D7BL-gateway.appmiaoda.com/v1/video_generation` |
| Content-Type | `application/json` |

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型名称，可选值：`MiniMax-Hailuo-02` |
| `prompt` | string | 是 | — | 视频文本描述，最大 2000 字符；支持 `[指令]` 语法进行运镜控制 |
| `prompt_optimizer` | boolean | 否 | `true` | 是否自动优化 prompt，设为 `false` 可进行更精确控制 |
| `fast_pretreatment` | boolean | 否 | `false` | 是否缩短优化耗时，仅对 MiniMax-Hailuo-2.3 和 MiniMax-Hailuo-02 生效 |
| `duration` | integer | 否 | `6` | 视频时长（秒），可选 6 或 10（取决于模型和分辨率） |
| `resolution` | string | 否 | `768P` | 视频分辨率，可选值：`768P`、`1080P`（MiniMax-Hailuo-02）；`720P` 仅对 T2V-01/T2V-01-Director 等旧模型有效 |
| `callback_url` | string | 否 | — | 接收任务状态更新通知的回调 URL |
| `aigc_watermark` | boolean | 否 | `false` | 是否在生成的视频中添加水印 |

**运镜控制指令（通过 `[指令]` 语法嵌入 prompt）：**

| 类型 | 指令 |
|------|------|
| 左右移 | `[左移]`、`[右移]` |
| 左右摇 | `[左摇]`、`[右摇]` |
| 推拉 | `[推进]`、`[拉远]` |
| 升降 | `[上升]`、`[下降]` |
| 上下摇 | `[上摇]`、`[下摇]` |
| 变焦 | `[变焦推近]`、`[变焦拉远]` |
| 其他 | `[晃动]`、`[跟随]`、`[固定]` |

**分辨率与时长对照：**

| 模型 | 768P | 1080P |
|------|------|-------|
| MiniMax-Hailuo-02 | 6s 或 10s | 仅 6s |

### 响应字段

**成功（status_code = 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `task_id` | string | 视频生成任务 ID，用于后续查询 |
| `base_resp.status_code` | integer | 状态码（0 表示成功） |
| `base_resp.status_msg` | string | 状态信息 |

**错误状态码：**

| status_code | 含义 |
|-------------|------|
| 0 | 成功 |
| 1002 | 触发限流，请稍后再试 |
| 1004 | 账号鉴权失败，请检查 API Key |
| 1008 | 账号余额不足 |
| 1026 | 视频描述涉及敏感内容，请调整 |
| 2013 | 传入参数异常，请检查入参 |
| 2049 | 无效的 API Key |

### 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 创建文生视频任务
 * @param prompt - 视频文本描述，最大 2000 字符，支持 [运镜指令] 语法
 * @param model - 模型名称，默认 "MiniMax-Hailuo-02"
 * @param duration - 视频时长（秒），可选 6 或 10，默认 6
 * @param resolution - 视频分辨率，可选 "768P" 或 "1080P"，默认 "768P"
 * @param promptOptimizer - 是否自动优化 prompt，默认 true
 * @returns task_id
 */
async function submitTextToVideo(
  prompt: string,
  model: string = "MiniMax-Hailuo-02",
  duration: number = 6,
  resolution: string = "768P",
  promptOptimizer: boolean = true
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-V9gDzg15D7BL-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        duration,
        resolution,
        prompt_optimizer: promptOptimizer,
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }
  return json.task_id;
}
```

### Edge Function

```typescript
// edge-functions/minimax-video-submit.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let prompt: string;
  let model: string;
  let duration: number;
  let resolution: string;
  let promptOptimizer: boolean;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    model = body.model ?? "MiniMax-Hailuo-02";
    duration = body.duration ?? 6;
    resolution = body.resolution ?? "768P";
    promptOptimizer = body.prompt_optimizer ?? true;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const upstream = await fetch("https://app-cblk1rqa5fk1-api-V9gDzg15D7BL-gateway.appmiaoda.com/v1/video_generation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      duration,
      resolution,
      prompt_optimizer: promptOptimizer,
    }),
  });

  // Forward quota/balance errors verbatim
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

### 前端调用代码

**Web / MiniProgram（通用）：**

```typescript
/**
 * 提交文生视频任务
 * @param prompt - 视频文本描述
 * @param options - 可选参数
 * @returns task_id
 */
async function submitMinimaxVideo(
  prompt: string,
  options?: {
    model?: string;
    duration?: number;
    resolution?: string;
    promptOptimizer?: boolean;
  }
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("minimax-video-submit", {
    body: {
      prompt,
      model: options?.model ?? "MiniMax-Hailuo-02",
      duration: options?.duration ?? 6,
      resolution: options?.resolution ?? "768P",
      prompt_optimizer: options?.promptOptimizer ?? true,
    },
  });
  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`API 错误 ${data.base_resp?.status_code}：${data.base_resp?.status_msg}`);
  }
  return data.task_id;
}
```

---

## API 2：查询视频生成任务状态

| 项目 | 值 |
|------|----|
| API ID | `api-zYkZz2eDWvPL` |
| 方法 | GET |
| Endpoint | `https://app-cblk1rqa5fk1-api-zYkZz2eDWvPL-gateway.appmiaoda.com/v1/query/video_generation` |
| 计费 | 不计费 |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id` | string | 是 | 待查询的任务 ID，只能查询当前账号创建的任务 |

### 响应字段

**成功（status_code = 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `task_id` | string | 被查询的任务 ID |
| `status` | string | 任务状态：`Preparing`（准备中）、`Queueing`（队列中）、`Processing`（生成中）、`Success`（成功）、`Fail`（失败） |
| `file_id` | string | 任务成功时返回，用于获取视频文件的文件 ID |
| `video_width` | integer | 任务成功时返回，生成视频的宽度（像素） |
| `video_height` | integer | 任务成功时返回，生成视频的高度（像素） |
| `base_resp.status_code` | integer | 状态码（0 表示成功） |
| `base_resp.status_msg` | string | 状态信息 |

**错误状态码：**

| status_code | 含义 |
|-------------|------|
| 0 | 成功 |
| 1002 | 触发限流，请稍后再试 |
| 1004 | 账号鉴权失败，请检查 API Key |
| 1026 | 输入内容涉及敏感内容 |
| 1027 | 生成视频涉及敏感内容 |

### 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 查询文生视频任务状态
 * @param taskId - 任务 ID
 * @returns 任务状态对象，含 status 和（成功时）file_id、video_width、video_height
 */
async function queryTextToVideo(taskId: string): Promise<{
  task_id: string;
  status: string;
  file_id?: string;
  video_width?: number;
  video_height?: number;
  base_resp: { status_code: number; status_msg: string };
}> {
  const url = new URL("https://app-cblk1rqa5fk1-api-zYkZz2eDWvPL-gateway.appmiaoda.com/v1/query/video_generation");
  url.searchParams.set("task_id", taskId);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }
  return json;
}
```

### Edge Function

```typescript
// edge-functions/minimax-video-query.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const url = new URL("https://app-cblk1rqa5fk1-api-zYkZz2eDWvPL-gateway.appmiaoda.com/v1/query/video_generation");
  url.searchParams.set("task_id", taskId);
  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

### 前端调用代码

**Web / MiniProgram（通用）：**

```typescript
/**
 * 查询文生视频任务状态
 * @param taskId - 任务 ID
 * @returns 任务状态对象
 */
async function queryMinimaxVideo(taskId: string): Promise<{
  task_id: string;
  status: string;
  file_id?: string;
  video_width?: number;
  video_height?: number;
}> {
  const { data, error } = await supabase.functions.invoke("minimax-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`API 错误 ${data.base_resp?.status_code}：${data.base_resp?.status_msg}`);
  }
  return data;
}
```

---

## API 3：视频文件下载

| 项目 | 值 |
|------|----|
| API ID | `api-GYX1ld3ExkQa` |
| 方法 | GET |
| Endpoint | `https://app-cblk1rqa5fk1-api-GYX1ld3ExkQa-gateway.appmiaoda.com/v1/files/retrieve` |
| 计费 | 不计费 |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `file_id` | integer | 是 | 文件的唯一标识符，由查询任务状态接口返回 |

### 响应字段

**成功（status_code = 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `file.file_id` | integer | 文件的唯一标识符 |
| `file.bytes` | integer | 文件大小（字节） |
| `file.created_at` | integer | 创建文件的 Unix 时间戳（秒） |
| `file.filename` | string | 文件名称 |
| `file.purpose` | string | 文件用途 |
| `file.download_url` | string | 文件下载 URL，**有效期 1 小时** |
| `base_resp.status_code` | integer | 状态码（0 表示成功） |
| `base_resp.status_msg` | string | 状态详情 |

**错误状态码：**

| status_code | 含义 |
|-------------|------|
| 0 | 成功 |
| 1000 | 未知错误 |
| 1001 | 超时 |
| 1002 | 触发 RPM 限流 |
| 1004 | 鉴权失败 |
| 1008 | 余额不足 |
| 1013 | 服务内部错误 |
| 1026 | 输入内容错误 |
| 1027 | 输出内容错误 |
| 1039 | 触发 TPM 限流 |
| 2013 | 输入格式信息不正常 |

### 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 通过 file_id 获取视频文件详情及下载链接
 * @param fileId - 文件 ID（由查询任务状态接口返回）
 * @returns 文件信息，含 download_url（有效期 1 小时）
 */
async function retrieveVideoFile(fileId: string): Promise<{
  file_id: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  download_url: string;
}> {
  const url = new URL("https://app-cblk1rqa5fk1-api-GYX1ld3ExkQa-gateway.appmiaoda.com/v1/files/retrieve");
  url.searchParams.set("file_id", fileId);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }
  return json.file;
}
```

### Edge Function（含 Supabase Storage 转存）

```typescript
// edge-functions/minimax-video-retrieve.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远端媒体 URL 流式转存至 Supabase Storage
 * @param mediaUrl - 远端媒体文件 URL
 * @param bucketName - Supabase Storage 桶名
 * @param upsert - 是否覆盖同名文件
 * @returns 转存结果，含永久 publicUrl
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
  upsert = false
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
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp4";
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

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let fileId: string;
  try {
    const body = await req.json();
    fileId = body.file_id;
    if (!fileId) throw new Error("Missing file_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream to get download URL ---
  const url = new URL("https://app-cblk1rqa5fk1-api-GYX1ld3ExkQa-gateway.appmiaoda.com/v1/files/retrieve");
  url.searchParams.set("file_id", fileId);
  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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
  if (data.base_resp?.status_code !== 0) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Transfer ephemeral video URL to Supabase Storage ---
  const downloadUrl: string = data.file?.download_url;
  if (!downloadUrl) {
    return new Response(JSON.stringify({ error: "No download_url in response" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transfer = await streamMediaToStorage(downloadUrl, "generated-media");
  if (!transfer.success) {
    return new Response(JSON.stringify({ error: `Storage transfer failed: ${transfer.error}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return file info with persistent publicUrl replacing ephemeral download_url
  return new Response(
    JSON.stringify({
      ...data,
      file: { ...data.file, download_url: transfer.publicUrl },
      public_url: transfer.publicUrl,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

### 前端调用代码

**Web / MiniProgram（通用）：**

```typescript
/**
 * 获取视频文件信息（转存后返回永久公开 URL）
 * @param fileId - 文件 ID
 * @returns 含永久 public_url 的文件信息
 */
async function retrieveMinimaxVideo(fileId: string): Promise<{
  file: {
    file_id: string;
    bytes: number;
    created_at: number;
    filename: string;
    purpose: string;
    download_url: string;
  };
  public_url: string;
}> {
  const { data, error } = await supabase.functions.invoke("minimax-video-retrieve", {
    body: { file_id: fileId },
  });
  if (error) throw error;
  if (data.base_resp?.status_code !== 0) {
    throw new Error(`API 错误 ${data.base_resp?.status_code}：${data.base_resp?.status_msg}`);
  }
  return data;
}
```

---

## 完整前端轮询示例

```typescript
/**
 * 提交任务并轮询，最终返回视频永久公开 URL
 * @param prompt - 视频文本描述
 * @param options - 可选参数（model、duration、resolution、promptOptimizer）
 * @returns 视频永久公开 URL（已转存至 Supabase Storage）
 */
async function generateMinimaxVideoFull(
  prompt: string,
  options?: {
    model?: string;
    duration?: number;
    resolution?: string;
    promptOptimizer?: boolean;
  }
): Promise<string> {
  // Step 1: 提交任务
  const taskId = await submitMinimaxVideo(prompt, options);

  // Step 2: 轮询查询状态
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryMinimaxVideo(taskId);
    if (result.status === "Success") {
      if (!result.file_id) throw new Error("Task succeeded but no file_id returned");
      // Step 3: 获取文件并转存
      const fileResult = await retrieveMinimaxVideo(result.file_id);
      return fileResult.public_url;
    }
    if (result.status === "Fail") {
      throw new Error(`Task failed: ${result.base_resp?.status_msg ?? "unknown reason"}`);
    }
    // Preparing / Queueing / Processing → keep polling
  }
  throw new Error("Task timed out after 10 minutes");
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：原价 ¥130.00 / 折扣价 ¥100.00，**仅创建任务接口（api-V9gDzg15D7BL）计费**，查询和下载接口不计费。
  避免重复提交相同 prompt，轮询查询不产生额外费用。
- **下载链接有效期**：`/v1/files/retrieve` 返回的 `download_url` 有效期仅 **1 小时**，
  必须立即转存至 Supabase Storage 以获得永久访问链接。
- **错误处理**：务必处理 429（限流）、1008（余额不足）和 1026（敏感内容）等错误状态码。
- **轮询间隔**：建议每 7 秒轮询一次，设置 10 分钟超时；视频生成通常需要 1-3 分钟。
- **运镜控制**：仅 MiniMax-Hailuo-02 模型支持 `[指令]` 语法，使用前确认模型版本。
- **Supabase Storage 桶**：需预先创建 `generated-media` 桶并设置为 public，否则 `getPublicUrl` 返回的 URL 无法访问。
