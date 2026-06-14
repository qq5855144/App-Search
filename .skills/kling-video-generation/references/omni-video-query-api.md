# Omni-Video 查询任务（单个）API

## API 基本信息

| 属性 | 值 |
|------|----|
| Plugin ID | `339870a2-4a8b-4633-a8c5-fed34600f5bf` |
| API ID | `api-o9wN0pyVE2ea` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/{id}` |
| Auth 模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com` |

---

## 请求参数表

### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id`（路径） | string | 条件必填 | 视频生成的任务 ID，与 `external_task_id` 二选一；填写在请求路径中 |

### 查询参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `external_task_id` | string | 条件必填 | 视频生成的自定义任务 ID，与 `task_id` 二选一 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码；0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID，系统生成，用于跟踪请求 |
| `data.task_id` | string | 任务 ID，系统生成 |
| `data.task_status` | string | 任务状态：`submitted`（已提交）、`processing`（处理中）、`succeed`（成功）、`failed`（失败） |
| `data.task_status_msg` | string | 任务状态信息；任务失败时展示失败原因（如触发内容风控等） |
| `data.watermark_info.enabled` | boolean | 是否生成含水印版本 |
| `data.task_result.videos` | array | 生成的视频列表（任务成功后才有值） |
| `data.task_result.videos[].id` | string | 生成视频 ID，全局唯一 |
| `data.task_result.videos[].url` | string | 生成视频 URL（防盗链，30 天后清理，须及时转存） |
| `data.task_result.videos[].watermark_url` | string | 含水印视频 URL（防盗链，30 天后清理，须及时转存） |
| `data.task_result.videos[].duration` | string | 视频总时长（秒） |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.final_unit_deduction` | string | 任务最终扣减积分数值 |
| `data.created_at` | number | 任务创建时间，Unix 时间戳（ms） |
| `data.updated_at` | number | 任务更新时间，Unix 时间戳（ms） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 0 错误码 |
| `message` | string | 错误描述信息 |
| `request_id` | string | 请求 ID |

---

## 生成期代码（Agent 直接调用）

```typescript
/**
 * 查询可灵 Omni-Video 视频生成任务状态和结果。
 */

const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface VideoInfo {
  id: string;
  url: string;
  watermarkUrl: string;
  duration: string;
}

