---
name: company-hiring-data
description: 查询企业招聘概况与详细统计数据，适用于企业调研分析、求职参考、行业人才分布研究场景
license: MIT
---

## 能力概述

本 skill 封装两个接口，通过企业名称、统一信用代码、注册号或历史名称查询企业招聘数据：

| 接口 | Endpoint | 返回内容 |
|------|----------|---------|
| 招聘概况查询 | `POST https://app-cblk1rqa5fk1-api-Aa2PZ2MejdoL-gateway.appmiaoda.com/enterprise/hire-overview` | 职位关键词、职位类型、城市分布、招聘来源、职位级别、平均薪资、职位数量等概况 |
| 招聘数据统计 | `POST https://app-cblk1rqa5fk1-api-zYkZzErqJg4L-gateway.appmiaoda.com/enterprise/hire-statistics` | 平均薪资、学历分布、主要省份、招聘职位、薪资区间、工作年限分布、招聘数量时间序列等详细统计 |

认证模式：`platform_managed`（密钥由平台注入，读取 `INTEGRATIONS_API_KEY` 环境变量）。
Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

Content-Type：`application/x-www-form-urlencoded`

响应格式：JSON，顶层字段 `code`（200 成功）、`msg`、`success`、`data`。

## 生成期用法（Agent 直接调用）

两个接口均只需传入一个 `keyword` 参数，可独立调用。详细参数表、响应字段说明及完整代码见：

- 招聘概况查询：`references/hire-overview-api.md`
- 招聘数据统计：`references/hire-statistics-api.md`

## 生成后用法（应用内通过 Edge Function 调用）

每个接口部署一个 Edge Function，前端通过 Supabase SDK 调用。两个接口的 Edge Function 实现模式相同，差异仅在 upstream URL 和返回字段。

支持平台：Web、MiniProgram（两个平台实现相同，均使用 `supabase.functions.invoke`）。

完整 Edge Function 及前端调用代码见：

- 招聘概况查询：`references/hire-overview-api.md`
- 招聘数据统计：`references/hire-statistics-api.md`
