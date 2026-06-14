# 可灵图片扩展 API — 完整规格

## 基本信息

| 项目 | 值 |
|------|-----|
| Plugin ID | `60ab5de2-be0d-404a-aab1-0506342e2881` |
| Plugin 标题 | 图片扩展 (可灵) |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| third_part_domain | `app-cblk1rqa5fk1-api-Q9KWnzwVQMk9-gateway.appmiaoda.com` |
| 计费 | 原价 ¥12.00 / 折扣价 ¥8.00（`enable_billing: false` 当前未计费） |

---

## API 1 — 创建扩图任务

| 项目 | 值 |
|------|-----|
| API ID | `api-Q9KWnzwVQMk9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Q9KWnzwVQMk9-gateway.appmiaoda.com/v1/images/editing/expand` |
| Content-Type | `application/json` |

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `image` | string | 是 | — | 参考图片，支持裸 Base64 字符串或图片 URL。格式：.jpg/.jpeg/.png，文件大小 ≤ 10 MB，宽高 ≥ 300 px，宽高比 1:2.5 ~ 2.5:1。**Base64 时不要加 `data:image/...;base64,` 前缀** |
| `up_expansion_ratio` | float | 是 | — | 向上扩充范围，基于原图高度的倍数，取值范围 [0, 2] |
| `down_expansion_ratio` | float | 是 | — | 向下扩充范围，基于原图高度的倍数，取值范围 [0, 2] |
| `left_expansion_ratio` | float | 是 | — | 向左扩充范围，基于原图宽度的倍数，取值范围 [0, 2] |
| `right_expansion_ratio` | float | 是 | — | 向右扩充范围，基于原图宽度的倍数，取值范围 [0, 2] |
| `prompt` | string | 否 | `""` | 正向文本提示词，不超过 2500 个字符 |
| `n` | int | 否 | `1` | 生成图片数量，取值范围 [1, 9] |
| `watermark_info` | object | 否 | — | 水印配置，格式：`{"enabled": boolean}`；`true` 表示生成含水印版本 |
| `callback_url` | string | 否 | — | 任务结果回调通知地址，任务状态变更时服务端主动通知 |
| `external_task_id` | string | 否 | — | 自定义任务 ID，单用户下需保证唯一性，不覆盖系统任务 ID |

### 响应字段（成功 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID，用于跟踪和排查 |
| `data.task_id` | string | 系统生成的任务 ID |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.task_status` | string | 任务状态：`submitted`（已提交）、`processing`（处理中）、`succeed`（成功）、`failed`（失败） |
| `data.created_at` | number | 任务创建时间，Unix 毫秒时间戳 |
| `data.updated_at` | number | 任务更新时间，Unix 毫秒时间戳 |

---

## API 2 — 查询单个扩图任务

| 项目 | 值 |
|------|-----|
| API ID | `api-rLobR6vwZJJ9` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-rLobR6vwZJJ9-gateway.appmiaoda.com/v1/images/editing/expand/{task_id}` |
| Content-Type | `application/json` |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id` | string | 是（与 `external_task_id` 二选一） | 系统生成的任务 ID，填写在请求路径中 |
| `external_task_id` | string | 否（与 `task_id` 二选一） | 用户自定义任务 ID，作为 Query 参数传递 |

### 响应字段（成功 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID |
| `data[].task_id` | string | 任务 ID |
| `data[].task_status` | string | 任务状态（同上） |
| `data[].task_status_msg` | string? | 任务状态信息，失败时显示失败原因 |
| `data[].task_info.external_task_id` | string? | 客户自定义任务 ID |
| `data[].final_unit_deduction` | string? | 任务最终扣减积分数值 |
| `data[].watermark_info.enabled` | boolean? | 是否生成了含水印版本 |
| `data[].created_at` | number | 任务创建时间，Unix 毫秒时间戳 |
| `data[].updated_at` | number | 任务更新时间，Unix 毫秒时间戳 |
| `data[].task_result.images[].index` | number | 图片编号，0-9 |
| `data[].task_result.images[].url` | string | 生成图片的 URL（30 天后失效，需及时转存） |

---

## API 3 — 查询扩图任务列表

| 项目 | 值 |
|------|-----|
| API ID | `api-AalZkPVdZX8L` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-AalZkPVdZX8L-gateway.appmiaoda.com/v1/images/editing/expand` |
| Content-Type | `application/json` |

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `pageNum` | int | 否 | `1` | 页码，取值范围 [1, 1000] |
| `pageSize` | int | 否 | `30` | 每页数据量，取值范围 [1, 500] |

