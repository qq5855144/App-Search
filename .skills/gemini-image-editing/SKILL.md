---
name: gemini-image-editing
description: 基于 Gemini 模型的 AI 图片生成与编辑，支持文本指令驱动背景替换、元素修改、风格调整，返回 Base64 图片。适合应用内高频图片生产场景。
license: MIT
---

## 能力概述

调用 Google Gemini 多模态模型对图片进行 AI 驱动的智能编辑，支持通过中文文本指令实现背景替换、元素修改、风格调整等操作，返回 Base64 编码的 PNG 图片及 Token 消耗统计。

| 属性 | 值 |
|------|-----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-o9wN0AExZQ8a-gateway.appmiaoda.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent` |
| Content-Type | `application/json` |
| 认证模式 | `platform_managed`（密钥由平台注入，读取 `INTEGRATIONS_API_KEY`） |
| 响应格式 | JSON，图片以 Base64 编码内嵌于 `candidates[].content.parts[].inlineData.data` |
| 支持平台 | Web、MiniProgram |

**平台差异概览：**

| 平台 | Edge Function 返回 | 前端获取图片方式 |
|------|-------------------|----------------|
| Web | JSON（含 Base64） | 解析 JSON，构造 `data:image/png;base64,...` URI 或用 Blob 渲染 |
| MiniProgram | JSON（含 Base64） | 解析 JSON，写临时文件后用 `<image>` 组件展示 |

详细参数说明、代码示例及两平台完整实现见 [references/gemini-image-edit-api.md](references/gemini-image-edit-api.md)。

---

## 生成期用法（Agent 直接调用）

本接口请求体含嵌套数组和 Base64 图像数据，完整实现见 [references/gemini-image-edit-api.md](references/gemini-image-edit-api.md) 的「生成期代码」章节。

简要说明：
1. 将待编辑图片压缩至 ≤ 5 MB 后做 Base64 编码。
2. 构造 `contents[0].parts` 数组，第一个元素为 `text`（中文编辑指令），第二个元素为 `inlineData`（含 `mimeType` 和 Base64 数据）。
3. 用 `X-Gateway-Authorization: Bearer ${apiKey}` 鉴权，调用 `POST` 接口。
4. 从响应 `candidates[0].content.parts` 中找到含 `inlineData` 的元素，取出 `data` 字段（Base64 PNG）。

**生成期文件保存（必须执行）：**

本接口直接返回 **Base64 编码的 PNG 图片**（不含 URL），在生成期（Agent 直接调用场景）获得 Base64 数据后，**必须立即使用 Bash 工具将其解码并保存到本地**，以便用户查看结果。

```bash
echo "<base64_data>" | base64 -d > <本地路径>.png
```

**完整生成期工作流（含保存步骤）：**

1. 从响应 `candidates[0].content.parts` 中找到含 `inlineData` 的元素，取出 `data` 字段（纯 Base64 PNG 字符串）
2. 使用 Bash 工具将 Base64 解码并保存到本地：`echo "<base64>" | base64 -d > <本地路径>.png`
3. 告知用户图片已保存到对应路径

> **注意**：Base64 图片仅存在于当次响应中，必须及时保存，否则数据丢失。

---

## 生成后用法（应用内通过 Edge Function 调用）

前端将图片 Base64 和编辑指令发送给 Edge Function，Edge Function 注入平台密钥后转发至上游，将 Base64 图片 JSON 原路返回给前端。

Web 和 MiniProgram 的 Edge Function 逻辑相同（均返回 JSON），前端处理图片的方式略有不同：
- **Web**：直接用 Base64 构造 `<img>` 的 `src`，或转 Blob 展示。
- **MiniProgram**：需写入临时文件后用 `<image>` 组件展示（weapp 真机不支持 `data:` URI 直接渲染）。

完整 Edge Function 代码、前端调用代码及错误处理见 [references/gemini-image-edit-api.md](references/gemini-image-edit-api.md) 的「Edge Function 代码」和「前端调用代码」章节。
