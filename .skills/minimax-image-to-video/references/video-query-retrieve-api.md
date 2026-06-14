# 图生视频（MiniMax）— 查询状态 & 视频下载接口

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `ad629bb9-46ea-41c1-8eb0-7acfc3e37381` |
| API ID（查询状态） | `api-eLMlPNkelVj9` |
| API ID（视频下载） | `api-rLyOyznAK2Ba` |
| Endpoint（查询状态） | `GET https://app-cblk1rqa5fk1-api-eLMlPNkelVj9-gateway.appmiaoda.com/v1/query/video_generation` |
| Endpoint（视频下载） | `GET https://app-cblk1rqa5fk1-api-rLyOyznAK2Ba-gateway.appmiaoda.com/v1/files/retrieve` |
| Auth | `platform_managed`，`X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | N/A（GET 请求，参数放 URL）|
| third_part_domain | `app-cblk1rqa5fk1-api-eLMlPNkelVj9-gateway.appmiaoda.com` |
| 计费 | 查询状态：不计费；视频下载：不计费 |

---

## 请求参数表

### 查询视频生成任务状态（api-eLMlPNkelVj9）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id` | string | 是 | 待查询的任务 ID（URL query 参数），只能查询当前账号创建的任务 |

### 视频下载（api-rLyOyznAK2Ba）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `file_id` | integer | 是 | 文件唯一标识符（URL query 参数），来自查询任务状态成功时的 `file_id` |

---

## 响应字段表

### 查询任务状态 — 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `task_id` | string | 被查询的任务 ID |
| `status` | string | 任务状态：`Preparing`（准备中）/ `Queueing`（队列中）/ `Processing`（生成中）/ `Success`（成功）/ `Fail`（失败）|
| `file_id` | string | 任务成功时返回，用于获取视频文件 |
| `video_width` | integer | 任务成功时返回，生成视频宽度（像素）|
| `video_height` | integer | 任务成功时返回，生成视频高度（像素）|
| `base_resp.status_code` | integer | 0 = 成功 |
| `base_resp.status_msg` | string | 状态信息 |