### 响应字段（成功 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID |
| `data[].task_id` | string | 任务 ID |
| `data[].task_status` | string | 任务状态（同上） |
| `data[].task_status_msg` | string? | 任务状态信息 |
| `data[].task_info.external_task_id` | string? | 客户自定义任务 ID |
| `data[].final_unit_deduction` | string? | 任务最终扣减积分数值 |
| `data[].watermark_info.enabled` | boolean? | 是否生成了含水印版本 |
| `data[].created_at` | number | 任务创建时间，Unix 毫秒时间戳 |
| `data[].updated_at` | number | 任务更新时间，Unix 毫秒时间戳 |
| `data[].task_result.images[].index` | number | 图片编号 |
| `data[].task_result.images[].url` | string | 生成图片 URL（30 天后失效） |
| `data[].task_result.images[].watermark_url` | string? | 含水印图片的 URL |

---

## 生成期代码

以下 TypeScript 代码可直接在 Deno 脚本中运行（Agent 直接调用）。

```typescript
// 密钥由平台注入，不可硬编码
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

// ---- 类型定义 ----

interface CreateTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_info: { external_task_id: string };
    task_status: string;
    created_at: number;
    updated_at: number;
  };
}

interface TaskImage {
  index: number;
  url: string;
  watermark_url?: string;
}

interface TaskDetail {
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_info?: { external_task_id?: string };
  final_unit_deduction?: string;
  watermark_info?: { enabled: boolean };
  created_at: number;
  updated_at: number;
  task_result?: { images: TaskImage[] };
}

interface QueryTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: TaskDetail[];
}

// ---- 创建扩图任务 ----

/**
 * 创建图片扩展任务，提交后返回 task_id。
 *
 * @param image - 图片 URL 或裸 Base64 字符串（不含 data: 前缀）
 * @param upRatio - 向上扩充倍数，基于原图高度，范围 [0, 2]
 * @param downRatio - 向下扩充倍数，基于原图高度，范围 [0, 2]
 * @param leftRatio - 向左扩充倍数，基于原图宽度，范围 [0, 2]
 * @param rightRatio - 向右扩充倍数，基于原图宽度，范围 [0, 2]
 * @param prompt - 可选的文本提示词，不超过 2500 字符
 * @param n - 生成图片数量，范围 [1, 9]，默认 1
 * @param watermarkEnabled - 是否同时生成含水印版本
 * @param externalTaskId - 自定义任务 ID（可选）
 * @returns 包含 taskId 的对象
 */
async function createExpandTask(
  image: string,
  upRatio: number,
  downRatio: number,
  leftRatio: number,
  rightRatio: number,
  prompt = "",
  n = 1,
  watermarkEnabled?: boolean,
  externalTaskId?: string,
): Promise<{ taskId: string }> {
  const body: Record<string, unknown> = {
    image,
    up_expansion_ratio: upRatio,
    down_expansion_ratio: downRatio,
    left_expansion_ratio: leftRatio,
    right_expansion_ratio: rightRatio,
    prompt,
    n,
  };
  if (watermarkEnabled !== undefined) {
    body.watermark_info = { enabled: watermarkEnabled };
  }
  if (externalTaskId) {
    body.external_task_id = externalTaskId;
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Q9KWnzwVQMk9-gateway.appmiaoda.com/v1/images/editing/expand",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: CreateTaskResponse = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return { taskId: json.data.task_id };
}

// ---- 查询单个扩图任务 ----

/**
 * 查询指定任务的状态和结果。
 *
 * @param taskId - 系统生成的任务 ID
 * @returns 任务详细信息（含状态、结果图片 URL 等）
 */
async function queryExpandTask(taskId: string): Promise<TaskDetail> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-rLobR6vwZJJ9-gateway.appmiaoda.com/v1/images/editing/expand/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: QueryTaskResponse = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  if (!json.data || json.data.length === 0) throw new Error("Task not found");

  return json.data[0];
}

// ---- 查询任务列表 ----

/**
 * 分页查询扩图任务列表。
 *
 * @param pageNum - 页码，范围 [1, 1000]，默认 1
 * @param pageSize - 每页数据量，范围 [1, 500]，默认 30
 * @returns 任务列表数组
 */
async function listExpandTasks(pageNum = 1, pageSize = 30): Promise<TaskDetail[]> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-AalZkPVdZX8L-gateway.appmiaoda.com/v1/images/editing/expand",
  );
  url.searchParams.set("pageNum", String(pageNum));
  url.searchParams.set("pageSize", String(pageSize));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: QueryTaskResponse = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data;
}

// ---- 完整异步工作流 ----

/**
 * 提交扩图任务并轮询直到完成，返回生成图片信息。
 *
 * @param image - 图片 URL 或裸 Base64 字符串
 * @param upRatio - 向上扩充倍数 [0, 2]
 * @param downRatio - 向下扩充倍数 [0, 2]
 * @param leftRatio - 向左扩充倍数 [0, 2]
 * @param rightRatio - 向右扩充倍数 [0, 2]
 * @param prompt - 可选文本提示词
 * @param n - 生成数量，默认 1
 * @returns 生成的图片数组（含 index 和 url）
 */
async function expandImageAndWait(
  image: string,
  upRatio: number,
  downRatio: number,
  leftRatio: number,
  rightRatio: number,
  prompt = "",
  n = 1,
): Promise<TaskImage[]> {
  const { taskId } = await createExpandTask(
    image, upRatio, downRatio, leftRatio, rightRatio, prompt, n,
  );

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryExpandTask(taskId);
    if (result.task_status === "succeed") {
      return result.task_result?.images ?? [];
    }
    if (result.task_status === "failed") {
      throw new Error(`扩图任务失败: ${result.task_status_msg ?? "未知错误"}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}

