---
name: route-planning
description: 基于百度地图提供驾车、步行、骑行、公交路线规划及批量算路能力，返回路线距离、时间、路段详情等，适用于出行规划、路线对比、物流配送场景。
license: MIT
---

## 能力概述

基于百度地图 Direction API v2 和 RouteMatrix API v2，提供以下七个接口：

| 接口名称 | Endpoint | 方法 | 说明 |
|---------|---------|------|------|
| 驾车路线规划 | `GET https://app-cblk1rqa5fk1-api-GaDwZKpJxXOY-gateway.appmiaoda.com/direction/v2/driving` | GET | 单次驾车路线，支持多种策略 |
| 骑行路线规划 | `GET https://app-cblk1rqa5fk1-api-W9z3MpAdKeNL-gateway.appmiaoda.com/direction/v2/riding` | GET | 单次骑行路线 |
| 步行路线规划 | `GET https://app-cblk1rqa5fk1-api-wLNdomNRn42a-gateway.appmiaoda.com/direction/v2/walking` | GET | 单次步行路线 |
| 公交路线规划 | `GET https://app-cblk1rqa5fk1-api-m9xKXQkOKZXa-gateway.appmiaoda.com/direction/v2/transit` | GET | 公共交通路线，含换乘方案和票价 |
| 驾车批量算路 | `GET https://app-cblk1rqa5fk1-api-6LeBrqqMqKQY-gateway.appmiaoda.com/routematrix/v2/driving` | GET | 多起点多终点笛卡尔积算路 |
| 骑行批量算路 | `GET https://app-cblk1rqa5fk1-api-Aa2Pq88pDANL-gateway.appmiaoda.com/routematrix/v2/riding` | GET | 批量骑行距离耗时计算 |
| 步行批量算路 | `GET https://app-cblk1rqa5fk1-api-qYGW2zz1MklY-gateway.appmiaoda.com/routematrix/v2/walking` | GET | 批量步行距离耗时计算 |

**认证方式**：`platform_managed`，密钥由平台注入，通过 `INTEGRATIONS_API_KEY` 环境变量读取，
Header 统一使用 `X-Gateway-Authorization: Bearer ${apiKey}`。

**支持平台**：Web、MiniProgram（响应均为 JSON，两平台实现相同）。

**响应格式**：所有接口返回 JSON，`status=0` 表示成功，`result.routes[]` 包含路线方案。

## 生成期用法（Agent 直接调用）

所有接口均为 GET 请求，参数通过 URL Query String 传递，认证通过 `X-Gateway-Authorization` header。

```typescript
// 驾车路线规划示例
const apiKey = process.env.INTEGRATIONS_API_KEY;
const origin = "40.056878,116.30815";   // 起点纬度,经度
const destination = "39.767892,116.527308"; // 终点纬度,经度

const url = new URL("https://app-cblk1rqa5fk1-api-GaDwZKpJxXOY-gateway.appmiaoda.com/direction/v2/driving");
url.searchParams.set("origin", origin);
url.searchParams.set("destination", destination);
url.searchParams.set("output", "json");

const response = await fetch(url.toString(), {
  headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
});
const data = await response.json();

if (data.status === 0) {
  const route = data.result.routes[0];
  console.log(`距离：${route.distance} 米，预计时间：${route.duration} 秒`);
} else {
  console.error(`请求失败，status=${data.status}，message=${data.message}`);
}
```

完整参数说明、生成期代码示例详见：

- [references/direction-api.md](references/direction-api.md) — 驾车 / 骑行 / 步行 / 公交路线规划接口
- [references/routematrix-api.md](references/routematrix-api.md) — 驾车 / 骑行 / 步行批量算路接口

## 生成后用法（应用内通过 Edge Function 调用）

在应用中，前端调用 Supabase Edge Function，Edge Function 在服务端注入 `INTEGRATIONS_API_KEY`
并转发请求到百度地图 API，避免密钥暴露到客户端。

Web 和 MiniProgram 均可使用 `supabase.functions.invoke` 调用，响应为标准 JSON。

完整 Edge Function 代码、前端调用代码及各接口注意事项详见：

- [references/direction-api.md](references/direction-api.md) — 驾车 / 骑行 / 步行 / 公交路线规划
- [references/routematrix-api.md](references/routematrix-api.md) — 驾车 / 骑行 / 步行批量算路
