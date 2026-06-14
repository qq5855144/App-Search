---
name: kling-image-to-video
description: 基于 Kling AI 将参考图片生成音画同步视频，支持首帧/尾帧控制、运动笔刷、摄像机控制；适用于创意内容生成、电商视频化、图片动态化等场景
license: MIT
---

## 能力概述

该 Skill 调用 Kling AI 图生视频（音画同步）接口，根据输入的参考图片和文本提示词生成高质量视频，支持音画同步、运动笔刷、摄像机控制等高级功能。

**工作流：异步任务 — 提交 → 轮询 → 获取结果**

| 步骤 | API | Endpoint |
|------|-----|----------|
| 1. 创建任务 | 图生视频 - 创建任务 | POST `https://app-cblk1rqa5fk1-api-DY8MN3QBydBa-gateway.appmiaoda.com/v1/videos/image2video` |
| 2. 查询单个任务 | 图生视频 - 查询任务（单个） | GET `https://app-cblk1rqa5fk1-api-zYkZzgKook1L-gateway.appmiaoda.com/v1/videos/image2video/{id}` |
| 3. 查询任务列表 | 图生视频 - 查询任务（列表） | GET `https://app-cblk1rqa5fk1-api-n9QVoDJ6oykL-gateway.appmiaoda.com/v1/videos/image2video` |

**核心能力：**
- 支持模型版本：kling-v2-6（及历史版本 kling-v1、kling-v1-5 等）
- 视频时长：5 秒 / 10 秒
- 生成模式：std（标准）/ pro（高品质）
- 支持首帧（image）或首尾帧（image + image_tail）控制
- 支持运动笔刷（static_mask / dynamic_masks）
- 支持音画同步（voice_list + sound，仅 v2.6+）
- 返回视频 URL（有效期 30 天，需及时转存）

**多平台差异：**

| 项目 | Web | MiniProgram |
|------|-----|-------------|
| Edge Function 视频转存 | Appendix A（Storage 转存）| 同 Web |
| 前端调用 | `supabase.functions.invoke` | `supabase.functions.invoke` |
| 视频播放 | `<video src=publicUrl>` | `Taro.createVideoContext` |

**计费：** 创建任务接口按调用次数计费（折扣价 235.00，原价 377.30，单位：元/千次）；查询接口不计费。

---

## 生成期用法（Agent 直接调用）

完整异步工作流，详见 `references/image2video-api.md`。

典型流程：

```typescript
// 完整异步工作流：提交 → 轮询 → 结果
async function generateAndWait(image: string, prompt: string): Promise<string> {
  // Step 1: 提交创建任务
  const { taskId } = await submitImage2VideoTask(image, prompt);

  // Step 2: 轮询直到成功或失败
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryImage2VideoTask(taskId);
    if (result.task_status === "succeed") return result.task_result.videos[0].url;
    if (result.task_status === "failed") {
      throw new Error(`Task failed: ${result.task_status_msg}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

详见 `references/image2video-api.md` 中的完整生成期代码（含所有参数）。

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

应用内分两个 Edge Function：

1. **`kling-image2video-submit`** — 接收前端请求，调用创建任务接口，返回 `task_id`
2. **`kling-image2video-query`** — 接收 `task_id`，查询任务状态和结果，成功时将视频 URL 转存至 Supabase Storage 并返回 `publicUrl`

前端轮询逻辑在应用层实现（提交后每 7 秒轮询一次，超时 10 分钟）。

**Web 和 MiniProgram 平台共用相同的 Edge Function，前端均通过 `supabase.functions.invoke` 调用。**

详见 `references/image2video-api.md` 中的完整 Edge Function 和前端代码。
