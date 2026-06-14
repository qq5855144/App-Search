---
name: patent-search
description: 通过企业名称/注册号/统一信用代码查询专利申请列表及专利详情，适用于企业尽职调查、知识产权管理、竞争对手分析和金融风控场景。
license: MIT
---

## 能力概述

本 skill 封装了百度 API 市场的**企业专利信息查询**服务，提供两个接口：

| 接口 | 方法 | Endpoint | 核心参数 |
|------|------|----------|----------|
| 企业专利列表查询 | POST | `https://app-cblk1rqa5fk1-api-79jKP8yo70AL-gateway.appmiaoda.com/enterprise/patent/list` | keyword（公司名/注册号/统一信用代码）、pageNo、pageSize |
| 企业专利详情查询 | POST | `https://app-cblk1rqa5fk1-api-eLMlJ2jB4oj9-gateway.appmiaoda.com/enterprise/patent/detail` | id（专利 ID） |

**认证方式：** `platform_managed`，密钥由平台注入，调用方无需管理密钥。
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**支持平台：** Web、MiniProgram

**典型使用流程：**
1. 调用列表接口，输入企业关键词，获取专利列表及专利 ID。
2. 调用详情接口，传入专利 ID，获取完整详情（摘要、法律状态历史、代理机构等）。

---

## 生成期用法（Agent 直接调用）

适用于 Agent 在生成应用代码时直接调用 API 进行数据查询。

详见 [`references/patent-list-api.md`](references/patent-list-api.md)（列表查询）和
[`references/patent-detail-api.md`](references/patent-detail-api.md)（详情查询）中的**生成期代码**章节。

---

## 生成后用法（应用内通过 Edge Function 调用）

在已部署的 Miaoda 应用中，前端不可直接持有 API 密钥，需通过 Supabase Edge Function 代理调用。

每个接口对应一个独立的 Edge Function：
- `enterprise-patent-list` — 代理列表查询
- `enterprise-patent-detail` — 代理详情查询

两个接口均返回 JSON 数据，不涉及媒体资源转存，也不使用流式响应。

详见 [`references/patent-list-api.md`](references/patent-list-api.md) 和
[`references/patent-detail-api.md`](references/patent-detail-api.md) 中的 **Edge Function 代码** 与
**前端调用代码**章节。
