---
name: kling-omni-image-generation
description: 基于可灵 Kling Omni 模型文生图或参考图生图，支持多种分辨率和画面比例，生成结果需轮询获取；适用于创意设计、宣传海报制作、日常作图等场景
license: MIT
---

## 能力概述

该 Skill 调用可灵 Omni 图像生成接口，支持 kling-image-o1 和 kling-v3-omni 两种模型，
通过文本提示词、参考图片或主体库 ID 生成 1K/2K 高清图像，支持单图（single）和组图（series）两种结果模式。

**工作流：异步任务 — 提交 → 轮询 → 获取结果**

| 步骤 | API | Endpoint |
|------|-----|----------|
| 1. 创建图像生成任务 | 创建图像生成任务 | POST `https://app-cblk1rqa5fk1-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/images/omni-image` |
| 2. 查询图像生成任务 | 查询单个图像生成任务 | GET `https://app-cblk1rqa5fk1-api-79jK6nw4zxDL-gateway.appmiaoda.com/v1/images/omni-image/{id}` |
| 3. 创建图像生成任务（图像编辑入口） | 创建图像生成任务（图像编辑） | POST `https://app-cblk1rqa5fk1-api-eLMlPzV7qWJ9-gateway.appmiaoda.com/v1/images/omni-image` |

**核心能力：**
- 支持模型：kling-image-o1（默认）、kling-v3-omni
- 分辨率：1k（默认）、2k
- 生成类型：single（单图，n 张，1~9）/ series（组图，series_amount 张，2~9）
- 画面比例：16:9、9:16、1:1、4:3、3:4、3:2、2:3、21:9、auto（默认 9:16）
- 可附加参考图（image_list，支持 Base64 或 URL）和主体库引用（element_list）
- 返回图像 URL（有效期 30 天，需及时转存）

**重要约束：**
- `result_type = single` 时：**不得传 `series_amount`**
- `result_type = series` 时：**必须传 `series_amount`（范围 [2, 9]）**
- `image_list` 格式必须为对象数组：`[{"image": "base64 or URL"}]`，禁止直接传字符串数组
- Base64 编码不得含 `data:image/jpeg;base64,` 等前缀

**多平台差异：**

| 项目 | Web | MiniProgram |
|------|-----|-------------|
| Edge Function 图片转存 | Appendix A（Supabase Storage 转存） | 同 Web |
| 前端调用方式 | `supabase.functions.invoke` | `supabase.functions.invoke` |
| 图片展示 | `<img src={publicUrl} />` | `<Image src={publicUrl} />` |

**计费：** 折扣价 8.00，原价 12.00，单位：元/单次（具体以平台计费页面为准）。

---

## 生成期用法（Agent 直接调用）

完整异步工作流，详见 `references/omni-image-api.md`。

典型流程：

```typescript
// 完整异步工作流：提交 → 轮询 → 结果
async function generateAndWait(prompt: string): Promise<string[]> {
  // Step 1: 提交创建任务
  const { taskId } = await submitOmniImageTask(prompt);

  // Step 2: 轮询直到成功或失败
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryOmniImageTask(taskId);
    if (result.task_status === "succeed") {
      return result.task_result.images.map((img: { url: string }) => img.url);
    }
    if (result.task_status === "failed") {
      throw new Error(`Task failed: ${result.task_status_msg}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

详见 `references/omni-image-api.md` 中的完整生成期代码（含所有参数）。

**生成期文件下载（必须执行）：**

生成接口返回的 URL 是 CDN 临时链接，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<生成的文件 URL>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取文件 URL（可能为多个，逐一下载）
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内分两个 Edge Function：

1. **`kling-omni-image-submit`** — 接收前端请求，调用创建任务接口，返回 `task_id`
2. **`kling-omni-image-query`** — 接收 `task_id`，查询任务状态和结果，成功时将图片 URL 转存至
   Supabase Storage 并返回 `publicUrl` 列表

前端轮询逻辑在应用层实现（提交后每 7 秒轮询一次，超时 10 分钟）。

**Web 和 MiniProgram 平台共用相同的 Edge Function，前端均通过 `supabase.functions.invoke` 调用。**

详见 `references/omni-image-api.md` 中的完整 Edge Function 和前端代码。
