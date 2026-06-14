---
name: ai-ppt-generator
description: 根据用户输入的主题自动生成完整 PPT 文件，返回封面图和下载链接；适用于办公汇报、教学课件、产品展示等需要快速生成 PPT 的场景。
license: MIT
---

## 能力概述

基于百度文库 AI 能力，根据输入的主题文本自动生成包含标题、大纲和封面的完整 PPT 文档。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-l9nZz8ro3my9-gateway.appmiaoda.com/v2/tools/ai_command_ppt/command_ppt`
- **认证**：platform_managed（`X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>`）
- **请求体**：JSON，仅需 `query` 字段（PPT 主题内容）
- **响应形式**：流式返回多条 JSON 行
  - 构建阶段（`result_type=1`）：每行包含当前累积的标题和大纲
  - 完成阶段（`result_type=0`）：包含 `cover_urls`（封面图列表）和 `ppt_url`（下载链接，有效期 45 天）
- **注意**：`ppt_url` 中的 `\u0026` 需替换为 `&` 才能正常下载

| 平台 | Edge Function 特点 | 前端调用方式 |
|------|-------------------|-------------|
| Web | 流式代理，最终返回 JSON（含封面公开 URL + ppt_url） | `supabase.functions.invoke` |
| MiniProgram | 同 Web | `supabase.functions.invoke` |

详见 `references/command-ppt-api.md`。

## 生成期用法（Agent 直接调用）

适用于在 Deno 脚本或 Agent 工具中直接调用 API 生成 PPT。完整参数说明和代码实现详见
`references/command-ppt-api.md`。

## 生成后用法（应用内通过 Edge Function 调用）

应用内调用需通过 Edge Function 代理，以保护 `INTEGRATIONS_API_KEY` 不暴露给客户端。
Edge Function 负责消费上游流式响应、转存封面图到 Supabase Storage，并将最终结果以 JSON
一次性返回给前端。

完整 Edge Function 代码、前端调用代码及注意事项详见 `references/command-ppt-api.md`。
