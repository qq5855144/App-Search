# Image Generation API — 完整规格与实现

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `50d97b86-ac31-4cc3-8720-bdb32701a437` |
| Plugin 标题 | 图片生成与编辑（高级版） |
| 认证模式 | `platform_managed`（`traefik: true`） |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |
| Auth Header | `X-Gateway-Authorization: Bearer <key>` |
| 支持平台 | Web、MiniProgram |

---

## 接口 1：提交图片生成任务

| 字段 | 值 |
|------|----|
| API ID | `api-ra5EZDjVKkXa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-ra5EZDjVKkXa-gateway.appmiaoda.com/image-generation/submit` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-ra5EZDjVKkXa-gateway.appmiaoda.com` |
| 计费 | 启用（discount_price: 45.00，original_price: 65.00，单价 45） |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `contents` | Array | 是 | 输入内容集合 |
| `contents[].parts` | Array | 是 | 输入片段集合，可包含文本或图像 |
| `contents[].parts[].text` | String | 否 | 提示词文本描述（与 `inline_data` 二选一） |
| `contents[].parts[].inline_data` | Object | 否 | 图像输入对象（与 `text` 二选一） |
| `contents[].parts[].inline_data.mime_type` | String | 是（含 inline_data 时） | 图像 MIME 类型：`image/png`、`image/jpeg`、`image/webp` |
| `contents[].parts[].inline_data.data` | String | 是（含 inline_data 时） | 纯 Base64 编码字符串（不含 `data:image/xxx;base64,` 前缀） |

**请求体大小限制：** 总大小 < 20MB（含文本 + Base64 图像数据）

**Base64 格式要求：**
- 正确：`iVBORw0KGgoAAAANSUhEUgAA...`（纯 Base64 字符串）
- 错误：`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...`（含前缀）

### 响应字段

**成功响应（HTTP 200，status=0）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | Integer | `0` 表示成功 |
| `data.taskId` | String | 任务 ID，格式 `task-{timestamp}-{uuid}` |
| `data.status` | String | 固定为 `PENDING` |
| `data.estimatedTime` | Integer | 预估执行时间（秒），默认 600 |

**错误响应（HTTP 200，status=1）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | Integer | `1` 表示失败 |
| `message` | String | 错误信息（如"请求体不能为空"、"请求大小超过限制，最大允许 20MB"） |

---

## 接口 2：查询任务状态

| 字段 | 值 |
|------|----|
| API ID | `api-VaOwP2jDmAga` |
| Endpoint（Web） | `POST https://app-cblk1rqa5fk1-api-VaOwP2jDmAga-gateway.appmiaoda.com/image-generation/task` |
| Endpoint（MiniProgram） | `GET https://app-cblk1rqa5fk1-api-VaOwP2jDmAga-gateway.appmiaoda.com/image-generation/task?taskId={taskId}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-VaOwP2jDmAga-gateway.appmiaoda.com` |
| 计费 | 不启用 |

**重要（MiniProgram 平台）：** Miaoda 平台代理会静默丢弃小 POST 请求体（如 `{"taskId":"..."}`），
导致 `Unexpected end of JSON input`。解决方案：Edge Function 改用 GET + URL 查询参数，
URL 参数可在所有代理节点存活。

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `taskId` | String | 是 | 任务 ID，由提交接口返回 |

### 响应字段

**任务成功（status=SUCCESS）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | Integer | `0` |
| `data.taskId` | String | 任务 ID |
| `data.status` | String | `SUCCESS` |
| `data.result.imageUrl` | String | 生成的图片 CDN URL |
| `data.result.candidates` | Array | 图片生成 API 返回的完整候选结果列表 |

**任务处理中（status=PENDING / PROCESSING）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | Integer | `0` |
| `data.taskId` | String | 任务 ID |
| `data.status` | String | `PENDING` 或 `PROCESSING` |

**任务失败（status=FAILED）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | Integer | `0` |
| `data.taskId` | String | 任务 ID |
| `data.status` | String | `FAILED` |
| `data.error.code` | String | 错误码（如 `NO_IMAGE`、`TIMEOUT`、`API_ERROR`、`BOS_ERROR`） |
| `data.error.message` | String | 错误消息 |

