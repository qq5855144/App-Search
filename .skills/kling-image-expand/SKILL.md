---
name: kling-image-expand
description: 使用可灵 AI 对图片进行扩图编辑，支持上下左右自由扩展画布，适用于图片尺寸调整、构图优化、海报适配等场景
license: MIT
---

## 能力概述

本 skill 基于可灵 AI 的图像扩展能力，对原始图片在上、下、左、右四个方向按比例扩充画布，并自动填充生成新的图像内容。

| 项目 | 说明 |
|------|------|
| 服务商 | 可灵 AI（Kling AI） |
| 认证模式 | `platform_managed`（密钥由平台注入，读取 `INTEGRATIONS_API_KEY`） |
| 工作流 | 异步任务：提交任务 → 轮询状态 → 获取结果图片 |
| 图片转存 | 任务完成后须将图片 URL 转存至 Supabase Storage（原始 URL 30 天后失效） |
| 支持平台 | Web、MiniProgram |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。


### API 端点

| 功能 | 方法 | 端点 |
|------|------|------|
| 创建扩图任务 | POST | `https://app-cblk1rqa5fk1-api-Q9KWnzwVQMk9-gateway.appmiaoda.com/v1/images/editing/expand` |
| 查询单个任务 | GET  | `https://app-cblk1rqa5fk1-api-rLobR6vwZJJ9-gateway.appmiaoda.com/v1/images/editing/expand/{task_id}` |
| 查询任务列表 | GET  | `https://app-cblk1rqa5fk1-api-AalZkPVdZX8L-gateway.appmiaoda.com/v1/images/editing/expand` |

### 关键约束

- 原图格式：.jpg / .jpeg / .png，文件大小 ≤ 10 MB，宽高 ≥ 300 px，宽高比在 1:2.5 ~ 2.5:1 之间
- 四个方向的扩充倍数均在 [0, 2] 范围内，且扩充后总面积不超过原图的 3 倍
- Base64 传参时，**不要添加 `data:image/png;base64,` 等前缀**，直接传裸 Base64 字符串
- 生成图片 URL 30 天后失效，务必及时转存至 Supabase Storage

---

## 生成期用法（Agent 直接调用）

详见 [references/kling-image-expand-api.md](references/kling-image-expand-api.md) 的"生成期代码"章节。

异步完整工作流（提交 → 轮询 → 获取结果）：

```typescript
// 完整异步工作流：提交任务 → 轮询 → 超时保护
async function expandImageAndWait(
  image: string,
  upRatio: number,
  downRatio: number,
  leftRatio: number,
  rightRatio: number,
  prompt = "",
  n = 1,
): Promise<{ index: number; url: string }[]> {
  const { taskId } = await createExpandTask(image, upRatio, downRatio, leftRatio, rightRatio, prompt, n);

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryExpandTask(taskId);
    if (result.task_status === "succeed") {
      return result.task_result.images;
    }
    if (result.task_status === "failed") {
      throw new Error(`扩图任务失败: ${result.task_status_msg ?? "未知错误"}`);
    }
    // submitted / processing → 继续轮询
  }
  throw new Error(`任务 ${taskId} 超时（10 分钟）`);
}
```

完整函数实现（`createExpandTask`、`queryExpandTask`）及参数说明详见
[references/kling-image-expand-api.md](references/kling-image-expand-api.md)。

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

## 使用示例

将一张竖版图片向左右两侧各扩展约 65%，生成 16:9 横版图：

```typescript
// 原图 100×100，目标宽高比 16:9，扩充后总面积约 3 倍
// 向上/下各扩 0.15，向左/右各扩 0.65
const images = await expandImageAndWait(
  "https://example.com/photo.png", // 图片 URL 或裸 Base64
  0.15,   // up_expansion_ratio
  0.15,   // down_expansion_ratio
  0.65,   // left_expansion_ratio
  0.65,   // right_expansion_ratio
  "蓝天白云，自然延伸", // 可选提示词
  1,      // 生成数量
);

console.log(images[0].url); // 转存后的持久化图片 URL
```

详细参数约束（原图格式、面积上限等）见 [references/kling-image-expand-api.md](references/kling-image-expand-api.md)。

---

## 生成后用法（应用内通过 Edge Function 调用）

详见 [references/kling-image-expand-api.md](references/kling-image-expand-api.md) 的"Edge Function 代码"和"前端调用代码"章节。

### 平台差异对比

| 项目 | Web | MiniProgram |
|------|-----|-------------|
| 调用方式 | `supabase.functions.invoke` 或原生 `fetch` | `supabase.functions.invoke` |
| 图片结果 | 转存后返回 `publicUrl` | 转存后返回 `publicUrl` |
| 异步轮询 | Edge Function 内部循环，前端单次调用 | Edge Function 内部循环，前端单次调用 |

Edge Function 将在内部完成"提交 → 轮询 → 转存"全流程，前端只需发起一次请求并等待最终图片 URL。
