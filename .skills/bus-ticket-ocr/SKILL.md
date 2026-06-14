---
name: bus-ticket-ocr
description: 识别全国范围不同版式汽车票的关键字段（发票代码、票号、日期、金额、出发/到达站等）；适用于财务报销、票据管理、出行记录等需要结构化提取汽车票信息的场景。
license: MIT
---

## 能力概述

调用百度 OCR 汽车票识别接口，对全国范围内不同版式的汽车票进行结构化识别，最多返回 10 个关键字段。

| 属性 | 值 |
|------|-----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Xa6JZxjyqrGa-gateway.appmiaoda.com/rest/2.0/ocr/v1/bus_ticket` |
| Content-Type | `application/x-www-form-urlencoded` |
| 认证模式 | platform_managed（密钥由平台注入） |
| 响应格式 | JSON |
| 支持平台 | Web、MiniProgram |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。


支持 4 种输入方式（优先级：image > url > pdf_file > ofd_file）：base64 图片、图片 URL、PDF 文件（base64）、OFD 文件（base64）。

识别字段：发票代码（InvoiceCode）、发票号码（InvoiceNum）、日期（Date）、时间（Time）、出发站（StartingStation）、到达站（DestinationStation）、金额（Fare）、身份证号（IdNum）、姓名（Name）。

## 生成期用法（Agent 直接调用）

直接在脚本中调用上游接口，密钥从平台环境变量读取。完整参数表、请求示例及 TypeScript 实现详见 `references/bus-ticket-api.md`。

## 生成后用法（应用内通过 Edge Function 调用）

通过 Supabase Edge Function 代理调用，确保 `INTEGRATIONS_API_KEY` 不暴露到前端。Web 和 MiniProgram 均使用相同的 Edge Function，前端通过 `supabase.functions.invoke` 传入图片数据（base64 / URL）并获取 JSON 结果。

完整 Edge Function 代码、前端调用示例及注意事项详见 `references/bus-ticket-api.md`。