// ---- 示例调用 ----
// 示例来源：plugin context 中的请求示例（扩展为 16:9 宽高比，原图 100x100，3 倍面积）
//
// import math
// def calculate_expansion_ratios(width, height, area_multiplier, aspect_ratio):
//   target_area = area_multiplier * width * height
//   target_height = math.sqrt(target_area / aspect_ratio)
//   target_width = target_height * aspect_ratio
//   expand_top = (target_height - height) / 2
//   expand_left = (target_width - width) / 2
//   top_ratio = expand_top / height
//   left_ratio = expand_left / width
//   # 结果 → "0.1495, 0.1495, 0.6547, 0.6547"
//
// const images = await expandImageAndWait(
//   "https://example.com/image.png",
//   0.1495,  // up
//   0.1495,  // down
//   0.6547,  // left
//   0.6547,  // right
//   "",      // prompt
//   2,       // n
// );
// console.log(images);
```

---

## Edge Function 代码

Edge Function 在内部完成"提交任务 → 轮询 → 转存图片到 Supabase Storage"全流程。
前端只需发起一次调用，等待最终图片公开 URL 返回。

Web 和 MiniProgram 使用同一套 Edge Function，前端调用方式相同。

```typescript
// edge-functions/kling-image-expand.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---- Supabase Storage 转存工具（Appendix A） ----

/**
 * 将远端媒体 URL 的资源流式转存至 Supabase Storage，返回持久化公开 URL。
 *
 * @param mediaUrl - 原始图片 URL（可灵返回的临时 URL）
 * @param bucketName - Supabase Storage bucket 名称
 * @param upsert - 是否覆盖同名文件，默认 false
 * @returns 成功时返回 publicUrl，失败时返回 error
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

// ---- 任务轮询 ----

interface TaskImage {
  index: number;
  url: string;
}

interface TaskDetail {
  task_status: string;
  task_status_msg?: string;
  task_result?: { images: TaskImage[] };
}

/**
 * 轮询任务直到完成，返回生成的图片列表。
 *
 * @param taskId - 系统生成的任务 ID
 * @param apiKey - 平台注入的 API 密钥
 * @returns 任务详情（含图片 URL 列表）
 */
async function pollTask(taskId: string, apiKey: string): Promise<TaskDetail> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `https://app-cblk1rqa5fk1-api-rLobR6vwZJJ9-gateway.appmiaoda.com/v1/images/editing/expand/${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
      },
    );

    if (!res.ok) throw new Error(`轮询请求失败: ${res.status}`);

    const json = await res.json();
    if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

    const task: TaskDetail = json.data?.[0];
    if (!task) throw new Error("任务数据为空");

    if (task.task_status === "succeed") return task;
    if (task.task_status === "failed") {
      throw new Error(`扩图任务失败: ${task.task_status_msg ?? "未知错误"}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}

