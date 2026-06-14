---
name: minimax-subject-to-video
description: 基于 MiniMax S2V-01 模型，上传人物主体图片和文本描述生成动态视频；支持异步轮询获取结果和下载链接。
license: MIT
---

## 能力概述

基于 MiniMax S2V-01 模型的主体参考视频生成服务，支持上传人像图片并结合文本描述生成动态视频。整体流程分为三步：

1. **提交任务**（POST）— 上传主体参考图片和文本描述，创建视频生成任务，返回 `task_id`
2. **查询状态**（GET）— 轮询任务状态直到 `Success` 或 `Fail`，成功后返回 `file_id`
3. **获取下载链接**（GET）— 通过 `file_id` 获取视频文件下载 URL（有效期 1 小时）

| 项目 | 说明 |
|------|------|
| 模型 | S2V-01 |
| 主体类型 | character（人物面部） |
| 图片格式 | JPG / JPEG / PNG / WebP，小于 20MB，短边 > 300px，长宽比 2:5 ~ 5:2 |
| 输出视频 | 最高 1920×1080，MP4 格式 |
| 视频下载链接有效期 | 1 小时 |
| 计费 | 仅提交任务接口计费（`api-oLpZbv47qvea`），查询状态和文件获取免费 |

详见各接口规格：
- `references/video-generation-api.md` — 提交任务接口
- `references/query-video-generation-api.md` — 查询任务状态接口
- `references/retrieve-file-api.md` — 获取视频下载链接接口

---

## 生成期用法（Agent 直接调用）

`traefik: true`，密钥由平台注入，通过 `process.env["INTEGRATIONS_API_KEY"]` 读取。

完整异步工作流：提交任务 → 轮询状态 → 获取下载链接。详见 `references/video-generation-api.md`。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/** 提交视频生成任务 */
async function submitVideoGeneration(
  imageUrl: string,
  prompt?: string,
  promptOptimizer = true,
): Promise<{ taskId: string }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-oLpZbv47qvea-gateway.appmiaoda.com/v1/video_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "S2V-01",
        prompt,
        prompt_optimizer: promptOptimizer,
        subject_reference: [{ type: "character", image: [imageUrl] }],
      }),
    },
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp.status_code !== 0) {
    throw new Error(`API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }
  return { taskId: json.task_id };
}

/** 查询任务状态 */
async function queryVideoGeneration(
  taskId: string,
): Promise<{ status: string; fileId?: string; videoWidth?: number; videoHeight?: number }> {
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
  const json = await response.json();
  return {
    status: json.status,
    fileId: json.file_id,
    videoWidth: json.video_width,
    videoHeight: json.video_height,
  };
}

/** 获取视频文件下载链接 */
async function retrieveVideoFile(fileId: string): Promise<{ downloadUrl: string; filename: string }> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-VaOw5V2Pbqoa-gateway.appmiaoda.com/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.base_resp.status_code !== 0) {
    throw new Error(`API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }
  return { downloadUrl: json.file.download_url, filename: json.file.filename };
}

/** 完整异步工作流：提交 → 轮询 → 获取下载链接 */
async function generateSubjectReferenceVideo(
  imageUrl: string,
  prompt?: string,
): Promise<{ downloadUrl: string; filename: string; videoWidth?: number; videoHeight?: number }> {
  const { taskId } = await submitVideoGeneration(imageUrl, prompt);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoGeneration(taskId);

    if (result.status === "Success") {
      const file = await retrieveVideoFile(result.fileId!);
      return { ...file, videoWidth: result.videoWidth, videoHeight: result.videoHeight };
    }
    if (result.status === "Fail") {
      throw new Error(`视频生成任务失败，taskId: ${taskId}`);
    }
    // Preparing / Queueing / Processing → 继续轮询
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}
```

**生成期文件下载（必须执行）：**

生成接口返回的 `downloadUrl` **有效期仅 1 小时**，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<downloadUrl>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取 `downloadUrl`
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：`downloadUrl` 有效期仅 1 小时，必须在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

前端通过 Edge Function 调用，密钥在服务端注入，不暴露到客户端。支持 Web 和 MiniProgram 两个平台，Edge Function 实现相同，前端调用方式相同。

返回的视频 `download_url` 有效期仅 1 小时，建议应用在获取后立即使用或转存到 Supabase Storage。

详见：
- `references/video-generation-api.md` — 提交任务 Edge Function + 前端代码
- `references/query-video-generation-api.md` — 查询状态 Edge Function + 前端代码
- `references/retrieve-file-api.md` — 获取下载链接 Edge Function + 前端代码

### 平台差异说明

| 平台 | Edge Function | 前端调用 | 视频播放 |
|------|--------------|---------|---------|
| Web | 标准 JSON 响应 | `supabase.functions.invoke` 或原生 `fetch` | `<video src={downloadUrl}>` |
| MiniProgram | 标准 JSON 响应 | `supabase.functions.invoke` | `Taro.createVideoContext` 或 `<Video src={downloadUrl}>` |

> 注意：下载链接 `download_url` 有效期 1 小时，视频生成完成后请及时保存或转存。

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：仅提交任务接口（`api-oLpZbv47qvea`）计费，查询状态和文件获取接口免费。插件当前 `original_price: 0.00`，以平台实际定价为准。
- **错误处理**：务必处理 429（配额超限）、402（余额不足）和 `base_resp.status_code` 非 0 的业务错误。
- **视频下载链接有效期**：`download_url` 有效期仅 1 小时，建议生成后立即转存至 Supabase Storage（参见模板 Appendix A）。
- **轮询超时**：视频生成时长不定，建议轮询间隔 7 秒，总超时设为 10 分钟。
- **图片要求**：JPG/JPEG/PNG/WebP，小于 20MB，短边 > 300px，长宽比在 2:5 ~ 5:2 之间。
