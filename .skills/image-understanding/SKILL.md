---
name: image-understanding
description: 对图片内容进行多维度理解与问答，识别人物、物体、场景、文字等，适用于图片打标签、内容分析、物体识别场景。
license: MIT
---

## 能力概述

图像内容理解插件基于百度 AI 图像理解能力，支持输入图片（Base64 或 URL）和提问信息，对图片进行多维度识别与理解，包括人、物、行为、场景、文字等，并返回自然语言描述。

**接口概览（注意：两个接口的 API ID 不同，不可混用）：**

| 接口 | API ID | 路径 | 说明 |
|------|--------|------|------|
| 提交请求 | `api-DYJwo27V85oa` | `.../image-understanding/request` | 提交图片和问题，返回 `task_id` |
| 查询结果 | `api-zYkZz8qoKDdL` | `.../image-understanding/get-result` | 用 `task_id` 轮询，获取识别描述 |

**工作流（异步轮询）：**

1. 调用"提交请求"接口，传入图片（Base64 或 URL）和问题，获得 `task_id`
2. 用 `task_id` 调用"查询结果"接口，检查 `ret_code`：
   - `0`：处理成功，取 `description` 字段
   - `1`：处理中，等待后重试
3. 轮询直到成功或超时

**参数限制：**
- `question`：不超过 100 个字符，超出返回 `input text length invalid (282501)`
- 图片格式：JPG/JPEG/PNG/BMP/WEBP，大小不超过 10M，最短边 ≥ 64px，最长边 ≤ 8192px，超过 4096px 自动压缩

**认证模式：** `platform_managed` — 密钥由平台注入，读取自 `INTEGRATIONS_API_KEY` 环境变量。
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**异步轮询模式参考代码：**

```typescript
async function imageUnderstandingAndWait(
  question: string,
  imageBase64?: string,
  imageUrl?: string
): Promise<string> {
  const { taskId } = await submitImageUnderstanding(question, imageBase64, imageUrl);

  const POLL_INTERVAL_MS = 3000;
  const TIMEOUT_MS = 3 * 60 * 1000; // 3 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await getImageUnderstandingResult(taskId);
    if (result.retCode === 0) return result.description;
    if (result.retCode !== 1) throw new Error(`Task failed with ret_code: ${result.retCode}`);
    // ret_code === 1: 处理中，继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 3 minutes`);
}
```

## 生成期用法（Agent 直接调用）

共两个接口，详见：

- `references/image-understanding-request-api.md` — 提交图像理解请求
- `references/image-understanding-result-api.md` — 查询图像理解结果

## 生成后用法（应用内通过 Edge Function 调用）

必须为两个接口**分别**部署 Edge Function，轮询循环放在**前端**：

| Edge Function | 功能 | API ID |
|---------------|------|--------|
| `image-understanding-request` | 提交图片和问题，返回 `task_id` | `api-DYJwo27V85oa` |
| `image-understanding-result` | 用 `task_id` 查询识别结果 | `api-zYkZz8qoKDdL` |

前端先调用 `image-understanding-request` 获取 `task_id`，再轮询 `image-understanding-result` 直至 `ret_code === 0`。

**禁止将提交和轮询合并到同一个 Edge Function** — Supabase Edge Function 有执行时间上限（60-150 秒），而图像理解任务可能需要更长时间。轮询循环放在前端，每次查询都是独立的短请求，不受 Edge Function 超时限制。

Edge Function 调用方式相同（`supabase.functions.invoke`），但**图片获取方式因平台而异**：

| 平台 | 图片来源 | 传参方式 |
|------|---------|---------|
| Web | `File` 对象 / `<input>` | `FileReader.readAsDataURL()` 转 base64 → 传 `image` 字段 |
| MiniProgram | `wxfile://` 临时路径 | `Taro.getFileSystemManager().readFile({encoding:'base64'})` 回调式读取 → 传 `image` 字段 |
| App | `expo-image-picker` 选取图片 | `ImagePicker.launchImageLibraryAsync({ base64: true })` 获取 base64 → 传 `image` 字段 |

**小程序不能将 `wxfile://` 临时路径作为 `url` 字段传给 API** — 临时路径仅存在于设备本地，外部 API 无法访问，会返回 `image fetch failed (282115)`。必须先读取为 base64 再通过 `image` 字段传递。

**App 同理，不能将本地图片 URI（`file://...`）传给 `url` 字段** — 使用 `expo-image-picker` 时指定 `base64: true` 直接获取纯 Base64，通过 `image` 字段传递。

详见：

- `references/image-understanding-request-api.md`
- `references/image-understanding-result-api.md`
