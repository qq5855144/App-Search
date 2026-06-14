# 图生视频（音画同步）API 完整参考

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `b751ded3-f5b8-4866-b004-e0a293869f49` |
| Plugin 标题 | 图生视频（音画同步） |
| 认证模式 | `platform_managed`（traefik: true） |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |
| Auth Header | `X-Gateway-Authorization: Bearer <key>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-DY8MN3QBydBa-gateway.appmiaoda.com` |

---

## 接口一：图生视频 - 创建任务

| 字段 | 值 |
|------|-----|
| API ID | `api-DY8MN3QBydBa` |
| 方法 | POST |
| Endpoint | `https://app-cblk1rqa5fk1-api-DY8MN3QBydBa-gateway.appmiaoda.com/v1/videos/image2video` |
| 计费 | 启用（折扣价 235.00 元/千次，原价 377.30 元/千次） |

### 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model_name` | string | 可选 | `kling-v1` | 模型名称。枚举值：`kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1`, `kling-v2-1-master`, `kling-v2-5-turbo`, `kling-v2-6` |
| `image` | string | 必填（与 `image_tail` 二选一） | — | 参考图像（首帧）。支持 Base64 或图片 URL。格式：jpg/jpeg/png，≤10MB，≥300px，宽高比 1:2.5~2.5:1。Base64 不加 `data:image/...;base64,` 前缀 |
| `image_tail` | string | 可选 | — | 参考图像（尾帧控制）。格式要求同 `image`。`image` 与 `image_tail` 至少二选一；`image+image_tail` 与 `dynamic_masks/static_mask` 与 `camera_control` 三选一 |
| `prompt` | string | 可选 | — | 正向文本提示词，≤2500 字符。可用 `<<<voice_1>>>` 指定音色（序号同 `voice_list`）；指定音色时 `sound` 必须为 `on` |
| `negative_prompt` | string | 可选 | — | 负向文本提示词，≤2500 字符 |
| `voice_list` | array | 可选 | — | 音色列表，≤2 个，格式：`[{"voice_id": "voice_id_1"}]`。仅 v2.6+ 支持 |
| `sound` | string | 可选 | `off` | 是否生成声音。枚举值：`on` / `off`。仅 v2.6+ 支持 |
| `cfg_scale` | float | 可选 | `0.5` | 生成自由度，取值范围 [0, 1]，值越大与提示词相关性越强。kling-v2.x 不支持 |
| `mode` | string | 可选 | `std` | 生成模式。枚举值：`std`（标准）/ `pro`（高品质） |
| `duration` | string | 可选 | `5` | 视频时长（秒）。枚举值：`5` / `10` |
| `static_mask` | string | 可选 | — | 静态笔刷区域（mask 图片）。Base64 或 URL，格式同 `image`。长宽比须与 `image` 相同；与 `dynamic_masks.mask` 分辨率须一致 |
| `dynamic_masks` | array | 可选 | — | 动态笔刷配置列表，≤6 组，每组含 `mask`（string）和 `trajectories`（array） |
| `dynamic_masks[].mask` | string | 可选 | — | 动态笔刷区域图片，Base64 或 URL，格式同 `image` |
| `dynamic_masks[].trajectories` | array | 可选 | — | 运动轨迹坐标序列。5s 视频轨迹长度 [2, 77]。坐标原点为图片左下角 |
| `dynamic_masks[].trajectories[].x` | int | 可选 | — | 轨迹点横坐标（像素） |
| `dynamic_masks[].trajectories[].y` | int | 可选 | — | 轨迹点纵坐标（像素） |
| `camera_control` | object | 可选 | — | 摄像机运动控制 |
| `camera_control.type` | string | 可选 | — | 运镜类型。枚举值：`simple`（简单运镜，需填 `config`）/ `down_back`（下移拉远）/ `forward_up`（推进上移）/ `right_turn_forward`（右旋推进）/ `left_turn_forward`（左旋推进） |
| `camera_control.config` | object | 可选 | — | 简单运镜配置（`type=simple` 时必填，其他类型不填）。以下 6 字段选 1，其余为 0 |
| `camera_control.config.horizontal` | float | 可选 | — | 水平平移，[-10, 10]，负左正右 |
| `camera_control.config.vertical` | float | 可选 | — | 垂直平移，[-10, 10]，负下正上 |
| `camera_control.config.pan` | float | 可选 | — | 水平摇镜（绕 y 轴），[-10, 10]，负左正右 |
| `camera_control.config.tilt` | float | 可选 | — | 垂直摇镜（绕 x 轴），[-10, 10]，负下正上 |
| `camera_control.config.roll` | float | 可选 | — | 旋转运镜（绕 z 轴），[-10, 10]，负逆时针正顺时针 |
| `camera_control.config.zoom` | float | 可选 | — | 变焦，[-10, 10]，负拉远正推近 |
| `callback_url` | string | 可选 | — | 任务结果回调地址，任务状态变更时主动通知 |
| `external_task_id` | string | 可选 | — | 自定义任务 ID，单用户下须唯一 |