**任务状态说明：**

| 状态 | 含义 |
|------|------|
| `PENDING` | 已提交，等待处理 |
| `PROCESSING` | 正在执行 |
| `SUCCESS` | 执行成功，已生成图片 |
| `FAILED` | 执行失败（含超时） |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/** 提交文生图任务，返回 taskId */
async function submitTextToImage(prompt: string): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5EZDjVKkXa-gateway.appmiaoda.com/image-generation/submit",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.status !== 0) throw new Error(`Submit error: ${json.message}`);
  return json.data.taskId;
}

/**
 * 提交图生图任务，返回 taskId
 *
 * @param imageBase64 - 纯 Base64 字符串（不含 data:image/xxx;base64, 前缀）
 * @param mimeType - 图像 MIME 类型（image/png、image/jpeg、image/webp）
 * @param prompt - 提示词
 */
async function submitImageToImage(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5EZDjVKkXa-gateway.appmiaoda.com/image-generation/submit",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.status !== 0) throw new Error(`Submit error: ${json.message}`);
  return json.data.taskId;
}

/**
 * 提交多图生图任务，返回 taskId
 *
 * @param images - 图片数组，每项含 base64（纯编码字符串）和 mimeType
 * @param prompt - 提示词
 */
async function submitMultiImageGeneration(
  images: Array<{ base64: string; mimeType: string }>,
  prompt: string
): Promise<string> {
  const parts = [
    ...images.map((img) => ({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    })),
    { text: prompt },
  ];
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5EZDjVKkXa-gateway.appmiaoda.com/image-generation/submit",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.status !== 0) throw new Error(`Submit error: ${json.message}`);
  return json.data.taskId;
}

/**
 * 查询任务状态
 *
 * @param taskId - 提交接口返回的任务 ID
 * @returns 任务状态及图片 URL（成功时）
 */
async function queryTaskStatus(taskId: string): Promise<{
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  imageUrl?: string;
  error?: { code: string; message: string };
}> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-VaOwP2jDmAga-gateway.appmiaoda.com/image-generation/task",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.status !== 0) throw new Error(`Query error: ${json.message}`);
  return {
    status: json.data.status,
    imageUrl: json.data.result?.imageUrl,
    error: json.data.error,
  };
}

