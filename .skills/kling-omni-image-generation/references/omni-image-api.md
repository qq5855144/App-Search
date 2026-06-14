# Kling Omni Image Generation API 参考文档

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `1655cdb9-9a90-426f-a396-a60356441332` |
| Plugin 标题 | 图片生成与编辑 (可灵) |
| 认证模式 | `platform_managed`（traefik: true） |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-DLEO4zbkvoea-gateway.appmiaoda.com` |

---

## 接口一：创建图像生成任务

| 字段 | 值 |
|------|-----|
| API ID | `api-DLEO4zbkvoea` |
| 方法 | POST |
| Endpoint | `https://app-cblk1rqa5fk1-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/images/omni-image` |

### 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model_name` | string | 否 | `kling-image-o1` | 模型名称；枚举：`kling-image-o1`、`kling-v3-omni` |
| `prompt` | string | 是 | — | 文本提示词，支持正向和负向描述，不超过 2500 字符；用 `<<<image_1>>>` 格式引用图片 |
| `image_list` | array | 否 | — | 参考图列表；格式：`[{"image": "base64 or URL"}]`；支持 jpg/jpeg/png；大小 ≤10MB；宽高 ≥300px；宽高比 1:2.5~2.5:1 |
| `image_list[].image` | string | 是（有 image_list 时）| — | 图片 URL 或 Base64 字符串（纯编码，不含 `data:` 前缀） |
| `element_list` | array | 否 | — | 主体参考列表；格式：`[{"element_id": long}]` |
| `element_list[].element_id` | long | 是（有 element_list 时）| — | 主体库中主体的 ID |
| `resolution` | string | 否 | `1k` | 清晰度；枚举：`1k`、`2k`、`4k` |
| `result_type` | string | 否 | `single` | 生成结果类型；枚举：`single`（单图）、`series`（组图） |
| `n` | int | 否 | `1` | 生成图片数量；范围 [1, 9]；`result_type=series` 时无效 |
| `series_amount` | int | 否 | — | 组图数量；范围 [2, 9]；**仅 `result_type=series` 时必须提供，`single` 时不得出现** |
| `aspect_ratio` | string | 否 | `auto` | 画面纵横比；枚举：`16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`3:2`、`2:3`、`21:9`、`auto`（智能生成宽高比） |
| `watermark_info` | object | 否 | — | 水印配置；格式：`{"enabled": boolean}` |
| `callback_url` | string | 否 | — | 任务结果回调通知地址 |
| `external_task_id` | string | 否 | — | 自定义任务 ID（单用户下需唯一，不覆盖系统 task_id） |

> **约束（必须遵守）：**
> - `result_type = single`：**不得传 `series_amount`**（字段不得出现）
> - `result_type = series`：**必须传 `series_amount`，取值 [2, 9]**

### 成功响应

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "task_status": "string",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

### 响应字段说明（创建任务）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码；0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID，用于跟踪和排查 |
| `data.task_id` | string | 系统生成的任务 ID（用于查询） |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.task_status` | string | 任务状态：`submitted`/`processing`/`succeed`/`failed` |
| `data.created_at` | number | 任务创建时间（Unix 毫秒时间戳） |
| `data.updated_at` | number | 任务更新时间（Unix 毫秒时间戳） |

---

## 接口二：查询单个图像生成任务

| 字段 | 值 |
|------|-----|
| API ID | `api-79jK6nw4zxDL` |
| 方法 | GET |
| Endpoint | `https://app-cblk1rqa5fk1-api-79jK6nw4zxDL-gateway.appmiaoda.com/v1/images/omni-image/{id}` |

### 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id`（路径参数）| string | 是（与 external_task_id 二选一）| 图片生成的任务 ID，直接填入路径 |
| `external_task_id`（查询参数）| string | 否（与 task_id 二选一）| 用户自定义任务 ID |

### 成功响应

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "string",
    "task_status_msg": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "task_result": {
      "result_type": "single",
      "images": [
        {
          "index": 0,
          "url": "string",
          "watermark_url": "string"
        }
      ],
      "series_images": [
        {
          "index": 0,
          "url": "string",
          "watermark_url": "string"
        }
      ]
    },
    "watermark_info": { "enabled": false },
    "final_unit_deduction": "string",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

