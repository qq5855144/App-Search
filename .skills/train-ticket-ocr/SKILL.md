---
name: train-ticket-ocr
description: 识别红/蓝火车票和铁路电子客票的关键字段，返回结构化 JSON；适用于财务报销、出行管理、票据识别等需要提取车票信息的场景。
license: MIT
---

## 能力概述

调用百度 OCR 接口，对火车票图片（红票/蓝票）或铁路电子客票（PDF/OFD）进行结构化识别，提取票号、车次、始发/到达站、日期时间、票价、席别、座位号、乘客姓名、身份证号等关键字段。

| 项目 | 值 |
|------|----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Xa6JZxjyqZna-gateway.appmiaoda.com/rest/2.0/ocr/v1/train_ticket` |
| Content-Type | `application/x-www-form-urlencoded` |
| 认证模式 | `platform_managed`（密钥由平台注入） |
| 响应格式 | JSON — `words_result` 对象含所有识别字段 |
| 支持平台 | Web、MiniProgram |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。


**输入优先级**：`image`（Base64）> `url`（图片 URL）> `pdf_file`（PDF Base64）> `ofd_file`（OFD Base64）

## 生成期用法（Agent 直接调用）

生成期代码直接调用上游接口，适用于后台脚本批量处理场景。

详见 [references/train-ticket-api.md](references/train-ticket-api.md) — **生成期代码** 章节。

## 生成后用法（应用内通过 Edge Function 调用）

应用内需通过 Edge Function 代理调用，将 `INTEGRATIONS_API_KEY` 保留在服务端，避免密钥暴露给前端。

**平台差异**：Web 和 MiniProgram 均返回 JSON 结构化数据，响应格式相同，Edge Function 实现一致，前端调用方式略有差异（见下表）。

| 平台 | 调用方式 |
|------|----------|
| Web | `supabase.functions.invoke` 或原生 `fetch` |
| MiniProgram（Taro） | `supabase.functions.invoke` |

详见 [references/train-ticket-api.md](references/train-ticket-api.md) — **Edge Function 代码** 及 **前端调用代码** 章节。