/** 完整异步工作流：提交文生图 → 轮询 → 返回图片 URL（约 5-10 分钟） */
async function generateImage(prompt: string): Promise<string> {
  const taskId = await submitTextToImage(prompt);
  console.log(`Task submitted: ${taskId}`);

  const POLL_INTERVAL_MS = 7000;   // 建议 5-10 s
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTaskStatus(taskId);
    console.log(`Status: ${result.status}`);
    if (result.status === "SUCCESS") return result.imageUrl!;
    if (result.status === "FAILED") {
      throw new Error(`Task failed: ${JSON.stringify(result.error)}`);
    }
    // PENDING / PROCESSING → keep polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}

// 使用示例
const imageUrl = await generateImage(
  "一只可爱的橙色小猫坐在阳光明媚的花园里，周围有五彩斑斓的花朵，卡通风格，高清画质"
);
console.log("Generated image URL:", imageUrl);
```

---

## Edge Function 代码

### Web 平台

```typescript
// edge-functions/submit-image-generation.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote media resource directly into Supabase Storage.
 *
 * @param mediaUrl - The remote URL to fetch and upload
 * @param bucketName - Target Supabase Storage bucket name
 * @param upsert - Whether to overwrite existing files (default: false)
 * @returns Success with publicUrl or failure with error string
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

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let contents: unknown;
  try {
    const body = await req.json();
    contents = body.contents;
    if (!contents) throw new Error("Missing contents");
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

  // 提交任务
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5EZDjVKkXa-gateway.appmiaoda.com/image-generation/submit",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ contents }),
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

```typescript
// edge-functions/query-task.ts  （Web 版：POST body）
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** Stream media URL to Supabase Storage (同上，复用即可) */
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
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
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

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.taskId;
    if (!taskId) throw new Error("Missing taskId");
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
    "https://app-cblk1rqa5fk1-api-VaOwP2jDmAga-gateway.appmiaoda.com/image-generation/task",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
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

  // 任务成功时，将图片 URL 转存至 Supabase Storage，保证持久性
  if (data.status === 0 && data.data?.status === "SUCCESS" && data.data?.result?.imageUrl) {
    const transfer = await streamMediaToStorage(data.data.result.imageUrl, "generated-media");
    if (transfer.success) {
      data.data.result.imageUrl = transfer.publicUrl;
    }
    // 转存失败时保留原始 URL，不阻断请求
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### MiniProgram 平台

**关键差异（来自 examples[]）：** Miaoda 平台代理会静默丢弃小 POST 请求体，
导致查询接口收到 `Unexpected end of JSON input`。
解决方案：query-task Edge Function 改为 GET 方法，taskId 通过 URL 查询参数传递。
前端调用改为 `supabase.functions.invoke("query-task?taskId=...", { method: "GET" })`。

提交接口 Edge Function 与 Web 版相同，此处仅提供差异部分（query-task）：

```typescript
// edge-functions/query-task.ts  （MiniProgram 版：GET + URL 参数）
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
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

serve(async (req: Request): Promise<Response> => {
  // MiniProgram 版：从 URL 查询参数读取 taskId（绕过代理 POST body 丢失问题）
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) {
    return new Response(JSON.stringify({ error: "Missing taskId" }), {
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
    "https://app-cblk1rqa5fk1-api-VaOwP2jDmAga-gateway.appmiaoda.com/image-generation/task",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
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

  // 任务成功时，将图片 URL 转存至 Supabase Storage
  if (data.status === 0 && data.data?.status === "SUCCESS" && data.data?.result?.imageUrl) {
    const transfer = await streamMediaToStorage(data.data.result.imageUrl, "generated-media");
    if (transfer.success) {
      data.data.result.imageUrl = transfer.publicUrl;
    }
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（React / Vue / 原生 TypeScript）

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * 提交图片生成任务（文生图）
 *
 * @param prompt - 图片描述文字
 * @returns 任务 ID
 */
async function submitImageGeneration(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("submit-image-generation", {
    body: {
      contents: [{ parts: [{ text: prompt }] }],
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`提交失败：${data.message}`);
  return data.data.taskId;
}

/**
 * 查询任务状态（Web 版：POST body）
 *
 * @param taskId - 提交接口返回的任务 ID
 */
async function queryTaskStatus(taskId: string): Promise<{
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  imageUrl?: string;
  error?: { code: string; message: string };
}> {
  const { data, error } = await supabase.functions.invoke("query-task", {
    body: { taskId },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`查询失败：${data.message}`);
  return {
    status: data.data.status,
    imageUrl: data.data.result?.imageUrl,
    error: data.data.error,
  };
}

/**
 * 完整工作流：提交 → 轮询 → 返回持久图片 URL
 *
 * @param prompt - 图片描述
 * @returns Supabase Storage 持久公开 URL
 */
async function generateImageAndWait(prompt: string): Promise<string> {
  const taskId = await submitImageGeneration(prompt);
  console.log(`任务已提交，ID：${taskId}`);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTaskStatus(taskId);
    console.log(`任务状态：${result.status}`);
    if (result.status === "SUCCESS") return result.imageUrl!;
    if (result.status === "FAILED") {
      throw new Error(`任务失败：${JSON.stringify(result.error)}`);
    }
  }
  throw new Error("任务超时（10 分钟）");
}

// 图生图：将 File 对象转为纯 Base64 后提交
async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // FileReader 返回 data:image/xxx;base64,xxx，需去掉前缀
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitImageToImageGeneration(
  file: File,
  prompt: string
): Promise<string> {
  const base64 = await convertFileToBase64(file);
  const { data, error } = await supabase.functions.invoke("submit-image-generation", {
    body: {
      contents: [{
        parts: [
          { inline_data: { mime_type: file.type, data: base64 } },
          { text: prompt },
        ],
      }],
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`提交失败：${data.message}`);
  return data.data.taskId;
}
```

### MiniProgram 平台（Taro / 原生小程序）

```typescript
import Taro from "@tarojs/taro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!
);

/**
 * 提交图片生成任务（MiniProgram 版，与 Web 相同）
 *
 * @param prompt - 图片描述文字
 * @returns 任务 ID
 */
async function submitImageGeneration(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("submit-image-generation", {
    body: {
      contents: [{ parts: [{ text: prompt }] }],
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`提交失败：${data.message}`);
  return data.data.taskId;
}

/**
 * 查询任务状态（MiniProgram 版：GET + URL 参数，绕过代理 body 丢失问题）
 *
 * @param taskId - 提交接口返回的任务 ID
 */
async function queryTaskStatus(taskId: string): Promise<{
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  imageUrl?: string;
  error?: { code: string; message: string };
}> {
  // 关键：用 GET + URL 参数，而非 POST body
  const { data, error } = await supabase.functions.invoke(
    `query-task?taskId=${encodeURIComponent(taskId)}`,
    { method: "GET" }
  );
  if (error) throw error;
  if (data.status !== 0) throw new Error(`查询失败：${data.message}`);
  return {
    status: data.data.status,
    imageUrl: data.data.result?.imageUrl,
    error: data.data.error,
  };
}

/**
 * 完整工作流：提交 → 轮询 → 返回持久图片 URL
 *
 * @param prompt - 图片描述
 * @returns Supabase Storage 持久公开 URL
 */
async function generateImageAndWait(prompt: string): Promise<string> {
  const taskId = await submitImageGeneration(prompt);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTaskStatus(taskId);
    if (result.status === "SUCCESS") return result.imageUrl!;
    if (result.status === "FAILED") {
      throw new Error(`任务失败：${JSON.stringify(result.error)}`);
    }
  }
  throw new Error("任务超时（10 分钟）");
}

// 小程序图生图：使用 Taro.chooseImage 选图，调用 FileSystemManager 转 Base64
async function submitImageToImageGeneration(prompt: string): Promise<string> {
  const chooseRes = await Taro.chooseImage({ count: 1, sourceType: ["album", "camera"] });
  const filePath = chooseRes.tempFilePaths[0];

  const base64 = await new Promise<string>((resolve, reject) => {
    const fs = Taro.getFileSystemManager();
    fs.readFile({
      filePath,
      encoding: "base64",
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });

  // 从文件后缀推断 mimeType
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpeg";
  const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp" };
  const mimeType = mimeMap[ext] ?? "image/jpeg";

  const { data, error } = await supabase.functions.invoke("submit-image-generation", {
    body: {
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`提交失败：${data.message}`);
  return data.data.taskId;
}
```

### App 平台（Expo）

App 端提交任务和查询状态的调用方式与 Web 相同（`supabase.functions.invoke`，POST body）。
图生图场景需使用 `expo-image-picker` 获取 Base64 图像数据。

**依赖安装：**

```bash
npx expo install expo-image-picker
```

- `expo-image-picker`：图片选择器，`launchImageLibraryAsync({ base64: true })` 可直接返回纯 Base64 字符串（不含 `data:image/...` 前缀），无需额外转换

**Edge Function：** 与 Web 平台相同（POST body），无需为 App 单独编写。

**前端调用代码：**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Button, Image, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/client/supabase';

/** 提交文生图任务 */
async function submitTextToImage(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('submit-image-generation', {
    body: {
      contents: [{ parts: [{ text: prompt }] }],
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`提交失败：${data.message}`);
  return data.data.taskId;
}

/** 提交图生图任务 */
async function submitImageToImage(
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('submit-image-generation', {
    body: {
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
    },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`提交失败：${data.message}`);
  return data.data.taskId;
}

/** 查询任务状态（与 Web 相同，POST body） */
async function queryTaskStatus(taskId: string): Promise<{
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  imageUrl?: string;
  error?: { code: string; message: string };
}> {
  const { data, error } = await supabase.functions.invoke('query-task', {
    body: { taskId },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`查询失败：${data.message}`);
  return {
    status: data.data.status,
    imageUrl: data.data.result?.imageUrl,
    error: data.data.error,
  };
}

/** 轮询等待任务完成 */
async function pollUntilDone(taskId: string): Promise<string> {
  const POLL_INTERVAL = 7000;
  const TIMEOUT = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const result = await queryTaskStatus(taskId);
    if (result.status === 'SUCCESS') return result.imageUrl!;
    if (result.status === 'FAILED') {
      throw new Error(`任务失败：${JSON.stringify(result.error)}`);
    }
  }
  throw new Error('任务超时（10 分钟）');
}

export default function ImageGenerationScreen() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  /** 文生图 */
  const handleTextToImage = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setImageUrl('');
    try {
      setStatus('提交任务中...');
      const taskId = await submitTextToImage(prompt);
      setStatus(`任务已提交 (${taskId})，生成中...`);
      const url = await pollUntilDone(taskId);
      setImageUrl(url);
      setStatus('生成完成');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '生成失败');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  /** 图生图：选择图片 → 提交 */
  const handleImageToImage = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setImageUrl('');
    try {
      // 使用 expo-image-picker 选取图片，base64: true 直接返回纯 Base64 字符串
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0].base64) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'image/jpeg';

      setStatus('提交任务中...');
      const taskId = await submitImageToImage(asset.base64, mimeType, prompt);
      setStatus(`任务已提交 (${taskId})，生成中...`);
      const url = await pollUntilDone(taskId);
      setImageUrl(url);
      setStatus('生成完成');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '生成失败');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <TextInput
        placeholder="输入图片描述..."
        value={prompt}
        onChangeText={setPrompt}
        multiline
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, minHeight: 80 }}
      />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Button title="文生图" onPress={handleTextToImage} disabled={loading} />
        <Button title="图生图" onPress={handleImageToImage} disabled={loading} />
      </View>
      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {status ? <Text style={{ marginTop: 8, color: '#666' }}>{status}</Text> : null}
      {errorMsg ? <Text style={{ marginTop: 8, color: 'red' }}>{errorMsg}</Text> : null}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 300, marginTop: 16, borderRadius: 8 }} resizeMode="contain" />
      ) : null}
    </ScrollView>
  );
}
```

**CRITICAL 注意事项（App 平台）：**

- **`expo-image-picker` 的 `base64: true`** 选项直接返回纯 Base64 字符串（不含 `data:image/xxx;base64,` 前缀），与 API 要求的格式完全匹配，无需手动截取
- **图生图输入无需上传至 Storage**：Base64 直接通过 Edge Function 传给上游 API，不走 Storage
- **生成结果已由 Edge Function 转存**：query-task Edge Function 内置 `streamMediaToStorage`，任务成功时自动将图片转存至 Supabase Storage 并返回持久 URL
- **请求大小限制**：总请求体（含 Base64 图像）< 20MB，图生图时注意图片大小
- **轮询间隔**：建议 7 秒，超时建议 10 分钟；图片生成通常需 1-5 分钟

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。

2. **计费**：提交接口（`api-ra5EZDjVKkXa`）启用计费，折扣单价 45.00，原价 65.00；
   查询接口（`api-VaOwP2jDmAga`）不计费。请避免不必要的重复提交。

3. **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种错误状态码，
   这两种错误会从上游直接转发。

4. **Base64 格式**：`inline_data.data` 必须是纯 Base64 字符串，
   不含 `data:image/xxx;base64,` 前缀，否则接口将返回错误。

5. **轮询间隔**：建议 5-10 秒轮询一次，超时时间建议设置 10 分钟以上；
   任务最长执行时间为 20 分钟，超过后返回 `FAILED`（`error.code: "TIMEOUT"`）。

6. **图片持久化**：上游返回的 `imageUrl` 是 CDN 临时链接，建议通过
   Supabase Storage 转存后使用持久 `publicUrl`。
   Edge Function 中已集成 `streamMediaToStorage`，成功时自动替换 URL。

7. **MiniProgram 查询接口**：Miaoda 平台代理会静默丢弃小 POST 请求体，
   必须改用 GET + URL 参数传递 taskId，详见 MiniProgram Edge Function 代码。

8. **请求大小限制**：总请求体大小（含所有 Base64 图像）< 20MB。
   多图合成时需特别注意各图片大小之和。

9. **支持的图片格式**：仅支持 `image/png`、`image/jpeg`、`image/webp`。