### 响应字段说明（查询任务）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码；0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID |
| `data.task_id` | string | 任务 ID |
| `data.task_status` | string | 任务状态：`submitted`（已提交）、`processing`（处理中）、`succeed`（成功）、`failed`（失败） |
| `data.task_status_msg` | string? | 任务状态信息，失败时展示失败原因（如内容风控等） |
| `data.task_info.external_task_id` | string? | 自定义任务 ID |
| `data.task_result.result_type` | string | 结果类型：`single` 或 `series` |
| `data.task_result.images[]` | array | 单图模式结果列表 |
| `data.task_result.images[].index` | number | 图片编号 |
| `data.task_result.images[].url` | string | 生成图片 URL（30 天后清理，请及时转存） |
| `data.task_result.images[].watermark_url` | string? | 含水印图片 URL |
| `data.task_result.series_images[]` | array | 组图模式结果列表 |
| `data.task_result.series_images[].index` | number | 组图序号 |
| `data.task_result.series_images[].url` | string | 组图图片 URL（30 天后清理，请及时转存） |
| `data.task_result.series_images[].watermark_url` | string? | 含水印图片 URL |
| `data.watermark_info.enabled` | boolean | 是否含水印 |
| `data.final_unit_deduction` | string? | 任务最终扣减积分数值 |
| `data.created_at` | number | 任务创建时间（Unix 毫秒时间戳） |
| `data.updated_at` | number | 任务更新时间（Unix 毫秒时间戳） |

---

## 生成期代码（Agent 直接调用）

```typescript
// 生成期代码：直接在 Deno 脚本中运行，平台注入密钥
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface SubmitTaskParams {
  prompt: string;                       // 必填：文本提示词
  model_name?: "kling-image-o1" | "kling-v3-omni"; // 可选，默认 kling-image-o1
  image_list?: Array<{ image: string }>; // 可选：参考图列表
  element_list?: Array<{ element_id: number }>; // 可选：主体参考列表
  resolution?: "1k" | "2k";            // 可选，默认 1k
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9" | "auto";
  // result_type = single 时：不传 series_amount
  result_type?: "single";
  n?: number;                           // 可选，生成数量 [1, 9]，默认 1
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

interface SubmitSeriesTaskParams {
  prompt: string;
  model_name?: "kling-image-o1" | "kling-v3-omni";
  image_list?: Array<{ image: string }>;
  element_list?: Array<{ element_id: number }>;
  resolution?: "1k" | "2k";
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9" | "auto";
  // result_type = series 时：必须传 series_amount
  result_type: "series";
  series_amount: number;                // 必填（系列模式），范围 [2, 9]
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

/**
 * 提交图像生成任务（单图模式）
 * @param params - 任务参数，result_type=single 时不得包含 series_amount
 * @returns 包含 task_id 的对象
 */
async function submitOmniImageTask(
  params: SubmitTaskParams | SubmitSeriesTaskParams
): Promise<{ taskId: string }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/images/omni-image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return { taskId: json.data.task_id };
}

interface ImageItem {
  index: number;
  url: string;
  watermark_url?: string;
}

interface QueryTaskResult {
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_result?: {
    result_type: "single" | "series";
    images: ImageItem[];
    series_images: ImageItem[];
  };
}

/**
 * 查询单个图像生成任务
 * @param taskId - 系统生成的任务 ID
 * @returns 任务状态和结果
 */
async function queryOmniImageTask(taskId: string): Promise<QueryTaskResult> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-79jK6nw4zxDL-gateway.appmiaoda.com/v1/images/omni-image/${taskId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data as QueryTaskResult;
}

/**
 * 完整异步工作流：提交任务 → 轮询直到成功或超时
 * @param params - 图像生成任务参数
 * @returns 生成图片的 URL 列表（单图取 images，组图取 series_images）
 */
async function generateAndWait(
  params: SubmitTaskParams | SubmitSeriesTaskParams
): Promise<string[]> {
  const { taskId } = await submitOmniImageTask(params);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;  // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryOmniImageTask(taskId);

    if (result.task_status === "succeed") {
      const taskResult = result.task_result!;
      const items = taskResult.result_type === "series"
        ? taskResult.series_images
        : taskResult.images;
      return items.map(img => img.url);
    }

    if (result.task_status === "failed") {
      throw new Error(`Task failed: ${result.task_status_msg ?? "unknown reason"}`);
    }
    // submitted / processing → 继续轮询
  }

  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}

// 使用示例
const urls = await generateAndWait({
  prompt: "一只在雪地里奔跑的金毛犬，阳光照射，摄影风格",
  model_name: "kling-image-o1",
  resolution: "2k",
  aspect_ratio: "3:2",
  n: 1,
});
console.log("生成的图片 URL：", urls);
```