interface QueryOmniVideoResult {
  taskId: string;
  taskStatus: "submitted" | "processing" | "succeed" | "failed";
  taskStatusMsg?: string;
  watermarkEnabled?: boolean;
  videos?: VideoInfo[];
  externalTaskId?: string;
  finalUnitDeduction?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 查询指定任务的状态和结果。
 * @param taskId 任务 ID（与 externalTaskId 二选一）
 * @param externalTaskId 自定义任务 ID（与 taskId 二选一）
 * @returns 任务详情，含状态和视频 URL 列表
 */
async function queryOmniVideoTask(
  taskId?: string,
  externalTaskId?: string
): Promise<QueryOmniVideoResult> {
  if (!taskId && !externalTaskId) {
    throw new Error("taskId 和 externalTaskId 必须提供其中一个");
  }

  let url: string;
  if (taskId) {
    url = `https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/${taskId}`;
  } else {
    url = `https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/${externalTaskId}?external_task_id=${externalTaskId}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP 错误：${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API 错误 ${json.code}：${json.message}`);

  const d = json.data;
  return {
    taskId: d.task_id,
    taskStatus: d.task_status,
    taskStatusMsg: d.task_status_msg,
    watermarkEnabled: d.watermark_info?.enabled,
    videos: d.task_result?.videos?.map((v: {
      id: string; url: string; watermark_url: string; duration: string;
    }) => ({
      id: v.id,
      url: v.url,
      watermarkUrl: v.watermark_url,
      duration: v.duration,
    })),
    externalTaskId: d.task_info?.external_task_id,
    finalUnitDeduction: d.final_unit_deduction,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// 示例：轮询直到完成
async function pollUntilDone(taskId: string): Promise<QueryOmniVideoResult> {
  /**
   * 轮询任务状态，直到 succeed 或 failed，或超时。
   * @param taskId 任务 ID
   * @returns 最终任务结果
   */
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryOmniVideoTask(taskId);

    if (result.taskStatus === "succeed") return result;
    if (result.taskStatus === "failed") {
      throw new Error(`任务失败 (taskId: ${taskId})：${result.taskStatusMsg ?? "未知原因"}`);
    }
    // submitted / processing → 继续轮询
  }

  throw new Error(`任务 ${taskId} 超时（等待超过 10 分钟）`);
}
```

---

## Edge Function 代码（含 Supabase Storage 转存）

视频 URL 为防盗链格式，**30 天后清理**，Edge Function 查询成功后必须将视频转存至 Supabase Storage 并返回持久化 URL。

```typescript
// edge-functions/kling-video-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远程媒体资源（视频/音频/图片）流式传输到 Supabase Storage。
 * @param mediaUrl 资源 URL
 * @param bucketName 目标 bucket 名称
 * @param upsert 是否覆盖同名文件，默认 false
 * @returns 上传结果，包含持久化 publicUrl
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
  /**
   * Edge Function：查询可灵 Omni-Video 任务状态；任务成功时转存视频至 Supabase Storage。
   * 客户端传入 task_id，服务端注入 API Key，返回任务状态和持久化视频 URL。
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let taskId: string | undefined;
  let externalTaskId: string | undefined;
  try {
    const body = await req.json();
    taskId = body.task_id;
    externalTaskId = body.external_task_id;
    if (!taskId && !externalTaskId) throw new Error("Missing task_id or external_task_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body: task_id or external_task_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露到客户端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构造查询 URL ---
  let queryUrl: string;
  if (taskId) {
    queryUrl = `https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/${taskId}`;
  } else {
    queryUrl = `https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/${externalTaskId}?external_task_id=${externalTaskId}`;
  }

  // --- 调用上游接口 ---
  const upstream = await fetch(queryUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

  // --- 任务成功时转存视频到 Supabase Storage ---
  if (data.code === 0 && data.data?.task_status === "succeed" && data.data?.task_result?.videos) {
    const videos = data.data.task_result.videos as Array<{
      id: string; url: string; watermark_url: string; duration: string;
    }>;

    const transferredVideos = await Promise.all(
      videos.map(async (video) => {
        // 转存无水印版本
        const transfer = await streamMediaToStorage(video.url, "generated-media");
        const watermarkTransfer = video.watermark_url
          ? await streamMediaToStorage(video.watermark_url, "generated-media")
          : null;

        return {
          ...video,
          url: transfer.success ? transfer.publicUrl : video.url,
          watermark_url: watermarkTransfer?.success ? watermarkTransfer.publicUrl : video.watermark_url,
          storage_transfer_success: transfer.success,
        };
      })
    );

    data.data.task_result.videos = transferredVideos;
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（React / Vite）

```typescript
interface VideoQueryResult {
  taskStatus: string;
  taskStatusMsg?: string;
  videos?: Array<{
    id: string;
    url: string;
    watermark_url: string;
    duration: string;
    storage_transfer_success?: boolean;
  }>;
  finalUnitDeduction?: string;
}

/**
 * 查询可灵 Omni-Video 任务状态。
 * @param taskId 任务 ID
 * @returns 任务状态和视频 URL（任务成功时）
 */
async function queryVideoTask(taskId: string): Promise<VideoQueryResult> {
  const { data, error } = await supabase.functions.invoke("kling-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return {
    taskStatus: data.data.task_status,
    taskStatusMsg: data.data.task_status_msg,
    videos: data.data.task_result?.videos,
    finalUnitDeduction: data.data.final_unit_deduction,
  };
}

/**
 * 前端轮询：提交任务后轮询状态直到完成。
 * @param taskId 已提交任务的 task_id
 * @param onStatusChange 状态变化回调（可选）
 * @returns 最终视频结果
 */
async function pollVideoTask(
  taskId: string,
  onStatusChange?: (status: string) => void
): Promise<VideoQueryResult> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoTask(taskId);
    onStatusChange?.(result.taskStatus);

    if (result.taskStatus === "succeed") return result;
    if (result.taskStatus === "failed") {
      throw new Error(`视频生成失败：${result.taskStatusMsg ?? "未知原因"}`);
    }
    // submitted / processing → 继续轮询
  }

