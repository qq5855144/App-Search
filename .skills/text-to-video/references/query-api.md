# 文生视频 — 查询文生视频生成任务状态

## API 基本信息

| 项目 | 值 |
|------|-----|
| Plugin ID | `284585aa-3c6e-4827-b46e-a1e610aa3100` |
| API ID | `api-nYWNozBb5qML` |
| Endpoint | `GET https://api-nYWNozBb5qML@qianfan.baidubce.com/beta/video/generations/kling/text2video` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| 第三方域名 | `qianfan.baidubce.com` |
| 计费 | 不启用（查询接口免费） |

---

## 请求参数表

| 参数名 | 类型 | 位置 | 必填 | 说明 |
|--------|------|------|------|------|
| `task_id` | string | Query | 是 | 此次视频生成的任务 ID |

---

## 响应字段表

### 成功响应（HTTP 200，`code: 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，0 表示成功 |
| `message` | string | 状态信息，成功时为 `"SUCCEED"` |
| `request_id` | string | 请求 ID，用于排查问题 |
| `data.task_id` | string | 任务 ID |
| `data.task_status` | string | 任务状态：`submitted`（已提交）、`processing`（处理中）、`succeed`（成功）、`failed`（失败） |
| `data.task_status_msg` | string | 任务状态信息，失败时展示失败原因（如触发内容风控） |
| `data.task_result.videos` | array | 生成的视频列表，成功后有值 |
| `data.task_result.videos[].id` | string | 生成的视频 ID，全局唯一 |
| `data.task_result.videos[].url` | string | 生成视频的临时 URL（**30 天后失效，需及时转存**） |
| `data.task_result.videos[].duration` | string | 视频总时长（秒） |
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
 * 查询文生视频任务状态（生成期直接调用）
 * @param taskId - 任务 ID（由创建接口返回）
 * @returns 任务数据，含 task_status 和 task_result.videos
 */
async function queryTextToVideo(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: { videos: Array<{ id: string; url: string; duration: string }> };
  created_at: number;
  updated_at: number;
}> {
  const url = new URL(
    "https://api-nYWNozBb5qML@qianfan.baidubce.com/beta/video/generations/kling/text2video"
  );
  url.searchParams.set("task_id", taskId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);

  return json.data;
}
```

---

## Edge Function 代码

> **关键实现说明**：
> - 当 `task_status` 为 `succeed` 时，将 `task_result.videos[0].url` 转存至 Supabase Storage。
> - 原始视频 URL 由第三方（可赛科技）提供，**30 天后自动失效**，必须转存以保证持久访问。
> - 前端每 5 秒调用此 Edge Function，直到状态为 `succeed` 或 `failed`。

```typescript
// edge-functions/text-to-video-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // --- 调用上游查询接口 ---
  const queryUrl = new URL(
    "https://api-nYWNozBb5qML@qianfan.baidubce.com/beta/video/generations/kling/text2video"
  );
  queryUrl.searchParams.set("task_id", taskId);

  const upstream = await fetch(queryUrl.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

  const result = await upstream.json();
  if (result.code !== 0) {
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const taskData = result.data;

  // --- 任务成功时，将视频 URL 转存至 Supabase Storage ---
  if (taskData.task_status === "succeed") {
    const videoUrl = taskData.task_result?.videos?.[0]?.url;
    if (videoUrl) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const transfer = await streamMediaToStorage(videoUrl, "generated-media", supabase);
      if (transfer.success) {
        // 用持久 URL 替换临时第三方 URL
        taskData.task_result.videos[0].url = transfer.publicUrl;
      }
      // 即使转存失败，仍返回原始结果，不阻断主流程
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * 将远端媒体资源（图片 / 视频 / 音频）流式上传至 Supabase Storage
 * @param mediaUrl - 远端媒体资源 URL
 * @param bucketName - Supabase Storage bucket 名称
 * @param supabase - Supabase 客户端实例
 * @param upsert - 是否覆盖同路径文件，默认 false
 * @returns 成功时返回 { success, path, publicUrl, contentType }，失败时返回 { success, error }
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
  supabase: ReturnType<typeof createClient>,
  upsert = false
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl); // 校验 URL 格式

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
```

---

## 前端调用代码

### Web 平台

```typescript
/**
 * 查询文生视频任务状态（Web 前端）
 * 前端每 5 秒调用一次，直到 task_status 为 succeed 或 failed
 * @param taskId - 任务 ID
 * @returns 任务数据，succeed 时 videos[0].url 为 Supabase Storage 持久 URL
 */
async function queryVideoTask(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: { videos: Array<{ id: string; url: string; duration: string }> };
}> {
  const { data, error } = await supabase.functions.invoke("text-to-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data;
}

/**
 * 前端完整轮询流程（Web）
 * @param taskId - 由提交接口返回的任务 ID
 * @returns 持久视频 URL（已转存至 Supabase Storage）
 */
async function pollUntilComplete(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 5000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoTask(taskId);

    if (result.task_status === "succeed") {
      const videoUrl = result.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error("任务成功但未返回视频 URL");
      return videoUrl;
    }
    if (result.task_status === "failed") {
      throw new Error(`视频生成失败：${result.task_status_msg ?? "未知原因"}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error("视频生成超时（10 分钟）");
}
```

### MiniProgram 平台

> **说明**：MiniProgram 端与 Web 端调用方式相同，均使用 `supabase.functions.invoke`
> 接收 JSON 响应，无需额外的二进制处理。

```typescript
/**
 * 查询文生视频任务状态（MiniProgram 前端）
 * @param taskId - 任务 ID
 * @returns 任务数据，succeed 时 videos[0].url 为 Supabase Storage 持久 URL
 */
async function queryVideoTask(taskId: string): Promise<{
  task_id: string;
  task_status: string;
  task_status_msg?: string;
  task_result?: { videos: Array<{ id: string; url: string; duration: string }> };
}> {
  const { data, error } = await supabase.functions.invoke("text-to-video-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data;
}

/**
 * 前端完整轮询流程（MiniProgram）
 * @param taskId - 由提交接口返回的任务 ID
 * @returns 持久视频 URL（已转存至 Supabase Storage）
 */
async function pollUntilComplete(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 5000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoTask(taskId);

    if (result.task_status === "succeed") {
      const videoUrl = result.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error("任务成功但未返回视频 URL");
      return videoUrl;
    }
    if (result.task_status === "failed") {
      throw new Error(`视频生成失败：${result.task_status_msg ?? "未知原因"}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error("视频生成超时（10 分钟）");
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **视频 URL 有效期**：第三方视频链接 30 天后自动失效，Edge Function 在状态 `succeed` 时自动将视频转存至 Supabase Storage，返回持久 URL。
- **轮询策略**：建议每 5 秒查询一次；未完成状态（`submitted`/`processing`）继续轮询，已完成状态（`succeed`/`failed`）停止轮询。
- **轮询超时**：建议设置 10 分钟超时，超时后停止轮询并提示用户。
- **Supabase Storage bucket**：需确保 `generated-media` bucket 已创建并配置公开访问权限。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）；`task_status_msg` 在失败时含有详细原因（如触发内容风控）。
- **计费**：查询接口不计费，可放心轮询；创建任务接口按调用次数计费，避免重复提交。