---

## Edge Function 代码

### Edge Function 1：提交任务（`kling-omni-image-submit`）

```typescript
// edge-functions/kling-omni-image-submit.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let prompt: string;
  let model_name: string | undefined;
  let image_list: Array<{ image: string }> | undefined;
  let element_list: Array<{ element_id: number }> | undefined;
  let resolution: string | undefined;
  let result_type: string | undefined;
  let n: number | undefined;
  let series_amount: number | undefined;
  let aspect_ratio: string | undefined;
  let watermark_info: { enabled: boolean } | undefined;
  let callback_url: string | undefined;
  let external_task_id: string | undefined;

  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");

    model_name = body.model_name;
    image_list = body.image_list;
    element_list = body.element_list;
    resolution = body.resolution;
    result_type = body.result_type;
    n = body.n;
    series_amount = body.series_amount;
    aspect_ratio = body.aspect_ratio;
    watermark_info = body.watermark_info;
    callback_url = body.callback_url;
    external_task_id = body.external_task_id;

    // 校验 result_type 与 series_amount 的依赖关系
    if (result_type === "series" && (series_amount === undefined || series_amount === null)) {
      throw new Error("series_amount is required when result_type=series");
    }
    if (result_type === "single" && series_amount !== undefined) {
      throw new Error("series_amount must not be provided when result_type=single");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（不暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构造请求体（result_type=single 时不传 series_amount）---
  const requestBody: Record<string, unknown> = { prompt };
  if (model_name !== undefined) requestBody.model_name = model_name;
  if (image_list !== undefined) requestBody.image_list = image_list;
  if (element_list !== undefined) requestBody.element_list = element_list;
  if (resolution !== undefined) requestBody.resolution = resolution;
  if (result_type !== undefined) requestBody.result_type = result_type;
  if (n !== undefined) requestBody.n = n;
  if (result_type === "series" && series_amount !== undefined) {
    requestBody.series_amount = series_amount;
  }
  if (aspect_ratio !== undefined) requestBody.aspect_ratio = aspect_ratio;
  if (watermark_info !== undefined) requestBody.watermark_info = watermark_info;
  if (callback_url !== undefined) requestBody.callback_url = callback_url;
  if (external_task_id !== undefined) requestBody.external_task_id = external_task_id;

  // --- 调用上游创建任务接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/images/omni-image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  // 转发配额/余额错误
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

### Edge Function 2：查询任务并转存图片（`kling-omni-image-query`）

```typescript
// edge-functions/kling-omni-image-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远程图片流式传输到 Supabase Storage，返回公开访问 URL。
 * @param mediaUrl - 第三方图片 URL
 * @param bucketName - 目标 bucket 名称
 * @returns 成功时含 publicUrl，失败时含 error
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
    new URL(mediaUrl); // 校验格式

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

    if (!isAllowed) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

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

  // --- 解析客户端请求 ---
  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
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

  // --- 调用上游查询接口 ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-79jK6nw4zxDL-gateway.appmiaoda.com/v1/images/omni-image/${taskId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // 转发配额/余额错误
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

  const responseData = await upstream.json();
  const taskData = responseData.data;

  // --- 仅在任务成功时转存图片 URL ---
  if (taskData?.task_status === "succeed" && taskData?.task_result) {
    const taskResult = taskData.task_result;
    const BUCKET = "generated-media";

    // 转存 images（单图模式）
    if (taskResult.images && taskResult.images.length > 0) {
      const transferredImages = await Promise.all(
        taskResult.images.map(async (img: { index: number; url: string; watermark_url?: string }) => {
          const transfer = await streamMediaToStorage(img.url, BUCKET);
          return {
            ...img,
            url: transfer.success ? transfer.publicUrl : img.url,
          };
        })
      );
      taskResult.images = transferredImages;
    }

    // 转存 series_images（组图模式）
    if (taskResult.series_images && taskResult.series_images.length > 0) {
      const transferredSeriesImages = await Promise.all(
        taskResult.series_images.map(
          async (img: { index: number; url: string; watermark_url?: string }) => {
            const transfer = await streamMediaToStorage(img.url, BUCKET);
            return {
              ...img,
              url: transfer.success ? transfer.publicUrl : img.url,
            };
          }
        )
      );
      taskResult.series_images = transferredSeriesImages;
    }
  }

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（React / Next.js）

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface SubmitParams {
  prompt: string;
  model_name?: "kling-image-o1" | "kling-v3-omni";
  image_list?: Array<{ image: string }>;
  element_list?: Array<{ element_id: number }>;
  resolution?: "1k" | "2k";
  aspect_ratio?: string;
  // 单图模式：传 result_type="single" 和 n，不传 series_amount
  result_type?: "single";
  n?: number;
}

