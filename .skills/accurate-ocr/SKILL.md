---
name: accurate-ocr
description: 调用百度通用文字识别高精度版 OCR，对图片全部文字内容进行高精度检测识别，支持中英日韩等 20+ 语种，适用于文档数字化、多语言文本提取场景。
license: MIT
---

## 能力概述

调用百度 AI 开放平台通用文字识别（高精度版）接口，对上传图片中的全部文字内容进行检测与识别。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-eLMlJ2jB44g9-gateway.appmiaoda.com/rest/2.0/ocr/v1/accurate_basic`
- **Content-Type**：`application/x-www-form-urlencoded`
- **认证模式**：`platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`）
- **核心能力**：高精度文字识别，字库扩展到 2w+，支持 auto_detect、CHN_ENG、ENG、JAP、KOR、FRE 等 20+ 语种
- **响应格式**：JSON，返回识别文字数组 `words_result[]` 及段落信息
- **支持平台**：Web、MiniProgram

> 详细参数表、响应字段、代码实现，见 `references/accurate-basic-api.md`

## 生成期用法（Agent 直接调用）

直接在脚本中调用 OCR 接口，传入 Base64 编码的图片即可获取识别结果。

详见 `references/accurate-basic-api.md` — **生成期代码** 小节。

## 生成后用法（应用内通过 Edge Function 调用）

在 Web 或 MiniProgram 应用中，通过 Supabase Edge Function 代理调用，避免将 `INTEGRATIONS_API_KEY` 暴露给客户端。

| 平台 | Edge Function 差异 | 前端调用方式 |
|------|-------------------|-------------|
| Web | 标准 JSON 响应 | `supabase.functions.invoke` 或原生 `fetch` |
| MiniProgram | 标准 JSON 响应 | `supabase.functions.invoke` |

详见 `references/accurate-basic-api.md` — **Edge Function 代码** 及 **前端调用代码** 小节。