响应示例：
```json
{
  "task_id": "176843862716480",
  "status": "Success",
  "file_id": "176844028768320",
  "video_width": 1920,
  "video_height": 1080,
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

#### 查询接口错误码

| status_code | 说明 |
|-------------|------|
| 0 | 请求成功 |
| 1002 | 触发限流 |
| 1004 | 账号鉴权失败 |
| 1026 | 输入内容涉及敏感内容 |
| 1027 | 生成视频涉及敏感内容 |

### 视频下载 — 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `file.file_id` | integer | 文件唯一标识符 |
| `file.bytes` | integer | 文件大小（字节）|
| `file.created_at` | integer | 创建时间（Unix 时间戳，秒）|
| `file.filename` | string | 文件名称 |
| `file.purpose` | string | 文件使用目的 |
| `file.download_url` | string | 文件下载 URL，**有效期仅 1 小时** |
| `base_resp.status_code` | integer | 0 = 成功 |
| `base_resp.status_msg` | string | 状态详情 |

响应示例：
```json
{
  "file": {
    "file_id": 123456789,
    "bytes": 10485760,
    "created_at": 1700469398,
    "filename": "output_aigc.mp4",
    "purpose": "video_generation",
    "download_url": "https://www.downloadurl.com/video.mp4"
  },
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

#### 视频下载接口错误码

| status_code | 说明 |
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

---

## 关键约束（来自 examples）

### GET 接口参数传递方式（MiniProgram CRITICAL）

在 H5/MiniProgram 中通过 `supabase.functions.invoke` 调用 GET Edge Function 时，**参数必须拼接到 URL 中，不可放在 body**（H5 浏览器原生 `fetch` 会忽略 GET 请求的 body，导致 Edge Function 收不到参数并返回 400）：

```typescript
// 错误：body 在 H5 上被静默忽略
const { data, error } = await supabase.functions.invoke('query-video-status', {
  method: 'GET',
  body: { task_id: tid },
})

// 正确：参数拼接在 URL 中，Web 和 MiniProgram 均可用
const { data, error } = await supabase.functions.invoke(
  `query-video-status?task_id=${encodeURIComponent(tid)}`,
  { method: 'GET' }
)
```

### 轮询实现（CRITICAL：用 useRef，不可用 useState）

**不可用 `useState` 记录轮询计数器**。`useState` 每次更新都触发 `useEffect` 重新执行，导致所有轮询请求瞬间并发发出，在视频生成完成前就耗尽重试次数。

**必须用 `useRef`（无重渲染）+ `setTimeout` 递归**：

```typescript
const pollingCountRef = useRef(0)

useEffect(() => {
  if (!taskId) return

  pollingCountRef.current = 0
  let timer: ReturnType<typeof setTimeout>

  const poll = async () => {
    const status = await queryVideoStatus(taskId)  // 你的查询函数
    if (status === 'Success' || status === 'Fail') return

    pollingCountRef.current += 1
    if (pollingCountRef.current >= 24) {  // 24 × 5s = 2 分钟超时
      setStatus('failed')
      setErrorMessage('视频生成超时，请稍后重试')
      return
    }
    timer = setTimeout(poll, 5000)
  }

  poll()
  return () => clearTimeout(timer)
}, [taskId, queryVideoStatus])  // queryVideoStatus 需用 useCallback 包裹
```

### 视频文件获取 2 步流程（CRITICAL）

MiniMax 视频生成需要两步才能获取可用视频：
1. 轮询查询接口直到 `status=Success`，响应包含 `file_id`（**不是直接的视频 URL**）
2. 调用 `files/retrieve?file_id=...` 获取 `file.download_url`

**`download_url` 有效期仅 1 小时，必须立即上传到 Supabase Storage，使用持久化的 `publicUrl` 存入数据库，不可直接存储 `download_url`。**

```typescript
// Step 1 — 轮询直到 Success
const queryResp = await supabase.functions.invoke('query-video-status', { body: { task_id } })
const { status, file_id } = queryResp.data
if (status !== 'Success') return  // 继续轮询

// Step 2 — 获取下载链接
const retrieveResp = await supabase.functions.invoke('retrieve-video', { body: { file_id } })
const { download_url } = retrieveResp.data  // 临时 URL，仅 1 小时有效

// Step 3 — 立即转存到 Supabase Storage
const persistResp = await supabase.functions.invoke('persist-video', { body: { url: download_url } })
const videoUrl = persistResp.data.publicUrl  // 持久化 URL，存入数据库
```

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 查询视频生成任务状态。
 * @param taskId - 任务 ID
 * @returns 任务状态及文件信息
 */
async function queryVideoStatus(taskId: string): Promise<{
  status: string;
  fileId?: string;
  videoWidth?: number;
  videoHeight?: number;
}> {
  const url = new URL("https://app-cblk1rqa5fk1-api-eLMlPNkelVj9-gateway.appmiaoda.com/v1/query/video_generation");
  url.searchParams.set("task_id", taskId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  return {
    status: json.status,
    fileId: json.file_id,
    videoWidth: json.video_width,
    videoHeight: json.video_height,
  };
}

/**
 * 通过 file_id 获取视频下载链接（有效期 1 小时）。
 * @param fileId - 文件 ID，来自查询任务状态成功响应
 * @returns 视频下载 URL（临时，需立即转存）
 */
async function retrieveVideoFile(fileId: string): Promise<{
  downloadUrl: string;
  filename: string;
  bytes: number;
}> {
  const url = new URL("https://app-cblk1rqa5fk1-api-rLyOyznAK2Ba-gateway.appmiaoda.com/v1/files/retrieve");
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
    throw new Error(
      `API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`
    );
  }
  return {
    downloadUrl: json.file.download_url,
    filename: json.file.filename,
    bytes: json.file.bytes,
  };
}
```

---

## Edge Function 代码

### query-video-status（查询任务状态）

```typescript
// edge-functions/query-video-status.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  if (!taskId) {
    return new Response(JSON.stringify({ error: "Missing task_id" }), {
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

  const upstreamUrl = new URL(
    "https://app-cblk1rqa5fk1-api-eLMlPNkelVj9-gateway.appmiaoda.com/v1/query/video_generation"
  );
  upstreamUrl.searchParams.set("task_id", taskId);

  const upstream = await fetch(upstreamUrl.toString(), {
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

### retrieve-video-file（获取视频下载链接并转存 Supabase Storage）

> 此 Edge Function 自动将临时 `download_url` 转存到 Supabase Storage，返回持久化 `publicUrl`。

```typescript
// edge-functions/retrieve-video-file.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远端媒体资源流式上传到 Supabase Storage，返回持久化公开 URL。
 * @param mediaUrl - 临时下载 URL
 * @param bucketName - 目标 bucket 名称
 * @returns 上传结果，含持久化 publicUrl
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    new URL(mediaUrl);
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

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

  let fileId: string;
  let bucketName: string;
  try {
    const body = await req.json();
    fileId = body.file_id;
    bucketName = body.bucket_name ?? "generated-media";
    if (!fileId) throw new Error("Missing file_id");
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

  // Step 1: 获取临时下载链接
  const upstreamUrl = new URL(
    "https://app-cblk1rqa5fk1-api-rLyOyznAK2Ba-gateway.appmiaoda.com/v1/files/retrieve"
  );
  upstreamUrl.searchParams.set("file_id", fileId);

  const upstream = await fetch(upstreamUrl.toString(), {
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

  const fileData = await upstream.json();
  if (fileData.base_resp?.status_code !== 0) {
    return new Response(
      JSON.stringify({ error: `API error: ${fileData.base_resp?.status_msg}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const downloadUrl: string = fileData.file.download_url;

  // Step 2: 立即转存到 Supabase Storage（download_url 仅 1 小时有效）
  const transfer = await streamMediaToStorage(downloadUrl, bucketName);
  if (!transfer.success) {
    return new Response(
      JSON.stringify({ error: `Storage transfer failed: ${transfer.error}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      publicUrl: transfer.publicUrl,
      filename: fileData.file.filename,
      bytes: fileData.file.bytes,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

---

## 前端调用代码

### Web 平台 — 完整轮询 + 获取流程

```typescript
import { useRef, useEffect, useCallback } from 'react'

/**
 * 查询视频任务状态（Web）。
 * GET 参数必须拼接到 URL，不可放在 body。
 */
const queryVideoStatus = useCallback(async (taskId: string) => {
  const { data, error } = await supabase.functions.invoke(
    `query-video-status?task_id=${encodeURIComponent(taskId)}`,
    { method: 'GET' }
  )
  if (error) throw error
  return data
}, [])

/**
 * 获取视频并转存 Supabase Storage（Web）。
 */
async function retrieveAndPersistVideo(fileId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('retrieve-video-file', {
    body: { file_id: fileId, bucket_name: 'generated-media' },
  })
  if (error) throw error
  return data.publicUrl
}

// 轮询 Hook（useRef 计数器，避免 useState 导致的并发轮询）
const pollingCountRef = useRef(0)

useEffect(() => {
  if (!taskId) return

  pollingCountRef.current = 0
  let timer: ReturnType<typeof setTimeout>

  const poll = async () => {
    try {
      const result = await queryVideoStatus(taskId)
      if (result.status === 'Success') {
        const publicUrl = await retrieveAndPersistVideo(result.file_id)
        setVideoUrl(publicUrl)
        setStatus('success')
        return
      }
      if (result.status === 'Fail') {
        setStatus('failed')
        setErrorMessage('视频生成失败')
        return
      }
      pollingCountRef.current += 1
      if (pollingCountRef.current >= 24) {  // 24 × 5s = 2 分钟超时
        setStatus('failed')
        setErrorMessage('视频生成超时，请稍后重试')
        return
      }
      timer = setTimeout(poll, 5000)
    } catch (err) {
      setStatus('failed')
      setErrorMessage((err as Error).message)
    }
  }

  poll()
  return () => clearTimeout(timer)
}, [taskId, queryVideoStatus])
```

### MiniProgram 平台

```typescript
/**
 * 查询视频任务状态（MiniProgram）。
 * 参数拼接到 URL，避免 H5 忽略 GET body 的问题。
 */
const queryVideoStatus = useCallback(async (taskId: string) => {
  const { data, error } = await supabase.functions.invoke(
    `query-video-status?task_id=${encodeURIComponent(taskId)}`,
    { method: 'GET' }
  )
  if (error) throw error
  return data
}, [])

/**
 * 获取视频并转存 Supabase Storage（MiniProgram）。
 */
async function retrieveAndPersistVideo(fileId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('retrieve-video-file', {
    body: { file_id: fileId, bucket_name: 'generated-media' },
  })
  if (error) throw error
  return data.publicUrl
}

// 轮询实现与 Web 相同，使用 useRef + setTimeout 递归
// （此模式适用于所有异步任务轮询：视频/音频/图片生成）
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：查询状态和视频下载接口本身不计费，但视频生成提交接口按调用次数计费。
- **GET 参数传递**：H5 和 MiniProgram 中调用 GET Edge Function 时，必须将参数拼接到 URL，不可放在 body。
- **轮询计数器**：必须用 `useRef`，不可用 `useState`，防止并发轮询耗尽重试次数。
- **download_url 时效性**：有效期仅 1 小时，必须立即转存 Supabase Storage，不可直接持久化 `download_url`。
- **错误处理**：务必处理 429（限流）和 402/1008（余额不足），以及任务 `Fail` 状态（需向用户展示友好错误信息）。
- **supabase.functions.invoke 限制**：MiniProgram 中不支持 `.blob()`；本接口返回 JSON，无此问题，但需注意 GET 参数传递规则。
