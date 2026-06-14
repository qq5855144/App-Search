---
name: minimax-image-to-video
description: 使用 MiniMax 图生视频 API，通过首帧图片或首尾帧图片生成视频；适用于需要将静态图片转化为动态视频的场景，支持运镜控制、自定义时长和分辨率
license: MIT
---

## 能力概述

**图生视频（MiniMax）** 提供四个接口，构成完整的异步视频生成工作流：

| 步骤 | 接口 | 方法 | 说明 |
|------|------|------|------|
| 1. 提交任务 | 单帧图生视频 | POST `/v1/video_generation` | 通过首帧图片 + 文本描述生成视频 |
| 1. 提交任务 | 首尾帧生成视频 | POST `/v1/video_generation` | 通过首帧+尾帧图片生成过渡视频 |
| 2. 查询状态 | 查询任务状态 | GET `/v1/query/video_generation` | 轮询任务进度，等待 Success/Fail |
| 3. 获取文件 | 视频下载 | GET `/v1/files/retrieve` | 通过 file_id 获取下载链接（有效期 1 小时）|

**认证方式：** `platform_managed`，密钥由平台注入，Edge Function 中通过 `Deno.env.get("INTEGRATIONS_API_KEY")` 读取，header 统一为 `X-Gateway-Authorization: Bearer <key>`。

**支持平台：** Web、MiniProgram

**核心约束（MiniMax-Hailuo-02 模型）：**
- `resolution` 仅支持 `768P` 和 `1080P`（`720P`/`512P` 会返回 2013 错误），默认 `768P`
- `duration`：`768P` 支持 6s 或 10s；`1080P` 仅支持 6s（不可传 3s/5s）
- 默认 `duration=6`；如 UI 提供时长选择器，当 `resolution=1080P` 时需自动重置为 6 并禁用其他选项
- 首尾帧模式不支持 512P 分辨率

**视频获取流程（2 步）：**
1. 轮询查询接口直到 `status=Success`，获得 `file_id`
2. 调用 `files/retrieve?file_id=...` 获取 `download_url`（有效期仅 1 小时）
3. **必须立即**将 `download_url` 上传到 Supabase Storage，使用持久化的 `publicUrl` 存入数据库

---

## 生成期用法（Agent 直接调用）

详见 `references/video-generation-api.md` 和 `references/video-query-retrieve-api.md`。

完整异步工作流（提交 → 轮询 → 获取文件 → 转存 Storage）：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

// Step 1: 提交图生视频任务（单帧模式）
async function submitImageToVideo(params: {
  firstFrameImage: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
}): Promise<{ taskId: string }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-VaOw5VAJdQBa-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-Hailuo-02",
        first_frame_image: params.firstFrameImage,
        prompt: params.prompt ?? "",
        duration: params.duration ?? 6,
        resolution: params.resolution ?? "768P",
        prompt_optimizer: true,
      }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }
  return { taskId: json.task_id };
}

// Step 2: 轮询任务状态
async function pollVideoStatus(taskId: string): Promise<{
  status: string;
  fileId?: string;
  videoWidth?: number;
  videoHeight?: number;
}> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-eLMlPNkelVj9-gateway.appmiaoda.com/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  return {
    status: json.status,
    fileId: json.file_id,
    videoWidth: json.video_width,
    videoHeight: json.video_height,
  };
}

// Step 3: 获取视频下载链接
async function retrieveVideoFile(fileId: string): Promise<string> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-rLyOyznAK2Ba-gateway.appmiaoda.com/v1/files/retrieve?file_id=${fileId}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }
  return json.file.download_url;
}

