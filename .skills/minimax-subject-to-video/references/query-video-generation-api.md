# 查询视频生成任务状态 API — 主体参考视频生成（MiniMax）

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `17196c7a-fca2-41ec-85f3-1e303e1a3ee1` |
| API ID | `api-GYX1bq2l5vWa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-GYX1bq2l5vWa-gateway.appmiaoda.com/v1/query/video_generation` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | 无请求体 |
| third_part_domain | `app-cblk1rqa5fk1-api-GYX1bq2l5vWa-gateway.appmiaoda.com` |
| 计费 | 否（`enable_billing: false`） |

---

## 请求参数表

### 查询参数（Query String）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id` | string | 是 | 待查询的任务 ID，只能查询当前账号创建的任务 |

---

## 响应字段表

### 成功响应（200）

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

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `task_id` | string | 被查询的任务 ID |
| `status` | string | 任务状态（见下表） |
| `file_id` | string? | 任务成功时返回，用于获取视频文件的文件 ID |
| `video_width` | integer? | 任务成功时返回，生成视频的宽度（像素） |
| `video_height` | integer? | 任务成功时返回，生成视频的高度（像素） |
| `base_resp.status_code` | integer | 状态码（见下表） |
| `base_resp.status_msg` | string | 状态信息；成功时为 `success` |

### 任务状态值

| status | 含义 |
|--------|------|
| `Preparing` | 准备中 |
| `Queueing` | 队列中 |
| `Processing` | 生成中 |
| `Success` | 成功 |
| `Fail` | 失败 |

### 状态码说明

| status_code | 含义 |
|-------------|------|
| 0 | 请求成功 |
| 1002 | 触发限流，请稍后再试 |
| 1004 | 账号鉴权失败，请检查 API-Key |
| 1026 | 输入内容涉及敏感内容 |
| 1027 | 生成视频涉及敏感内容 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

type VideoStatus = "Preparing" | "Queueing" | "Processing" | "Success" | "Fail";

interface QueryVideoGenerationResponse {
  task_id: string;
  status: VideoStatus;
  file_id?: string;
  video_width?: number;
  video_height?: number;
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * 查询视频生成任务的当前状态。
 *
 * @param taskId - 任务 ID（由提交任务接口返回）
 * @returns 任务状态及结果信息
 */
async function queryVideoGeneration(
  taskId: string,
): Promise<QueryVideoGenerationResponse> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-GYX1bq2l5vWa-gateway.appmiaoda.com/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json: QueryVideoGenerationResponse = await response.json();
  return json;
}
```

---

## Edge Function 代码

### Web 平台

```typescript
// edge-functions/minimax-query-video-generation.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
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

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-GYX1bq2l5vWa-gateway.appmiaoda.com/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### MiniProgram 平台

MiniProgram 与 Web 的 Edge Function 实现相同，无需分开部署。

---

## 前端调用代码

### Web 平台（推荐 supabase client）

```typescript
type VideoStatus = "Preparing" | "Queueing" | "Processing" | "Success" | "Fail";

interface QueryVideoResult {
  task_id: string;
  status: VideoStatus;
  file_id?: string;
  video_width?: number;
  video_height?: number;
  base_resp: { status_code: number; status_msg: string };
}

/**
 * 查询视频生成任务状态。
 *
 * @param taskId - 任务 ID
 * @returns 任务状态及结果信息
 */
async function queryVideoGenerationTask(taskId: string): Promise<QueryVideoResult> {
  const { data, error } = await supabase.functions.invoke("minimax-query-video-generation", {
    body: { taskId },
  });
  if (error) throw error;
  return data as QueryVideoResult;
}

/** 轮询直到任务完成，返回 file_id */
async function pollUntilComplete(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoGenerationTask(taskId);
    if (result.status === "Success") return result.file_id!;
    if (result.status === "Fail") throw new Error(`任务失败，taskId: ${taskId}`);
    // Preparing / Queueing / Processing → 继续轮询
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}
```

### MiniProgram 平台（Taro + supabase client）

```typescript
/**
 * MiniProgram 轮询视频生成任务，与 Web 调用方式相同。
 *
 * @param taskId - 任务 ID
 * @returns file_id，用于获取下载链接
 */
async function pollUntilComplete(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data, error } = await supabase.functions.invoke(
      "minimax-query-video-generation",
      { body: { taskId } },
    );
    if (error) throw error;
    if (data.status === "Success") return data.file_id;
    if (data.status === "Fail") throw new Error(`任务失败，taskId: ${taskId}`);
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}
```

---

## 注意事项

- **计费**：此接口不计费（`enable_billing: false`），可频繁调用以轮询状态。
- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **轮询间隔**：建议 5～10 秒，总超时设为 10 分钟。
- **权限限制**：只能查询当前账号创建的任务，跨账号查询会失败。
- **错误处理**：务必处理 `status === "Fail"` 情况，避免无限轮询。
