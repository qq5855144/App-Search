---
name: minimax-m3
description: 调用 MiniMax Chat Completions API，使用 MiniMax-M3 进行文本对话、图片理解、视频理解、深度思考、工具调用和流式输出，适用于智能助手、Agent、内容生成、代码与多模态理解场景。
license: MIT
---

## 能力概述

基于 MiniMax-M3 的 Chat Completions API，提供文本对话、多模态理解、深度思考、工具调用和 SSE 流式输出能力。

| 属性 | 值 |
|------|----|
| 主调用接口 | `POST https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions` |
| Endpoint 形式 | `https://{APP_ID}@app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions` |
| 官方来源接口 | `POST https://app-cblk1rqa5fk1-api-rLobPAn0n7m9-gateway.appmiaoda.com/v1/chat/completions`（仅用于接口来源说明，Skill 调用使用上方 `APP_ID@` 网关形式） |
| 认证方式 | Platform Managed（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/json` |
| 默认模型 | `MiniMax-M3` |
| 支持平台 | Web、MiniProgram |
| 计费 | 免费（billing_mode: free） |

**适用场景：**
- 智能助手、Agent 和多轮对话应用
- 代码生成、代码解释和 Agentic 工作流
- 文档摘要、内容生成、信息抽取和结构化输出
- 图片理解、视频理解和图文/视频混合输入
- 需要 SSE 实时输出的 Web 对话界面

**核心能力：**
- Chat Completions：使用 `/v1/chat/completions` 风格的 `messages`、`tools` 和 `stream` 参数
- MiniMax-M3：支持 1M 超长上下文、Coding/Agentic 能力和多模态理解
- 深度思考：通过 `thinking.type` 控制 `disabled` 或 `adaptive` 思考模式
- 思考拆分：通过 `reasoning_split: true` 将思考内容拆分到 `reasoning_content` 和 `reasoning_details`
- 多模态输入：`content` 支持文本、图片 `image_url` 和视频 `video_url` 内容块
- 工具调用：支持 function calling，模型可返回 `tool_calls` 并要求继续回填工具结果
- 流式输出：设置 `stream: true` 后以 SSE 分块返回，可通过 `stream_options.include_usage` 获取最终 usage

**推荐请求配置：**
```json
{
  "model": "MiniMax-M3",
  "thinking": { "type": "adaptive" },
  "messages": [
    { "role": "user", "content": "请用一句话介绍 MiniMax-M3。" }
  ],
  "temperature": 1,
  "top_p": 0.95,
  "max_completion_tokens": 131072
}
```

详见 [references/chatcompletion-api.md](references/chatcompletion-api.md)

---

## 生成期用法（Agent 直接调用）

通过平台注入的 `${INTEGRATIONS_API_KEY}` 调用托管网关接口，适合在生成脚本或 Agent 工具中直接使用。不要在 Skill 文档或客户端代码中写入真实密钥。

详见 [references/chatcompletion-api.md — 生成期代码](references/chatcompletion-api.md#生成期代码)

---

## 生成后用法（应用内通过 Edge Function 调用）

将上游请求封装在 Edge Function 中，密钥只在服务端读取，不暴露给 Web 或 MiniProgram 前端。

| 平台 | Edge Function | 前端方式 |
|------|--------------|---------|
| Web | 支持非流式 JSON 和 SSE 流式透传 | 非流式用 `supabase.functions.invoke`；流式用原生 `fetch` 读取 `ReadableStream` |
| MiniProgram | 支持非流式 JSON；流式能力取决于运行时 | 推荐非流式；如需流式效果可用轮询或分段请求模拟 |

详见 [references/chatcompletion-api.md — Edge Function 代码](references/chatcompletion-api.md#edge-function-代码)
