---
name: text-to-video
description: 基于文本描述生成短视频（5s/10s），适用于电商营销、创意宣传、教育讲解等场景，异步轮询获取结果。
license: MIT
---

## 能力概述

通过百度千帆平台 Kling 模型，根据文字提示词自动生成 5 秒或 10 秒的视频内容（不含声音）。

| 项目 | 说明 |
|------|------|
| 认证模式 | `platform_managed`（密钥由平台注入，无需用户配置） |
| 第三方域名 | `qianfan.baidubce.com` |
| 支持平台 | Web、MiniProgram |
| 计费 | 原价 ¥130.00 / 折扣价 ¥85.00（仅创建任务接口计费，查询接口不计费） |

**接口列表：**

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建文生视频任务 | POST | `/beta/video/generations/kling/text2video` | 提交生成任务，返回 `task_id` |
| 查询任务状态 | GET | `/beta/video/generations/kling/text2video` | 轮询任务状态，成功后返回视频 URL |

**工作流：**

```
用户提交 prompt
    ↓
POST /text2video  →  返回 task_id
    ↓
每 5 秒轮询 GET /text2video?task_id=xxx
    ↓
task_status == "succeed"  →  获取 videos[0].url
    ↓
将视频 URL 转存至 Supabase Storage（视频链接 30 天后失效）
```

---

## 生成期用法（Agent 直接调用）

此 API 为异步接口，需先提交任务获取 `task_id`，再轮询查询状态直至完成。

详见：
- `references/submit-api.md`（创建文生视频任务）
- `references/query-api.md`（查询文生视频生成任务状态）

**完整异步工作流示例（生成期）：**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

/**
 * 创建文生视频任务
 * @param prompt - 正向文本提示词，最大 2500 字符
 * @param duration - 视频时长（秒），枚举值：5、10，默认 5
 * @param modelName - 生成模型，枚举值：kling-v1、kling-v1-6、kling-v2-master、kling-v2-1-master
 * @returns task_id
 */
async function submitTextToVideo(
  prompt: string,
  duration: string = "5",
  modelName: string = "kling-v1-6"
): Promise<string> {
  const response = await fetch(
    "https://api-o9wN672BkyMa@qianfan.baidubce.com/beta/video/generations/kling/text2video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model_name: modelName, prompt, duration }), // model_name 为必填参数
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.code !== 0) throw new Error(`API error ${json.code}: ${json.message}`);
  return json.data.task_id;
}

/**
 * 查询文生视频任务状态
 * @param taskId - 任务 ID
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

/**
 * 提交任务并轮询直至完成，返回视频 URL
 * @param prompt - 正向文本提示词
 * @param duration - 视频时长（秒），枚举值：5、10
 * @param modelName - 生成模型，枚举值：kling-v1、kling-v1-6、kling-v2-master、kling-v2-1-master
 * @returns 视频 URL（第三方临时链接，30 天后失效）
 */
async function generateVideoAndWait(
  prompt: string,
  duration: string = "5",
  modelName: string = "kling-v1-6"
): Promise<string> {
  const taskId = await submitTextToVideo(prompt, duration, modelName);

  const POLL_INTERVAL_MS = 5000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTextToVideo(taskId);
    if (result.task_status === "succeed") {
      const videoUrl = result.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error("Task succeeded but no video URL returned");
      return videoUrl;
    }
    if (result.task_status === "failed") {
      throw new Error(`Task failed: ${result.task_status_msg ?? "unknown reason"}`);
    }
    // submitted / processing → keep polling
  }
  throw new Error(`Task timed out after 10 minutes`);
}
```

**生成期文件下载（必须执行）：**

生成接口返回的视频 URL 是 CDN 临时链接（30 天后失效），在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<视频 URL>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取视频 URL
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

本 API 为异步接口，Edge Function 设计原则：

- **创建任务** Edge Function：立即返回 `task_id` 给前端，**不在 Edge Function 内部轮询**。
- **查询任务** Edge Function：前端每 5 秒调用一次，直到 `task_status` 为 `succeed` 或 `failed`。
- 当状态为 `succeed` 时，将 `task_result.videos[0].url` 转存至 Supabase Storage（原始视频链接 30 天后失效）。

**平台差异：**

| 平台 | 调用方式 | 说明 |
|------|----------|------|
| Web | `supabase.functions.invoke` 或原生 `fetch` | 标准 JSON 调用 |
| MiniProgram | `supabase.functions.invoke` | 标准 JSON 调用 |

详见：
- `references/submit-api.md`（创建任务 Edge Function + 前端代码）
- `references/query-api.md`（查询任务 Edge Function + 前端轮询代码 + Supabase Storage 转存）
