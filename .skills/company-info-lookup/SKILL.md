---
name: company-info-lookup
description: 通过公司名称、注册号或统一社会信用代码查询企业全维度工商信息，适用于企业尽调、商务合作评估、风险识别与市场分析场景。
license: MIT
---

## 能力概述

**工商信息查询**（企业工商全维度版）支持通过公司名称关键词、注册号、组织机构代码或统一社会信用代码，查询企业的全维度工商信息。

| 属性 | 值 |
|------|-----|
| Endpoint | `GET https://app-cblk1rqa5fk1-api-e94GZ5j0Kxja-gateway.appmiaoda.com/business4/get` |
| 认证方式 | platform_managed（`X-Gateway-Authorization: Bearer ${apiKey}`） |
| Content-Type | `application/json;charset=UTF-8` |
| 响应格式 | JSON |

**核心返回数据模块：**

| 模块 | 字段名 | 说明 |
|------|--------|------|
| 工商基本信息 | `base` | 公司名称、注册号、法人、注册资本、成立日期、经营状态等 |
| 分支机构 | `branches` | 分支机构列表 |
| 企业变更 | `changes` | 历次变更记录 |
| 纳税信息 | `taxCredits` | 纳税信用等级 |
| 联系信息 | `contactInfo` | 网站、电话、邮箱 |
| 企业高管 | `employees` | 高管姓名及职位 |
| 经营异常 | `exceptions` | 异常记录 |
| 行业信息 | `industry` | 四级行业分类 |
| 股东信息 | `partners` | 股东出资比例及方式 |
| 行政处罚 | `punishes` | 处罚记录 |
| 行政许可 | `allows` | 许可记录 |
| 股权出质 | `pledges` | 股权出质信息 |
| 动产抵押 | `mpledges` | 动产抵押记录 |
| 失信记录 | `shiXinItems` | 失信被执行人记录 |
| 被执行记录 | `zhiXingItems` | 被执行记录 |

## 生成期用法（Agent 直接调用）

通过关键字查询企业工商全维度信息，直接调用上游 API 获取 JSON 数据。

详见 `references/business4-api.md` 中的"生成期代码"章节。

## 生成后用法（应用内通过 Edge Function 调用）

部署 Edge Function 代理请求，将 `INTEGRATIONS_API_KEY` 保存在服务端，避免密钥暴露到前端。

本插件支持 Web 和 MiniProgram 平台，两个平台均返回 JSON 数据（无二进制流），前端调用方式基本一致。

详见 `references/business4-api.md` 中的"Edge Function 代码"和"前端调用代码"章节。