### 创建任务响应字段

**成功响应（code: 0）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 为成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID，用于排查问题 |
| `data.task_id` | string | 系统生成的任务 ID |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.task_status` | string | 任务状态，初始为 `submitted` |
| `data.created_at` | number | 任务创建时间（Unix 毫秒时间戳） |
| `data.updated_at` | number | 任务更新时间（Unix 毫秒时间戳） |

---

## 接口二：图生视频 - 查询任务（单个）

| 字段 | 值 |
|------|-----|
| API ID | `api-zYkZzgKook1L` |
| 方法 | GET |
| Endpoint | `https://app-cblk1rqa5fk1-api-zYkZzgKook1L-gateway.appmiaoda.com/v1/videos/image2video/{id}` |
| 计费 | 不启用 |

### 查询单个任务参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id`（路径参数） | string | 可选 | 系统生成的任务 ID，与 `external_task_id` 二选一，填入 URL 路径中 |
| `external_task_id`（查询参数） | string | 可选 | 用户自定义任务 ID，与 `task_id` 二选一 |

### 查询单个任务响应字段

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 为成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID |
| `data.task_id` | string | 任务 ID |
| `data.task_status` | string | 任务状态：`submitted`（已提交）/ `processing`（处理中）/ `succeed`（成功）/ `failed`（失败） |
| `data.task_status_msg` | string | 任务状态信息，失败时展示原因 |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.task_result.videos` | array | 生成的视频列表（succeed 时才有值） |
| `data.task_result.videos[].id` | string | 视频 ID，全局唯一 |
| `data.task_result.videos[].url` | string | 视频 URL（30 天后失效，需及时转存） |
| `data.task_result.videos[].duration` | string | 视频时长（秒） |
| `data.created_at` | number | 任务创建时间（Unix 毫秒时间戳） |
| `data.updated_at` | number | 任务更新时间（Unix 毫秒时间戳） |

---

## 接口三：图生视频 - 查询任务（列表）

| 字段 | 值 |
|------|-----|
| API ID | `api-n9QVoDJ6oykL` |
| 方法 | GET |
| Endpoint | `https://app-cblk1rqa5fk1-api-n9QVoDJ6oykL-gateway.appmiaoda.com/v1/videos/image2video` |
| 计费 | 不启用 |

### 查询任务列表参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `pageNum` | int | 可选 | `1` | 页码，取值范围 [1, 1000] |
| `pageSize` | int | 可选 | `30` | 每页数据量，取值范围 [1, 500] |

### 查询任务列表响应字段

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 为成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID |
| `data` | array | 任务数组 |
| `data[].task_id` | string | 任务 ID |
| `data[].task_status` | string | 任务状态 |
| `data[].task_status_msg` | string | 任务状态信息 |
| `data[].task_info.external_task_id` | string | 客户自定义任务 ID |
| `data[].task_result.videos[].id` | string | 视频 ID |
| `data[].task_result.videos[].url` | string | 视频 URL |
| `data[].task_result.videos[].duration` | string | 视频时长（秒） |
| `data[].created_at` | number | 创建时间（Unix 毫秒时间戳） |
| `data[].updated_at` | number | 更新时间（Unix 毫秒时间戳） |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/** 提交图生视频任务 */
async function submitImage2VideoTask(params: {
  image: string;
  prompt?: string;
  model_name?: string;
  image_tail?: string;
  negative_prompt?: string;
  voice_list?: Array<{ voice_id: string }>;
  sound?: "on" | "off";
  cfg_scale?: number;
  mode?: "std" | "pro";
  duration?: "5" | "10";
  static_mask?: string;
  dynamic_masks?: Array<{
    mask: string;
    trajectories: Array<{ x: number; y: number }>;
  }>;
  camera_control?: {
    type: "simple" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward";
    config?: {
      horizontal?: number;
      vertical?: number;
      pan?: number;
      tilt?: number;
      roll?: number;
      zoom?: number;
    };
  };
  callback_url?: string;
  external_task_id?: string;
}): Promise<{ task_id: string; task_status: string }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DY8MN3QBydBa-gateway.appmiaoda.com/v1/videos/image2video",
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

  return json.data;
}