// ---- Edge Function 主入口 ----

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求参数 ---
  let image: string;
  let up_expansion_ratio: number;
  let down_expansion_ratio: number;
  let left_expansion_ratio: number;
  let right_expansion_ratio: number;
  let prompt: string;
  let n: number;
  let watermark_info: { enabled: boolean } | undefined;

  try {
    const body = await req.json();
    image = body.image;
    up_expansion_ratio = body.up_expansion_ratio;
    down_expansion_ratio = body.down_expansion_ratio;
    left_expansion_ratio = body.left_expansion_ratio;
    right_expansion_ratio = body.right_expansion_ratio;
    prompt = body.prompt ?? "";
    n = body.n ?? 1;
    watermark_info = body.watermark_info;

    if (!image) throw new Error("Missing image");
    if (up_expansion_ratio === undefined) throw new Error("Missing up_expansion_ratio");
    if (down_expansion_ratio === undefined) throw new Error("Missing down_expansion_ratio");
    if (left_expansion_ratio === undefined) throw new Error("Missing left_expansion_ratio");
    if (right_expansion_ratio === undefined) throw new Error("Missing right_expansion_ratio");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
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

  try {
    // --- 第一步：提交创建任务 ---
    const requestBody: Record<string, unknown> = {
      image,
      up_expansion_ratio,
      down_expansion_ratio,
      left_expansion_ratio,
      right_expansion_ratio,
      prompt,
      n,
    };
    if (watermark_info !== undefined) requestBody.watermark_info = watermark_info;

    const createRes = await fetch(
      "https://app-cblk1rqa5fk1-api-Q9KWnzwVQMk9-gateway.appmiaoda.com/v1/images/editing/expand",
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
    if (createRes.status === 429 || createRes.status === 402) {
      const errText = await createRes.text();
      return new Response(errText, {
        status: createRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${createRes.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const createJson = await createRes.json();
    if (createJson.code !== 0) {
      return new Response(JSON.stringify({ error: `API error ${createJson.code}: ${createJson.message}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const taskId: string = createJson.data.task_id;

    // --- 第二步：轮询直到完成 ---
    const taskResult = await pollTask(taskId, apiKey);
    const images: TaskImage[] = taskResult.task_result?.images ?? [];

    // --- 第三步：转存图片到 Supabase Storage ---
    const transferredImages = await Promise.all(
      images.map(async (img) => {
        const transfer = await streamMediaToStorage(img.url, "generated-media");
        return {
          index: img.index,
          url: transfer.success ? transfer.publicUrl : img.url, // 转存失败时保留原 URL
          transferSuccess: transfer.success,
          transferError: transfer.success ? undefined : transfer.error,
        };
      }),
    );

    return new Response(
      JSON.stringify({ taskId, images: transferredImages }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
```

---

## 前端调用代码

Edge Function 内部已完成提交 + 轮询 + 转存，前端只需发起一次请求并等待最终图片 URL。

### Web 平台

```typescript
/**
 * 调用可灵扩图 Edge Function，返回转存后的图片 URL 列表。
 *
 * @param image - 图片 URL 或裸 Base64 字符串
 * @param upRatio - 向上扩充倍数 [0, 2]
 * @param downRatio - 向下扩充倍数 [0, 2]
 * @param leftRatio - 向左扩充倍数 [0, 2]
 * @param rightRatio - 向右扩充倍数 [0, 2]
 * @param prompt - 可选文本提示词
 * @param n - 生成数量，默认 1
 * @returns 转存后的图片信息数组
 */
async function klingImageExpand(
  image: string,
  upRatio: number,
  downRatio: number,
  leftRatio: number,
  rightRatio: number,
  prompt = "",
  n = 1,
): Promise<{ index: number; url: string }[]> {
  const { data, error } = await supabase.functions.invoke("kling-image-expand", {
    body: {
      image,
      up_expansion_ratio: upRatio,
      down_expansion_ratio: downRatio,
      left_expansion_ratio: leftRatio,
      right_expansion_ratio: rightRatio,
      prompt,
      n,
    },
  });
  if (error) throw error;
  return data.images;
}

// 示例调用（对应 plugin 中的请求示例：100x100 原图，16:9 比例扩展到 3 倍面积）
// const images = await klingImageExpand(
//   "https://example.com/image.png",
//   0.1495, 0.1495, 0.6547, 0.6547,
//   "", 2,
// );
// images.forEach(img => console.log(img.index, img.url));
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function klingImageExpandFetch(
  image: string,
  upRatio: number,
  downRatio: number,
  leftRatio: number,
  rightRatio: number,
  prompt = "",
  n = 1,
): Promise<{ index: number; url: string }[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-image-expand`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        up_expansion_ratio: upRatio,
        down_expansion_ratio: downRatio,
        left_expansion_ratio: leftRatio,
        right_expansion_ratio: rightRatio,
        prompt,
        n,
      }),
    },
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`配额已用尽：${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`余额不足：${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  return json.images;
}
```

### MiniProgram 平台

```typescript
/**
 * 小程序端调用可灵扩图 Edge Function。
 * 使用 supabase.functions.invoke，Edge Function 返回 JSON（含转存后图片 URL）。
 *
 * @param image - 图片 URL 或裸 Base64 字符串
 * @param upRatio - 向上扩充倍数 [0, 2]
 * @param downRatio - 向下扩充倍数 [0, 2]
 * @param leftRatio - 向左扩充倍数 [0, 2]
 * @param rightRatio - 向右扩充倍数 [0, 2]
 * @param prompt - 可选文本提示词
 * @param n - 生成数量，默认 1
 * @returns 转存后的图片信息数组
 */
async function klingImageExpandMiniProgram(
  image: string,
  upRatio: number,
  downRatio: number,
  leftRatio: number,
  rightRatio: number,
  prompt = "",
  n = 1,
): Promise<{ index: number; url: string }[]> {
  const { data, error } = await supabase.functions.invoke("kling-image-expand", {
    body: {
      image,
      up_expansion_ratio: upRatio,
      down_expansion_ratio: downRatio,
      left_expansion_ratio: leftRatio,
      right_expansion_ratio: rightRatio,
      prompt,
      n,
    },
  });
  if (error) throw error;
  return data.images;
}

// 小程序端展示图片（使用 Taro）
// const images = await klingImageExpandMiniProgram(
//   "https://example.com/image.png",
//   0.1495, 0.1495, 0.6547, 0.6547,
// );
// images.forEach(img => {
//   // 直接使用转存后的持久化 URL，无需额外处理
//   console.log(img.index, img.url);
// });
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端通过 `Deno.env.get` 读取，
   严禁暴露到前端或客户端代码中。

2. **Base64 格式**：使用 Base64 传图时，**不要添加 `data:image/...;base64,` 前缀**，
   直接传裸 Base64 字符串。错误示例：`data:image/png;base64,iVBORw0K...`，
   正确示例：`iVBORw0KGgoAAAANSUhEUgAAAAUA...`

3. **扩充面积限制**：四个方向的扩充后，新图总面积不得超过原图的 3 倍。
   计算公式可参考 plugin context 中的 Python 示例：
   ```python
   # 例：原图 100x100，目标面积 3 倍，宽高比 16:9
   # 计算结果：up=0.1495, down=0.1495, left=0.6547, right=0.6547
   ```

4. **图片 URL 有效期**：可灵生成的原始图片 URL **30 天后失效**，Edge Function 已自动将图片
   转存至 Supabase Storage（`generated-media` bucket），前端使用转存后的 `publicUrl` 即可长期访问。

5. **任务超时**：Edge Function 内部轮询最长等待 10 分钟，超时后返回错误。
   通常生成时间在 30 秒 ~ 3 分钟内，可根据实际情况调整 `TIMEOUT_MS`。

6. **错误处理**：务必处理以下状态码：
   - `429`：配额超限（已透传原始错误体）
   - `402`：余额不足（已透传原始错误体）
   - `500`：Edge Function 内部错误（含超时、转存失败等）

7. **计费**：原价 ¥12.00 / 折扣价 ¥8.00（`price_unit: 8`）。
   当前 `enable_billing: false`，实际计费以平台配置为准，避免不必要的重复提交。

8. **Supabase Storage Bucket**：Edge Function 使用 `generated-media` bucket，
   请确保该 bucket 已在 Supabase 控制台创建并设置为 Public 访问。
