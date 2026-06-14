---
name: lottery-draw-query
description: 查询各类彩票开奖结果、历史开奖记录、中奖情况及彩票分类，适用于彩票开奖查询、历史追溯、奖池了解等场景
license: MIT
---

## 能力概述

本 skill 封装极速 API 彩票开奖结果查询服务，覆盖福彩、体彩、双色球、福彩3D、七乐彩等主流彩票品类，
提供以下四个接口能力：

| 接口 | 方法 | Endpoint |
|------|------|----------|
| 彩票开奖 | POST | `https://app-cblk1rqa5fk1-api-baBw2m51JXz9-gateway.appmiaoda.com/caipiao/query` |
| 历史开奖信息 | POST | `https://app-cblk1rqa5fk1-api-qYGW2z745vzY-gateway.appmiaoda.com/caipiao/history` |
| 查询是否中奖 | POST | `https://app-cblk1rqa5fk1-api-2Y00V8pRRoxY-gateway.appmiaoda.com/caipiao/winning` |
| 彩票分类 | POST | `https://app-cblk1rqa5fk1-api-BYdwQyx58E6L-gateway.appmiaoda.com/caipiao/class` |

**认证模式：** `platform_managed`（`traefik: true`），密钥由平台注入，读取自 `INTEGRATIONS_API_KEY` 环境变量。
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**响应格式：** 所有接口均返回 JSON，顶层结构为 `{ status: 0, msg: "ok", result: ... }`。

**计费：** 每次调用折扣价 ¥0.09（原价 ¥0.20）。

## 生成期用法（Agent 直接调用）

各接口的完整参数表、TypeScript 调用代码详见 `references/` 目录下对应文件：

- 彩票开奖查询：详见 `references/caipiao-query-api.md`
- 历史开奖信息：详见 `references/caipiao-history-api.md`
- 查询是否中奖：详见 `references/caipiao-winning-api.md`
- 彩票分类：详见 `references/caipiao-class-api.md`

## 生成后用法（应用内通过 Edge Function 调用）

每个接口需部署一个独立的 Edge Function，Edge Function 负责从服务端注入
`INTEGRATIONS_API_KEY`，原始密钥不暴露给前端。

各接口的 Edge Function 代码及前端调用代码详见 `references/` 目录下对应文件：

- 彩票开奖 Edge Function：详见 `references/caipiao-query-api.md`
- 历史开奖 Edge Function：详见 `references/caipiao-history-api.md`
- 中奖查询 Edge Function：详见 `references/caipiao-winning-api.md`
- 彩票分类 Edge Function：详见 `references/caipiao-class-api.md`

支持平台：Web、MiniProgram（接口均返回 JSON，无二进制流，两平台 Edge Function 实现相同）。
