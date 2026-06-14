---
name: minimax-text-to-video
description: 基于 MiniMax 模型将文本描述生成短视频，支持运镜控制、多分辨率及异步轮询获取结果，适用于短视频创作、广告制作等场景。
license: MIT
---

## 能力概述

通过 MiniMax API，根据文本描述自动生成视频内容，支持 MiniMax-Hailuo-02 等模型，可配置视频时长（6 秒或 10 秒）、分辨率（768P/1080P，MiniMax-Hailuo-02 模型），并支持 15 种运镜控制指令。

| 项目 | 说明 |
|------|------|
| 认证模式 | `platform_managed`（密钥由平台注入，无需用户配置） |
| 第三方域名 | `app-cblk1rqa5fk1-api-V9gDzg15D7BL-gateway.appmiaoda.com` |
| 支持平台 | Web、MiniProgram |
| 计费 | 原价 ¥130.00 / 折扣价 ¥100.00（仅创建任务接口计费，查询和下载接口不计费） |

**接口列表：**

| 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 创建文生视频任务 | POST | `/v1/video_generation` | 提交生成任务，返回 `task_id` |
| 查询任务状态 | GET | `/v1/query/video_generation` | 轮询任务状态，成功后返回 `file_id` |
| 视频文件下载 | GET | `/v1/files/retrieve` | 通过 `file_id` 获取视频下载链接 |

**工作流：**

```
用户提交 prompt
    ↓
POST /v1/video_generation  →  返回 task_id
    ↓
每 7 秒轮询 GET /v1/query/video_generation?task_id=xxx
    ↓
status == "Success"  →  获取 file_id
    ↓
GET /v1/files/retrieve?file_id=xxx  →  获取 download_url（有效期 1 小时）
    ↓
将视频 URL 转存至 Supabase Storage（原始链接仅 1 小时有效）
```

---

## 生成期用法（Agent 直接调用）

此 API 为异步接口，需先提交任务获取 `task_id`，再轮询查询状态直至完成，最后通过 `file_id` 获取下载链接。

详见：
- `references/video-generation-api.md`（创建任务 + 查询状态 + 视频下载）

**完整异步工作流示例（生成期）：**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 创建文生视频任务
 * @param prompt - 视频文本描述，最大 2000 字符，支持 [运镜指令] 语法
 * @param model - 模型名称，可选 "MiniMax-Hailuo-02"，默认 "MiniMax-Hailuo-02"
 * @param duration - 视频时长（秒），可选 6 或 10，默认 6
 * @param resolution - 视频分辨率，可选 "768P" 或 "1080P"，默认 "768P"
 * @returns task_id
 */
async function submitTextToVideo(
  prompt: string,
  model: string = "MiniMax-Hailuo-02",
  duration: number = 6,
  resolution: string = "768P"
): Promise<string> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-V9gDzg15D7BL-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, duration, resolution }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }
  return json.task_id;
}

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

/**
 * 通过 file_id 获取视频下载链接
 * @param fileId - 文件 ID（由查询接口返回）
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

/**
 * 提交任务并轮询直至完成，返回视频下载 URL
 * @param prompt - 视频文本描述
 * @param model - 模型名称
 * @param duration - 视频时长（秒）
 * @param resolution - 视频分辨率
 * @returns 视频下载 URL（第三方临时链接，有效期 1 小时）
 */
async function generateVideoAndWait(
  prompt: string,
  model: string = "MiniMax-Hailuo-02",
  duration: number = 6,
  resolution: string = "768P"
): Promise<string> {
  const taskId = await submitTextToVideo(prompt, model, duration, resolution);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTextToVideo(taskId);
    if (result.status === "Success") {
      if (!result.file_id) throw new Error("Task succeeded but no file_id returned");
      const fileInfo = await retrieveVideoFile(result.file_id);
      return fileInfo.download_url;
    }
    if (result.status === "Fail") {
      throw new Error(`Task failed: ${result.base_resp?.status_msg ?? "unknown reason"}`);
    }
    // Preparing / Queueing / Processing → keep polling
  }
  throw new Error(`Task timed out after 10 minutes`);
}
```

**生成期文件下载（必须执行）：**

生成接口返回的 `download_url` **有效期仅 1 小时**，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<download_url>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取 `download_url`
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：`download_url` 有效期仅 1 小时，必须在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

本 API 为异步接口，Edge Function 设计原则：

- **创建任务** Edge Function：立即返回 `task_id` 给前端，**不在 Edge Function 内部轮询**。
- **查询任务** Edge Function：前端每 7 秒调用一次，直到 `status` 为 `Success` 或 `Fail`。
- 当状态为 `Success` 时，通过 `file_id` 调用 **获取下载链接** Edge Function，将视频转存至
  Supabase Storage（原始下载链接有效期仅 1 小时）。

**平台差异：**

| 平台 | 调用方式 | 说明 |
|------|----------|------|
| Web | `supabase.functions.invoke` 或原生 `fetch` | 标准 JSON 调用 |
| MiniProgram | `supabase.functions.invoke` | 标准 JSON 调用 |

详见：
- `references/video-generation-api.md`（三个 Edge Function 完整实现 + 前端轮询代码 + Supabase Storage 转存）