/** 查询单个图生视频任务 */
async function queryImage2VideoTask(taskId: string): Promise<{
  task_id: string;
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_result?: { videos: Array<{ id: string; url: string; duration: string }> };
}> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-zYkZzgKook1L-gateway.appmiaoda.com/v1/videos/image2video/${taskId}`,
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

  return json.data;
}

/** 查询图生视频任务列表 */
async function listImage2VideoTasks(pageNum = 1, pageSize = 30): Promise<Array<{
  task_id: string;
  task_status: string;
  task_result?: { videos: Array<{ id: string; url: string; duration: string }> };
  created_at: number;
  updated_at: number;
}>> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-n9QVoDJ6oykL-gateway.appmiaoda.com/v1/videos/image2video` +
      `?pageNum=${pageNum}&pageSize=${pageSize}`,
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

  return json.data;
}

/** 完整异步工作流：提交 → 轮询 → 返回视频 URL */
async function generateImage2Video(params: {
  image: string;
  prompt?: string;
  model_name?: string;
  mode?: "std" | "pro";
  duration?: "5" | "10";
  [key: string]: unknown;
}): Promise<string> {
  const { task_id } = await submitImage2VideoTask(params);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryImage2VideoTask(task_id);
    if (result.task_status === "succeed") {
      return result.task_result!.videos[0].url;
    }
    if (result.task_status === "failed") {
      throw new Error(`Task failed: ${result.task_status_msg ?? "unknown"}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error(`Task ${task_id} timed out after 10 minutes`);
}

// 使用示例
const videoUrl = await generateImage2Video({
  image: "https://example.com/image.jpg",
  prompt: "宇航员站起身走了",
  model_name: "kling-v2-6",
  mode: "pro",
  duration: "5",
  cfg_scale: 0.5,
});
console.log("生成的视频 URL:", videoUrl);
```

---

## Edge Function 代码（应用内调用 — Web + MiniProgram 通用）

### Edge Function 1：kling-image2video-submit.ts（提交创建任务）

```typescript
// edge-functions/kling-image2video-submit.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let image: string;
  let prompt: string | undefined;
  let model_name: string | undefined;
  let image_tail: string | undefined;
  let negative_prompt: string | undefined;
  let voice_list: Array<{ voice_id: string }> | undefined;
  let sound: "on" | "off" | undefined;
  let cfg_scale: number | undefined;
  let mode: "std" | "pro" | undefined;
  let duration: "5" | "10" | undefined;
  let static_mask: string | undefined;
  let dynamic_masks: unknown | undefined;
  let camera_control: unknown | undefined;
  let callback_url: string | undefined;
  let external_task_id: string | undefined;

  try {
    const body = await req.json();
    image = body.image;
    if (!image) throw new Error("Missing required field: image");
    prompt = body.prompt;
    model_name = body.model_name;
    image_tail = body.image_tail;
    negative_prompt = body.negative_prompt;
    voice_list = body.voice_list;
    sound = body.sound;
    cfg_scale = body.cfg_scale;
    mode = body.mode;
    duration = body.duration;
    static_mask = body.static_mask;
    dynamic_masks = body.dynamic_masks;
    camera_control = body.camera_control;
    callback_url = body.callback_url;
    external_task_id = body.external_task_id;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（严禁暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构建请求体（仅包含非 undefined 字段） ---
  const requestBody: Record<string, unknown> = { image };
  if (model_name !== undefined) requestBody.model_name = model_name;
  if (image_tail !== undefined) requestBody.image_tail = image_tail;
  if (prompt !== undefined) requestBody.prompt = prompt;
  if (negative_prompt !== undefined) requestBody.negative_prompt = negative_prompt;
  if (voice_list !== undefined) requestBody.voice_list = voice_list;
  if (sound !== undefined) requestBody.sound = sound;
  if (cfg_scale !== undefined) requestBody.cfg_scale = cfg_scale;
  if (mode !== undefined) requestBody.mode = mode;
  if (duration !== undefined) requestBody.duration = duration;
  if (static_mask !== undefined) requestBody.static_mask = static_mask;
  if (dynamic_masks !== undefined) requestBody.dynamic_masks = dynamic_masks;
  if (camera_control !== undefined) requestBody.camera_control = camera_control;
  if (callback_url !== undefined) requestBody.callback_url = callback_url;
  if (external_task_id !== undefined) requestBody.external_task_id = external_task_id;

  // --- 调用上游创建任务接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DY8MN3QBydBa-gateway.appmiaoda.com/v1/videos/image2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
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

### Edge Function 2：kling-image2video-query.ts（查询任务 + 视频转存）

```typescript
// edge-functions/kling-image2video-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远端媒体 URL 转存到 Supabase Storage，防止第三方 URL 过期（30 天失效）。
 *
 * @param mediaUrl - 待转存的视频/图片 URL
 * @param bucketName - Supabase Storage 桶名
 * @param upsert - 是否覆盖同名文件
 * @returns 成功返回 publicUrl；失败返回错误信息
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

  // --- 解析客户端请求 ---
  let task_id: string;
  let transfer_video: boolean = true; // 是否将视频 URL 转存到 Storage

  try {
    const body = await req.json();
    task_id = body.task_id;
    if (!task_id) throw new Error("Missing required field: task_id");
    if (body.transfer_video !== undefined) transfer_video = body.transfer_video;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 查询任务 ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-zYkZzgKook1L-gateway.appmiaoda.com/v1/videos/image2video/${task_id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
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

  const result = await upstream.json();

  // --- 若任务成功且需要转存视频，将视频 URL 转存到 Supabase Storage ---
  if (
    result.code === 0 &&
    result.data?.task_status === "succeed" &&
    transfer_video &&
    result.data?.task_result?.videos?.length > 0
  ) {
    const videos = result.data.task_result.videos as Array<{
      id: string;
      url: string;
      duration: string;
    }>;

    const transferredVideos = await Promise.all(
      videos.map(async (video) => {
        const transfer = await streamMediaToStorage(video.url, "generated-media");
        if (transfer.success) {
          return { ...video, url: transfer.publicUrl, original_url: video.url };
        }
        // 转存失败时保留原 URL，并附加警告
        return { ...video, storage_transfer_error: transfer.error };
      })
    );

    result.data.task_result.videos = transferredVideos;
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（React/TypeScript）

```typescript
import { supabase } from "@/lib/supabase";

interface SubmitParams {
  image: string;
  prompt?: string;
  model_name?: string;
  mode?: "std" | "pro";
  duration?: "5" | "10";
  image_tail?: string;
  cfg_scale?: number;
  // 其他可选参数按需传入
}

interface VideoResult {
  id: string;
  url: string;
  duration: string;
  original_url?: string;
}

/**
 * 提交图生视频任务。
 *
 * @param params - 创建任务参数
 * @returns 任务 ID
 */
async function submitKlingImage2VideoTask(params: SubmitParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("kling-image2video-submit", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}

/**
 * 查询图生视频任务状态。
 *
 * @param taskId - 任务 ID
 * @param transferVideo - 是否自动将视频 URL 转存至 Supabase Storage，默认 true
 * @returns 任务详情
 */
async function queryKlingImage2VideoTask(
  taskId: string,
  transferVideo = true
): Promise<{
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_result?: { videos: VideoResult[] };
}> {
  const { data, error } = await supabase.functions.invoke("kling-image2video-query", {
    body: { task_id: taskId, transfer_video: transferVideo },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data;
}

/**
 * 完整工作流：提交任务，轮询直到完成，返回转存后的视频 URL。
 *
 * @param params - 创建任务参数
 * @returns 视频 URL（Supabase Storage publicUrl）
 */
async function generateKlingVideo(params: SubmitParams): Promise<VideoResult[]> {
  const taskId = await submitKlingImage2VideoTask(params);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryKlingImage2VideoTask(taskId);
    if (result.task_status === "succeed") {
      return result.task_result!.videos;
    }
    if (result.task_status === "failed") {
      throw new Error(`视频生成失败：${result.task_status_msg ?? "未知错误"}`);
    }
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}

// 使用示例（React 组件中）
const handleGenerate = async () => {
  try {
    const videos = await generateKlingVideo({
      image: "https://example.com/image.jpg",
      prompt: "宇航员站起身走了",
      model_name: "kling-v2-6",
      mode: "pro",
      duration: "5",
    });
    console.log("视频 URL:", videos[0].url); // Supabase Storage publicUrl
  } catch (err) {
    console.error("生成失败:", err);
  }
};
```

### MiniProgram 平台（Taro/TypeScript）

```typescript
import Taro from "@tarojs/taro";
import { supabase } from "@/lib/supabase";

interface SubmitParams {
  image: string;
  prompt?: string;
  model_name?: string;
  mode?: "std" | "pro";
  duration?: "5" | "10";
  // 其他可选参数按需传入
}

/**
 * 提交图生视频任务（MiniProgram）。
 *
 * @param params - 创建任务参数
 * @returns 任务 ID
 */
async function submitKlingImage2VideoTask(params: SubmitParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("kling-image2video-submit", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}

/**
 * 查询图生视频任务状态（MiniProgram）。
 *
 * @param taskId - 任务 ID
 * @returns 任务详情
 */
async function queryKlingImage2VideoTask(taskId: string) {
  const { data, error } = await supabase.functions.invoke("kling-image2video-query", {
    body: { task_id: taskId, transfer_video: true },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data;
}

/**
 * 完整工作流：提交 → 轮询 → 返回视频 URL。
 *
 * @param params - 创建任务参数
 * @returns 视频 URL（Supabase Storage publicUrl）
 */
async function generateKlingVideo(params: SubmitParams): Promise<string> {
  const taskId = await submitKlingImage2VideoTask(params);
  Taro.showLoading({ title: "视频生成中..." });

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  try {
    while (Date.now() < deadline) {
      await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_MS));
      const result = await queryKlingImage2VideoTask(taskId);
      if (result.task_status === "succeed") {
        Taro.hideLoading();
        return result.task_result.videos[0].url;
      }
      if (result.task_status === "failed") {
        throw new Error(`视频生成失败：${result.task_status_msg ?? "未知错误"}`);
      }
    }
    throw new Error(`任务 ${taskId} 超时（10 分钟）`);
  } finally {
    Taro.hideLoading();
  }
}

// 使用示例（Taro 组件中）
const handleGenerate = async () => {
  try {
    const videoUrl = await generateKlingVideo({
      image: "https://example.com/image.jpg",
      prompt: "宇航员站起身走了",
      model_name: "kling-v2-6",
      mode: "pro",
      duration: "5",
    });

    // 播放视频
    const videoContext = Taro.createVideoContext("myVideo");
    videoContext.play();
    // 或者在 state 中保存 videoUrl，绑定到 <Video src={videoUrl} /> 组件
  } catch (err) {
    Taro.showToast({ title: (err as Error).message, icon: "none" });
  }
};
```

---

## 注意事项

### 密钥安全
`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。

### 视频 URL 有效期
Kling AI 生成的视频 URL **30 天后失效**，必须及时通过 Appendix A（Supabase Storage 转存）将视频持久化，避免用户无法访问已生成的视频。Edge Function `kling-image2video-query` 已内置自动转存逻辑（`transfer_video: true`）。

### 计费
- **创建任务接口**（`api-DY8MN3QBydBa`）：按调用次数计费，折扣价 **235.00 元/千次**，原价 377.30 元/千次
- **查询接口**（单个 + 列表）：不计费
- 建议轮询间隔 ≥ 7 秒，避免无意义的高频查询，并做好超时机制（推荐 10 分钟）

### 错误处理
- 务必处理 `429`（配额超限）和 `402`（余额不足）
- 任务 `failed` 时，`task_status_msg` 通常包含失败原因（如内容风控）
- 提交任务前检查 `image` 参数：文件 ≤10MB，尺寸 ≥300px，宽高比 1:2.5~2.5:1

### 参数互斥
以下三组参数三选一，不可同时使用：
1. `image + image_tail`（首尾帧控制）
2. `dynamic_masks` / `static_mask`（运动笔刷）
3. `camera_control`（摄像机控制）

### 音画同步（v2.6+）
- `voice_list` 和 `sound: "on"` 仅 kling-v2.6 及后续版本支持
- 在 `prompt` 中用 `<<<voice_1>>>` 引用音色时，`sound` 必须设为 `on`
- `cfg_scale` 参数在 kling-v2.x 系列模型中不支持
