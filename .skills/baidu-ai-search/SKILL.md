---
name: baidu-ai-search
description: 百度千帆AI搜索，实时检索全网网页/视频内容，返回结构化引用列表（标题/URL/摘要/日期）。用户需要实时信息、新闻、网页检索时使用。
license: MIT
---

## 能力概述

百度AI搜索核心接口，向 `POST https://app-cblk1rqa5fk1-api-DYJwo27V8Qya-gateway.appmiaoda.com/v2/ai_search/chat/completions`
发送多轮对话消息，调用百度大模型搜索全网实时信息并以 **HTTP SSE 流式** 方式返回智能总结、引用来源、
推理过程及追问建议。

| 维度 | 说明 |
|------|------|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DYJwo27V8Qya-gateway.appmiaoda.com/v2/ai_search/chat/completions` |
| 响应方式 | HTTP SSE 流式（text/event-stream） |
| 认证 | platform_managed（`X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>`） |
| 多平台差异 | Web、MiniProgram、App 的 SSE 前端消费方式不同，详见 references/ |

**核心能力：**
- 多轮对话搜索（messages 数组，user/assistant 交替）
- 多模态资源过滤（web / image / video，可配置各模态返回数量）
- 深度搜索（enable_deep_search，最多 10 次智能搜索）
- 深度思考（enable_reasoning，支持 DeepSeek-R1 / 文心X1）
- 图文混排输出（response_format=rich_text）
- 智能追问建议（enable_followup_queries）
- 按发布时间筛选（search_recency_filter：week / month / semiyear / year）

---

## 生成期用法（Agent 直接调用）

此接口为 SSE 流式接口，生成期直接调用时需逐行读取 SSE 事件并累积 `choices[].delta.content`。

完整参数说明及生成期代码详见 [references/ai-search-api.md](references/ai-search-api.md)。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内需部署 Edge Function 作为代理层，将 `INTEGRATIONS_API_KEY` 保存在服务端，
前端通过 Edge Function 获取 SSE 流。

**平台差异概览：**

| 平台 | Edge Function | 前端消费方式 |
|------|--------------|-------------|
| Web | 直接 proxy SSE 流（不缓冲） | `ky` + `eventsource-parser` 处理 SSE |
| MiniProgram | 直接 proxy SSE 流（不缓冲） | `miaoda-taro-utils` 的 `sendStream`（`ky`/`eventsource-parser` 在 weapp 不可用） |
| App | 直接 proxy SSE 流（不缓冲） | `expo/fetch` + `eventsource-parser` 处理 SSE（必须使用 `expo/fetch`，RN 原生 fetch 不支持流式 `response.body`） |


Edge Function 完整代码、前端 SSE 工具函数及各平台调用示例详见
[references/ai-search-api.md](references/ai-search-api.md)。
