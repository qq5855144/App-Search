---
name: minimax-chat
description: 调用 MiniMax-M2.5 模型进行文本对话补全，支持多轮对话、工具调用、流式输出、图文混合输入及结构化输出，适用于构建智能助手、内容生成、文档摘要等场景。
license: MIT
---

## 能力概述

基于 MiniMax-M2.5 推理模型提供文本对话补全能力。

| 属性 | 值 |
|------|----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Aa2PqMJnJGwL-gateway.appmiaoda.com/v1/text/chatcompletion_v2` |
| 认证方式 | Platform Managed（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/json` |
| 支持平台 | Web、MiniProgram |
| 计费 | 免费（original_price: 0.00） |

**核心能力：**
- 多轮对话：通过 `messages` 数组传递完整对话历史
- 工具调用：支持 function calling，可与外部工具集成
- 流式输出：设置 `stream: true` 后以 SSE 分块返回
- 图文混合输入：`content` 支持 `string` 或 `[{type, text/image_url}]` 两种格式
- 结构化输出：通过 `response_format` 指定 JSON Schema

**响应示例（非流式）：**
```json
{
  "id": "04ecb5d9b1921ae0fb0e8da9017a5474",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "您好！请问有什么可以帮您？",
        "role": "assistant"
      }
    }
  ],
  "created": 1755153113,
  "model": "MiniMax-M2.5",
  "object": "chat.completion",
  "usage": {
    "total_tokens": 249,
    "prompt_tokens": 26,
    "completion_tokens": 223
  },
  "input_sensitive": false,
  "output_sensitive": false,
  "base_resp": { "status_code": 0, "status_msg": "" }
}
```

详见 [references/chatcompletion-api.md](references/chatcompletion-api.md)

---

## 生成期用法（Agent 直接调用）

通过平台注入的密钥直接调用上游 API，适合在生成脚本中使用。

详见 [references/chatcompletion-api.md — 生成期代码](references/chatcompletion-api.md#生成期代码)

---

## 生成后用法（应用内通过 Edge Function 调用）

将上游请求封装在 Edge Function 中，密钥不暴露给前端。Web 和 MiniProgram 的流式处理方式不同：

| 平台 | Edge Function | 前端方式 |
|------|--------------|---------|
| Web | 支持直接 SSE 流式透传或非流式 JSON | 非流式用 `supabase.functions.invoke`；流式用原生 `fetch` + SSE 解析 |
| MiniProgram | 同 Web Edge Function | 用 `supabase.functions.invoke`；流式需特殊处理 |

详见 [references/chatcompletion-api.md — Edge Function 代码](references/chatcompletion-api.md#edge-function-代码)