interface SubmitSeriesParams {
  prompt: string;
  model_name?: "kling-image-o1" | "kling-v3-omni";
  image_list?: Array<{ image: string }>;
  element_list?: Array<{ element_id: number }>;
  resolution?: "1k" | "2k";
  aspect_ratio?: string;
  // 组图模式：result_type="series" 和 series_amount 必须同时提供
  result_type: "series";
  series_amount: number;
}

/**
 * 提交图像生成任务
 * @param params - 生成参数
 * @returns task_id 字符串
 */
async function submitImageTask(params: SubmitParams | SubmitSeriesParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("kling-omni-image-submit", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}

/**
 * 查询图像生成任务（并自动转存成功后的图片至 Supabase Storage）
 * @param taskId - 任务 ID
 * @returns 任务数据
 */
async function queryImageTask(taskId: string): Promise<{
  task_status: string;
  task_status_msg?: string;
  task_result?: {
    result_type: string;
    images: Array<{ index: number; url: string }>;
    series_images: Array<{ index: number; url: string }>;
  };
}> {
  const { data, error } = await supabase.functions.invoke("kling-omni-image-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data;
}

/**
 * 完整工作流：提交图像生成任务并轮询直到完成
 * @param params - 生成参数
 * @returns 生成图片的 publicUrl 列表
 */
async function generateImage(params: SubmitParams | SubmitSeriesParams): Promise<string[]> {
  const taskId = await submitImageTask(params);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;  // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryImageTask(taskId);

    if (result.task_status === "succeed") {
      const taskResult = result.task_result!;
      const items = taskResult.result_type === "series"
        ? taskResult.series_images
        : taskResult.images;
      return items.map(img => img.url);
    }

    if (result.task_status === "failed") {
      throw new Error(`任务失败：${result.task_status_msg ?? "未知原因"}`);
    }
    // submitted / processing → 继续轮询
  }

  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}

// 使用示例
const imageUrls = await generateImage({
  prompt: "一只在雪地里奔跑的金毛犬，阳光照射，摄影风格",
  resolution: "2k",
  aspect_ratio: "3:2",
  n: 1,
});

// 渲染图片
imageUrls.forEach(url => {
  const img = document.createElement("img");
  img.src = url;
  document.body.appendChild(img);
});
```

### MiniProgram 平台（Taro + React）

```typescript
import { createClient } from "@supabase/supabase-js";
import Taro from "@tarojs/taro";
import { useState } from "react";
import { View, Image, Button, Text } from "@tarojs/components";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!
);

interface GenerateState {
  loading: boolean;
  imageUrls: string[];
  error: string | null;
  status: string;
}