  throw new Error(`任务 ${taskId} 超时（等待超过 10 分钟）`);
}

// 完整使用示例（React 组件中）
const [status, setStatus] = useState<string>("");
const [videoUrl, setVideoUrl] = useState<string>("");

const handleGenerateVideo = async () => {
  try {
    // 步骤 1：提交任务（调用 kling-video-create Edge Function）
    const { data: createData, error: createError } = await supabase.functions.invoke(
      "kling-video-create",
      {
        body: {
          model_name: "kling-video-o1",
          prompt: "一只橘猫在草地上慵懒地打滚",
          mode: "pro",
          aspect_ratio: "16:9",
          duration: "5",
        },
      }
    );
    if (createError) throw createError;
    if (createData.code !== 0) throw new Error(`提交失败：${createData.message}`);

    const taskId = createData.data.task_id;
    setStatus("processing");

    // 步骤 2：轮询查询状态
    const result = await pollVideoTask(taskId, setStatus);

    if (result.videos && result.videos.length > 0) {
      setVideoUrl(result.videos[0].url);
      setStatus("succeed");
    }
  } catch (err) {
    console.error("视频生成失败：", err);
    setStatus("failed");
  }
};
```

### MiniProgram 平台（Taro）

```typescript
/**
 * MiniProgram：查询可灵 Omni-Video 任务状态。
 * @param taskId 任务 ID
 * @returns 任务状态和视频 URL（任务成功时）
 */
async function queryVideoTask(taskId: string): Promise<VideoQueryResult> {
  const { data, error } = await supabase.functions.invoke("kling-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return {
    taskStatus: data.data.task_status,
    taskStatusMsg: data.data.task_status_msg,
    videos: data.data.task_result?.videos,
    finalUnitDeduction: data.data.final_unit_deduction,
  };
}

// MiniProgram 两步 UI 示例
// 步骤 1：点击"生成"按钮，提交任务
const handleGenerate = async () => {
  const { data, error } = await supabase.functions.invoke("kling-video-create", {
    body: {
      model_name: "kling-video-o1",
      prompt: "一只橘猫在草地上慵懒地打滚",
      mode: "pro",
      aspect_ratio: "16:9",
      duration: "5",
    },
  });
  if (error) throw error;
  const taskId = data.data.task_id;
  setTaskId(taskId);
  setStatus("processing");

  // 轮询直到完成
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoTask(taskId);
    setStatus(result.taskStatus);

    if (result.taskStatus === "succeed" && result.videos?.length) {
      setVideoUrl(result.videos[0].url);
      break;
    }
    if (result.taskStatus === "failed") {
      Taro.showToast({ title: `生成失败：${result.taskStatusMsg ?? ""}`, icon: "none" });
      break;
    }
  }
};

// 步骤 2：点击"播放"按钮展示视频（使用 video 组件展示 Supabase Storage URL）
// <Video src={videoUrl} controls autoplay={false} />
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：折扣价 400 元 / 原价 480 元。轮询本身不计费，但避免不必要的重复任务提交。
- **视频 URL 有效期**：生成的视频 URL 为防盗链格式，**30 天后会被清理**，务必在 Edge Function 中及时转存至 Supabase Storage。
- **轮询间隔**：建议每 7 秒轮询一次，最长等待 10 分钟；视频生成时间通常与视频时长和复杂度相关。
- **任务查询方式**：`task_id`（系统生成）和 `external_task_id`（自定义）二选一，两者都可用于查询。
- **积分扣减**：`final_unit_deduction` 字段仅在任务完成后（`succeed` 或 `failed`）才有值。
- **存储 bucket**：Supabase Storage bucket 名称示例为 `generated-media`，请根据实际项目配置创建并设置公开访问权限。
