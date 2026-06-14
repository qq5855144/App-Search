---
name: multimodal-llm
description: 调用文心一言多模态大模型，支持文本与图片混合输入，以 SSE 流式方式返回 AI 生成内容。适用于图文分析、拍照解题、智能客服等多模态 AI 场景。
license: MIT
---

## 能力概述

调用百度千帆平台文心一言多模态大模型（ERNIE 4.5 Turbo VL），通过统一 Chat Completions 接口，支持将文本与图片混合传入，以 SSE 流式方式逐块返回模型生成内容。

| 维度 | 说明 |
|------|------|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-k93RZBjPykEa-gateway.appmiaoda.com/v2/chat/completions` |
| 认证模式 | `platform_managed`（密钥由平台注入，无需用户配置） |
| 流式协议 | SSE（Server-Sent Events），每块为 `data: {...}` 格式 |
| 图片格式 | JPG / JPEG / PNG / BMP，单图不超过 10 MB |
| 上下文限制 | 32k token（单次最大 27k token） |
| 计费单价 | 原价 ¥0.60 / 千次，优惠价 ¥0.45 / 千次 |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。


**多平台实现差异：**

| 平台 | 图片处理方式 | 流式接收方式 |
|------|------------|------------|
| Web | 原生 `fetch` + `eventsource-parser` 解析 SSE | `sendStreamRequest` 工具函数 |
| MiniProgram | `imageToBase64` 转 Base64（H5/weapp 双环境兼容） | `sendChatStream`（`miaoda-taro-utils`） |
| App | `expo-image-picker` 获取图片 → base64 传入 | `expo/fetch` + `eventsource-parser` 处理 SSE（必须使用 `expo/fetch`，RN 原生 fetch 不支持流式 `response.body`） |

完整实现代码、参数表及各平台 Edge Function 详见 `references/chat-completions-api.md`。

---

## 生成期用法（Agent 直接调用）

在生成期脚本中直接调用上游 API，适用于快速验证或服务端批处理场景。

详细生成期代码（含完整参数、响应解析）见 `references/chat-completions-api.md` → **生成期代码** 小节。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用运行期通过 Supabase Edge Function 代理上游 SSE 流。Edge Function 负责注入 `INTEGRATIONS_API_KEY`，前端通过 SSE 工具库实时接收流式内容。

- **Web 端**：`sendStreamRequest`（`ky` + `eventsource-parser`）
- **MiniProgram 端**：`sendChatStream`（`miaoda-taro-utils`），图片必须先用 `imageToBase64` 转为 Base64

详细 Edge Function 代码、前端调用代码及平台特有注意事项见 `references/chat-completions-api.md` → **Edge Function 代码** 和 **前端调用代码** 小节。