function KlingImageGenerator() {
  const [state, setState] = useState<GenerateState>({
    loading: false,
    imageUrls: [],
    error: null,
    status: "",
  });

  /**
   * 提交图像生成任务并轮询结果
   */
  const handleGenerate = async () => {
    setState({ loading: true, imageUrls: [], error: null, status: "提交任务中..." });

    try {
      // Step 1: 提交任务
      const { data: submitData, error: submitError } = await supabase.functions.invoke(
        "kling-omni-image-submit",
        {
          body: {
            prompt: "一只在雪地里奔跑的金毛犬，阳光照射，摄影风格",
            resolution: "2k",
            aspect_ratio: "3:2",
            n: 1,
          },
        }
      );
      if (submitError) throw submitError;
      if (submitData.code !== 0) throw new Error(`提交失败：${submitData.message}`);

      const taskId = submitData.data.task_id;
      setState(prev => ({ ...prev, status: `任务已提交（${taskId}），轮询中...` }));

      // Step 2: 轮询直到成功或超时
      const POLL_INTERVAL_MS = 7000;
      const TIMEOUT_MS = 10 * 60 * 1000;
      const deadline = Date.now() + TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

        const { data: queryData, error: queryError } = await supabase.functions.invoke(
          "kling-omni-image-query",
          { body: { task_id: taskId } }
        );
        if (queryError) throw queryError;
        if (queryData.code !== 0) throw new Error(`查询失败：${queryData.message}`);

        const taskData = queryData.data;

        if (taskData.task_status === "succeed") {
          const taskResult = taskData.task_result;
          const items = taskResult.result_type === "series"
            ? taskResult.series_images
            : taskResult.images;
          const urls = items.map((img: { url: string }) => img.url);
          setState({ loading: false, imageUrls: urls, error: null, status: "生成成功" });
          return;
        }

        if (taskData.task_status === "failed") {
          throw new Error(`任务失败：${taskData.task_status_msg ?? "未知原因"}`);
        }

        setState(prev => ({ ...prev, status: `处理中（${taskData.task_status}）...` }));
      }

      throw new Error("任务超时（10 分钟）");
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: (err as Error).message,
        status: "生成失败",
      }));
      Taro.showToast({ title: (err as Error).message, icon: "none" });
    }
  };

  return (
    <View>
      <Button onClick={handleGenerate} disabled={state.loading}>
        {state.loading ? "生成中..." : "生成图片"}
      </Button>
      <Text>{state.status}</Text>
      {state.error && <Text style={{ color: "red" }}>{state.error}</Text>}
      {state.imageUrls.map((url, idx) => (
        <Image key={idx} src={url} mode="widthFix" style={{ width: "100%" }} />
      ))}
    </View>
  );
}

export default KlingImageGenerator;
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露给前端或写入客户端代码。

2. **result_type 与 series_amount 的强依赖关系**：
   - `result_type = single` 时：请求体中**不得出现** `series_amount` 字段
   - `result_type = series` 时：**必须提供** `series_amount`，取值范围 [2, 9]
   - 违反上述规则，请求将被判定为无效

3. **image_list 格式**：必须为对象数组 `[{"image": "..."}]`，禁止直接传字符串数组；Base64 编码不得含 `data:image/jpeg;base64,` 等 data URI 前缀。

4. **图片有效期**：生成的图片 URL 30 天后自动清理，Edge Function 已通过 Supabase Storage 转存，请确保 bucket `generated-media` 已创建且权限配置正确。

5. **错误处理**：务必处理 429（配额超限）和 402（余额不足），两种错误会从上游直接转发给客户端。

6. **计费**：折扣价 8.00，原价 12.00，单位：元/单次。轮询查询接口不计费，请避免不必要的重复提交。

7. **轮询建议**：建议轮询间隔 7 秒，超时时间 10 分钟；任务通常在 30 秒到 3 分钟内完成。

---

## 接口三：创建图像生成任务（图像编辑入口）

| 字段 | 值 |
|------|-----|
| API ID | `api-eLMlPzV7qWJ9` |
| 方法 | POST |
| Endpoint | `https://app-cblk1rqa5fk1-api-eLMlPzV7qWJ9-gateway.appmiaoda.com/v1/images/omni-image` |

该接口与"接口一"共享相同的上游端点 `/v1/images/omni-image`，但使用不同的网关 API ID 进行路由。
适用于以图像编辑为主要场景（如参考图融合、主体替换）的调用入口，参数规格与接口一完全一致。

