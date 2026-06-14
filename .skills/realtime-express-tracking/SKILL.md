---
name: realtime-express-tracking
description: 实时快递查询，支持获取快递公司列表和查询快递物流轨迹。需要查快递、物流跟踪时使用。
license: MIT
---

## 能力概述

本 skill 封装了两个快递相关接口，通过百度云 API 网关（`app-cblk1rqa5fk1-api-V9gDz8wo0V5L-gateway.appmiaoda.com`）提供服务：

| 接口 | Endpoint | 方法 | 说明 |
|------|----------|------|------|
| 快递公司列表获取 | `GET /getExpressList` | GET | 获取所有支持的快递公司名称及简码，支持按简码筛选 |
| 快递物流轨迹查询 | `GET /kdi` | GET | 查询指定快递单号的实时物流轨迹、投递状态等详细数据 |

支持近百家国内外快递公司，包括顺丰、申通、中通、圆通、韵达、EMS 等。

**平台差异：** 两个接口均返回 JSON 数据，Web 和 MiniProgram 平台实现一致，均通过 Edge Function 中转。

## 生成期用法（Agent 直接调用）

认证方式：`platform_managed`，密钥通过 `INTEGRATIONS_API_KEY` 环境变量注入，Auth Header 统一使用 `X-Gateway-Authorization: Bearer ${apiKey}`。

详见：
- `references/get-express-list-api.md` — 快递公司列表获取接口的完整规范与生成期代码
- `references/kdi-api.md` — 快递物流轨迹查询接口的完整规范与生成期代码

## 生成后用法（应用内通过 Edge Function 调用）

两个接口各自部署为独立 Edge Function，客户端通过 `supabase.functions.invoke` 调用，密钥由 Edge Function 从 `INTEGRATIONS_API_KEY` 读取，不暴露给前端。

| 接口 | Edge Function 名称 | 适用平台 |
|------|-------------------|---------|
| 快递公司列表获取 | `get-express-list` | Web、MiniProgram |
| 快递物流轨迹查询 | `kdi-query` | Web、MiniProgram |

详见：
- `references/get-express-list-api.md` — Edge Function 完整代码 + 前端调用示例
- `references/kdi-api.md` — Edge Function 完整代码 + 前端调用示例（含顺丰特殊规则处理）