// 完整工作流：提交 → 轮询 → 获取链接
async function generateVideoAndWait(params: {
  firstFrameImage: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
}): Promise<{ downloadUrl: string; fileId: string }> {
  const { taskId } = await submitImageToVideo(params);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await pollVideoStatus(taskId);
    if (result.status === "Success") {
      const downloadUrl = await retrieveVideoFile(result.fileId!);
      return { downloadUrl, fileId: result.fileId! };
    }
    if (result.status === "Fail") {
      throw new Error(`Video generation failed for task ${taskId}`);
    }
    // Preparing / Queueing / Processing → 继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

---

## 首尾帧组合工作流示例

同时提供首帧（`first_frame_image`）和尾帧（`last_frame_image`），生成从起始画面平滑过渡到结束画面的视频：

```typescript
const apiKey = Deno.env.get("INTEGRATIONS_API_KEY")!;

/**
 * 首尾帧组合图生视频完整工作流：提交 → 轮询 → 获取链接。
 * @param firstFrameImage - 首帧图片 URL 或 Base64 Data URL
 * @param lastFrameImage - 尾帧图片 URL 或 Base64 Data URL
 * @param prompt - 视频文本描述（可选）
 * @returns 视频下载链接及文件 ID
 */
async function generateFirstLastFrameVideo(params: {
  firstFrameImage: string;
  lastFrameImage: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
}): Promise<{ downloadUrl: string; fileId: string }> {
  // Step 1: 提交首尾帧视频生成任务
  const submitResponse = await fetch(
    "https://app-cblk1rqa5fk1-api-nYWNRQr5pV1L-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-Hailuo-02",
        first_frame_image: params.firstFrameImage,
        last_frame_image: params.lastFrameImage,
        prompt: params.prompt ?? "",
        duration: params.duration ?? 6,
        resolution: params.resolution ?? "768P",
        prompt_optimizer: true,
      }),
    }
  );

  if (!submitResponse.ok) throw new Error(`HTTP error: ${submitResponse.status}`);
  const submitJson = await submitResponse.json();
  if (submitJson.base_resp?.status_code !== 0) {
    throw new Error(
      `API error ${submitJson.base_resp?.status_code}: ${submitJson.base_resp?.status_msg}`
    );
  }
  const taskId: string = submitJson.task_id;

  // Step 2: 轮询任务状态
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const queryResponse = await fetch(
      `https://app-cblk1rqa5fk1-api-eLMlPNkelVj9-gateway.appmiaoda.com/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      }
    );
    if (!queryResponse.ok) throw new Error(`HTTP error: ${queryResponse.status}`);
    const queryJson = await queryResponse.json();

    if (queryJson.status === "Success") {
      // Step 3: 获取视频下载链接
      const retrieveResponse = await fetch(
        `https://app-cblk1rqa5fk1-api-rLyOyznAK2Ba-gateway.appmiaoda.com/v1/files/retrieve?file_id=${queryJson.file_id}`,
        {
          method: "GET",
          headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
        }
      );
      if (!retrieveResponse.ok) throw new Error(`HTTP error: ${retrieveResponse.status}`);
      const retrieveJson = await retrieveResponse.json();
      return { downloadUrl: retrieveJson.file.download_url, fileId: queryJson.file_id };
    }
    if (queryJson.status === "Fail") {
      throw new Error(`Video generation failed for task ${taskId}`);
    }
    // Preparing / Queueing / Processing → 继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}

// 使用示例：从产品封面图过渡到使用场景图
const result = await generateFirstLastFrameVideo({
  firstFrameImage: "https://example.com/product-cover.jpg",
  lastFrameImage: "https://example.com/product-in-use.jpg",
  prompt: "产品从展示台缓缓移动到使用场景，镜头平稳推进",
  duration: 6,
  resolution: "768P",
});
console.log("视频下载链接：", result.downloadUrl);
// 注意：download_url 有效期仅 1 小时，需立即转存到 Supabase Storage
```

**生成期文件下载（必须执行）：**

生成接口返回的 `download_url` **有效期仅 1 小时**，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<download_url>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取 `downloadUrl`
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：`download_url` 有效期仅 1 小时，必须在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内需部署 **三个 Edge Function**：

| Edge Function | 对应接口 | 说明 |
|--------------|---------|------|
| `submit-image-to-video` | 单帧 或 首尾帧 POST | 提交视频生成任务 |
| `query-video-status` | GET query | 轮询任务状态 |
| `retrieve-video-file` | GET files/retrieve | 获取下载链接并转存 Supabase Storage |

**平台差异：**
- GET 接口的 Edge Function 调用在 H5/MiniProgram 中必须把参数放在 URL 中，不可放在 body（H5 会静默忽略 GET 请求的 body）
- 前端轮询计数器必须用 `useRef`，不可用 `useState`（useState 触发重渲染会使轮询失控）
- `download_url` 有效期仅 1 小时，**必须立即**转存到 Supabase Storage

详细 Edge Function 代码、前端代码及注意事项，见：
- `references/video-generation-api.md`（提交接口）
- `references/video-query-retrieve-api.md`（查询 + 下载接口）
