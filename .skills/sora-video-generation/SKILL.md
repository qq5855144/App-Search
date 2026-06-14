---
name: sora-video-generation
description: Sora 2 视频生成（高级版），支持文生视频、图生视频、视频 Remix，含任务查询；适合需要 AI 视频创作、参考图驱动生成或对已有视频进行局部编辑的场景。
license: MIT
---

## 能力概述

基于 Azure OpenAI Sora 2 模型的高质量视频生成服务，提供四个核心接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| Create Video | POST | 文生视频 / 图生视频（可选参考图 input_reference） |
| Video from Reference | POST | 以参考图像为首帧锚点生成视频（强制匹配分辨率） |
| Remix Video | POST | 对已完成视频做局部修改，保留原始结构 |
| Query Status | POST | 查询任务进度，获取 video_url |

**支持分辨率：** `720x1280`（竖屏）、`1280x720`（横屏）
**支持时长：** 4 / 8 / 12 秒
**内容限制：** 仅限 18 岁以下适龄内容，不得包含版权角色/真实人物/背景音乐版权内容

**典型工作流：**
1. 调用 Create Video / Video from Reference / Remix Video 获得 `video_id`
2. 轮询 Query Status 直至 `status === "completed"`
3. 从 `video_url` 下载视频并转存至 Supabase Storage

**平台差异：**

| 项 | Web | MiniProgram |
|----|-----|-------------|
| 视频展示 | `<video src={publicUrl}>` | `<Video src={publicUrl}>` (Taro) |
| 文件上传（参考图） | `FormData + File` | `Taro.chooseImage → uploadFile` |
| Edge Function 调用 | `fetch` 或 `supabase.functions.invoke` | `supabase.functions.invoke` |

---

## 生成期用法（Agent 直接调用）

适用于 Agent 在代码生成阶段直接发起 HTTP 请求，无需 Edge Function 中转。
详见 `references/sora-video-generation-api.md` 中的"生成期代码"章节。

**完整异步轮询模式：**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

// 1. 发起视频生成任务（文生视频示例）
async function createVideo(
  prompt: string,
  size: "720x1280" | "1280x720" = "720x1280",
  seconds: 4 | 8 | 12 = 8,
): Promise<string> {
  const form = new FormData();
  form.append("model", "sora-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", String(seconds));

  const res = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6Jew6JjAqa-gateway.appmiaoda.com/openai/v1/videos",
    {
      method: "POST",
      headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(`Create video failed: ${res.status}`);
  const json = await res.json();
  return json.id as string; // video_id
}

// 2. 查询任务状态
async function queryVideoStatus(videoId: string): Promise<{
  status: string;
  progress: number;
  video_url?: string;
}> {
  const res = await fetch(
    "https://app-cblk1rqa5fk1-api-M9v0w87KjxoY-gateway.appmiaoda.com/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ video_id: videoId }),
    },
  );
  if (!res.ok) throw new Error(`Query failed: ${res.status}`);
  return res.json();
}

// 3. 完整异步轮询工作流
async function generateVideoAndWait(prompt: string): Promise<string> {
  const videoId = await createVideo(prompt);

  const POLL_INTERVAL_MS = 8000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryVideoStatus(videoId);
    if (result.status === "completed") {
      if (!result.video_url) throw new Error("completed but no video_url");
      return result.video_url;
    }
    if (result.status === "failed") {
      throw new Error(`Video generation failed for ${videoId}`);
    }
    if (result.status === "cancelled") {
      throw new Error(`Video generation cancelled for ${videoId}`);
    }
    // queued / in_progress → 继续轮询
    console.log(`Progress: ${result.progress}% (${result.status})`);
  }
  throw new Error(`Video ${videoId} timed out after 10 minutes`);
}
```

**生成期文件下载（必须执行）：**

生成接口返回的 `video_url` 是 CDN 临时链接，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<video_url>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取 `video_url`
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内调用需通过 Supabase Edge Function 中转，平台密钥 `INTEGRATIONS_API_KEY` 仅在服务端可见。
生成完成后视频 URL 转存至 Supabase Storage，向客户端返回持久化的 `publicUrl`。

**各接口完整实现详见：**
`references/sora-video-generation-api.md`

**前端调用摘要（Web）：**

```typescript
// 发起视频生成，获取 video_id
const { data, error } = await supabase.functions.invoke("sora-create-video", {
  body: { prompt: "A cat riding a motorcycle at night", size: "1280x720", seconds: 8 },
});
if (error) throw error;
const videoId = data.videoId;

// 轮询状态
const POLL_INTERVAL_MS = 8000;
while (true) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  const { data: statusData } = await supabase.functions.invoke("sora-query-video", {
    body: { video_id: videoId },
  });
  if (statusData.status === "completed") {
    setVideoUrl(statusData.publicUrl); // Supabase Storage URL
    break;
  }
  if (statusData.status === "failed") throw new Error("Video generation failed");
  if (statusData.status === "cancelled") throw new Error("Video generation cancelled");
  setProgress(statusData.progress);
}
```

**前端调用摘要（MiniProgram/Taro）：**

```typescript
// 同 Web，supabase.functions.invoke 在 Taro 中可用
// 视频展示使用 Taro <Video> 组件
import { Video } from "@tarojs/components";
<Video src={videoUrl} controls autoPlay={false} />
```

详细的 Edge Function 代码（含 Supabase Storage 转存）、参考图上传（图生视频）、
Remix 接口用法见 `references/sora-video-generation-api.md`。