### 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model_name` | string | 否 | `kling-image-o1` | 模型名称；枚举：`kling-image-o1`、`kling-v3-omni` |
| `prompt` | string | 是 | — | 文本提示词，支持正向和负向描述，不超过 2500 字符；用 `<<<image_1>>>` 格式引用图片 |
| `image_list` | array | 否 | — | 参考图列表；格式：`[{"image": "base64 or URL"}]`；支持 jpg/jpeg/png；大小 ≤10MB；宽高 ≥300px；宽高比 1:2.5~2.5:1 |
| `image_list[].image` | string | 是（有 image_list 时）| — | 图片 URL 或 Base64 字符串（纯编码，不含 `data:` 前缀） |
| `element_list` | array | 否 | — | 主体参考列表；格式：`[{"element_id": long}]` |
| `element_list[].element_id` | long | 是（有 element_list 时）| — | 主体库中主体的 ID |
| `resolution` | string | 否 | `1k` | 清晰度；枚举：`1k`、`2k`、`4k` |
| `result_type` | string | 否 | `single` | 生成结果类型；枚举：`single`（单图）、`series`（组图） |
| `n` | int | 否 | `1` | 生成图片数量；范围 [1, 9]；`result_type=series` 时无效 |
| `series_amount` | int | 否 | — | 组图数量；范围 [2, 9]；**仅 `result_type=series` 时必须提供，`single` 时不得出现** |
| `aspect_ratio` | string | 否 | `auto` | 画面纵横比；枚举：`16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`3:2`、`2:3`、`21:9`、`auto`（智能生成宽高比） |
| `watermark_info` | object | 否 | — | 水印配置；格式：`{"enabled": boolean}` |
| `callback_url` | string | 否 | — | 任务结果回调通知地址 |
| `external_task_id` | string | 否 | — | 自定义任务 ID（单用户下需唯一，不覆盖系统 task_id） |

> **约束（必须遵守）：**
> - `result_type = single`：**不得传 `series_amount`**（字段不得出现）
> - `result_type = series`：**必须传 `series_amount`，取值 [2, 9]**
> - `image_list` 必须为对象数组 `[{"image": "..."}]`，禁止直接传字符串数组
> - Base64 编码不得含 `data:image/jpeg;base64,` 等 data URI 前缀

### 成功响应

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "task_status": "string",
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

### 响应字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码；0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID，用于跟踪和排查 |
| `data.task_id` | string | 系统生成的任务 ID（用于查询） |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.task_status` | string | 任务状态：`submitted`/`processing`/`succeed`/`failed` |
| `data.created_at` | number | 任务创建时间（Unix 毫秒时间戳） |
| `data.updated_at` | number | 任务更新时间（Unix 毫秒时间戳） |

> 任务创建后，使用接口二（`api-79jK6nw4zxDL`）查询结果，响应结构完全一致。

### 代码示例

```typescript
/**
 * 通过图像编辑入口（api-eLMlPzV7qWJ9）创建图像生成任务。
 * 参数规格与 submitOmniImageTask 完全一致，适用于参考图融合、主体替换等图像编辑场景。
 *
 * @param params - 任务参数，参考接口一 SubmitTaskParams / SubmitSeriesTaskParams
 * @returns 包含 task_id 的对象
 */
async function submitOmniImageEditTask(
  params: SubmitTaskParams | SubmitSeriesTaskParams
): Promise<{ taskId: string }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-eLMlPzV7qWJ9-gateway.appmiaoda.com/v1/images/omni-image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return { taskId: json.data.task_id };
}

// 典型图像编辑调用示例：将多张参考图中的人物融合到指定图片中
const { taskId } = await submitOmniImageEditTask({
  prompt: "将所有图片中的人物融合到<<<image_1>>>图中",
  model_name: "kling-image-o1",
  image_list: [
    { image: "https://example.com/target.png" },
    { image: "https://example.com/person1.jpg" },
  ],
  resolution: "2k",
  aspect_ratio: "3:2",
  n: 1,
});

// 查询结果复用接口二的 queryOmniImageTask
const result = await queryOmniImageTask(taskId);
console.log("任务状态：", result.task_status);
```
