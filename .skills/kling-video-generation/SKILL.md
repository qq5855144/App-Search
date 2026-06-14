---
name: kling-video-generation
description: 使用可灵 Omni 模型创建视频生成任务，支持文生视频、图生视频、视频编辑、多镜头等多种模式；轮询查询任务状态直到视频生成完成。
license: MIT
---

## 能力概述

基于可灵 Omni（`kling-video-o1` / `kling-v3-omni`）模型的视频生成能力，支持：

- **文生视频**：纯文本提示词生成视频
- **图生视频**：以参考图片为首帧/尾帧或主体参考生成视频
- **视频编辑（指令转换）**：对已有视频进行内容增删改、切换视角等编辑操作
- **视频参考**：参考视频内容生成下一/上一个镜头，或参考运镜方式生成新视频
- **主体参考**：基于主体库中的图片或视频主体生成视频
- **多镜头视频**：通过分镜提示词生成多个镜头连续的视频

| 属性 | 值 |
|------|----|
| 服务商 | KlingAI（快手可灵） |
| 模型 | `kling-video-o1`（默认）、`kling-v3-omni` |
| 响应方式 | 异步轮询（提交任务 → 轮询状态 → 获取结果） |
| 视频时长 | 3–15 秒（视频编辑时跟随输入视频时长） |
| 视频宽高比 | 16:9、9:16、1:1 |
| 生成模式 | `std`（标准）、`pro`（高品质，默认） |
| 视频返回 | 视频 URL（含水印版和无水印版），需转存至 Supabase Storage |
| 计费 | 折扣价 400 元，原价 480 元 |

**端点：**
- 创建任务：`POST https://app-cblk1rqa5fk1-api-oLpZb03wbNBa-gateway.appmiaoda.com/v1/videos/omni-video`
- 查询任务：`GET https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/{task_id}`

---

## 完整异步工作流

此 API 为**异步**模式，必须先提交任务获取 `task_id`，再轮询查询接口直到 `task_status` 为 `succeed` 或 `failed`。

```typescript
// 完整异步工作流：提交任务 → 轮询 → 获取结果
const apiKey = Deno.env.get("INTEGRATIONS_API_KEY")!;

interface VideoTask {
  taskId: string;
}

interface VideoResult {
  taskId: string;
  status: string;
  videos?: Array<{
    id: string;
    url: string;
    watermarkUrl: string;
    duration: string;
  }>;
}

async function generateVideoAndWait(
  submitFn: () => Promise<VideoTask>
): Promise<VideoResult> {
  /**
   * 提交视频生成任务，轮询直到完成或超时。
   * @param submitFn 提交任务的函数，返回 { taskId }
   * @returns 任务结果，含视频 URL 列表
   */
  const { taskId } = await submitFn();

  const POLL_INTERVAL_MS = 7000;        // 每 7 秒轮询一次
  const TIMEOUT_MS = 10 * 60 * 1000;   // 最长等待 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const queryResp = await fetch(
      `https://app-cblk1rqa5fk1-api-o9wN0pyVE2ea-gateway.appmiaoda.com/v1/videos/omni-video/${taskId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    if (!queryResp.ok) throw new Error(`查询请求失败：${queryResp.status}`);
    const queryJson = await queryResp.json();
    if (queryJson.code !== 0) throw new Error(`API 错误 ${queryJson.code}：${queryJson.message}`);

    const { task_status, task_result } = queryJson.data;

    if (task_status === "succeed") {
      return {
        taskId,
        status: "succeed",
        videos: task_result?.videos?.map((v: { id: string; url: string; watermark_url: string; duration: string }) => ({
          id: v.id,
          url: v.url,
          watermarkUrl: v.watermark_url,
          duration: v.duration,
        })),
      };
    }

    if (task_status === "failed") {
      throw new Error(`任务失败 (taskId: ${taskId})`);
    }

    // submitted / processing → 继续轮询
  }

  throw new Error(`任务 ${taskId} 超时（等待超过 10 分钟）`);
}
```

---

## 生成期用法（Agent 直接调用）

使用平台注入的 `INTEGRATIONS_API_KEY` 直接调用上游接口。

详见 `references/omni-video-create-api.md`（创建任务）和 `references/omni-video-query-api.md`（查询任务）。

**快速示例——文生视频：**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

// 1. 提交创建任务
const createResp = await fetch(
  "https://app-cblk1rqa5fk1-api-oLpZb03wbNBa-gateway.appmiaoda.com/v1/videos/omni-video",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model_name: "kling-video-o1",
      prompt: "一只橘猫在草地上慵懒地打滚",
      mode: "pro",
      aspect_ratio: "16:9",
      duration: "5",
    }),
  }
);
const createJson = await createResp.json();
const taskId = createJson.data.task_id;

// 2. 轮询直到完成（使用上方 generateVideoAndWait 封装）
const result = await generateVideoAndWait(() => Promise.resolve({ taskId }));
console.log("视频 URL：", result.videos?.[0]?.url);
```

**生成期文件下载（必须执行）：**

生成接口返回的 URL 是 CDN 临时链接，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<生成的文件 URL>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取文件 URL
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内需要两个 Edge Function：

| Edge Function | 文件 | 说明 |
|---------------|------|------|
| `kling-video-create` | `references/omni-video-create-api.md` | 提交视频生成任务，返回 `task_id` |
| `kling-video-query` | `references/omni-video-query-api.md` | 查询任务状态；任务成功时将视频转存至 Supabase Storage 并返回持久化 URL |

前端实现**提交 + 轮询**两步 UI：
1. 点击"生成"按钮 → 调用 `kling-video-create` Edge Function，获取 `task_id`
2. 前端定时轮询（每 7 秒）`kling-video-query` Edge Function，直到返回 `status: "succeed"` 并展示视频

详见 `references/omni-video-create-api.md` 和 `references/omni-video-query-api.md`。
