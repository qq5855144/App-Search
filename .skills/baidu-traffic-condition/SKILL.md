---
name: baidu-traffic-condition
description: 基于百度地图查询实时交通路况，支持道路名称、矩形/多边形/圆形区域四种查询方式，适用于出行导航、路线规划和拥堵预警场景
license: MIT
---

## 能力概述

基于百度地图交通路况 API，提供分钟级实时道路拥堵数据，支持四种查询维度：

| 接口 | 方法 | Endpoint | 核心参数 |
|------|------|----------|---------|
| 道路实时路况查询 | GET | `https://app-cblk1rqa5fk1-api-rLobR3D3dbg9-gateway.appmiaoda.com/traffic/v1/road` | `road_name`（必填）、`city`（可选） |
| 矩形区域实时路况查询 | GET | `https://app-cblk1rqa5fk1-api-ra5ErGpGM8wa-gateway.appmiaoda.com/traffic/v1/bound` | `bounds`（必填，左下角;右上角坐标） |
| 多边形区域实时路况查询 | GET | `https://app-cblk1rqa5fk1-api-BYdwQ5e51blL-gateway.appmiaoda.com/traffic/v1/polygon` | `polygon`（必填，多边形坐标点序列） |
| 周边实时路况查询 | GET | `https://app-cblk1rqa5fk1-api-Xa6JeEnEb2na-gateway.appmiaoda.com/traffic/v1/around` | `center`（必填，中心坐标）、`radius`（必填，单位米） |

所有接口均返回 JSON，包含整体拥堵评价（`evaluation`）和各拥堵路段详情（`congestion_sections` / `roads`）。

**认证模式**：`platform_managed`（密钥由平台注入，前端无需关心）

**支持平台**：Web、MiniProgram

## 生成期用法（Agent 直接调用）

详见各接口的参数说明和代码示例：
- `references/traffic-road-api.md` — 道路实时路况查询（按道路名称搜索拥堵评价与拥堵路段）
- `references/traffic-bound-api.md` — 矩形区域实时路况查询（通过左下/右上角坐标定义矩形范围）
- `references/traffic-polygon-api.md` — 多边形区域实时路况查询（通过多顶点坐标定义不规则区域）
- `references/traffic-around-api.md` — 周边实时路况查询（以中心点坐标和半径定义圆形范围）

平台密钥通过 `process.env["INTEGRATIONS_API_KEY"]` 读取，Auth header 统一使用
`"X-Gateway-Authorization": \`Bearer ${apiKey}\``。

快速示例（查询某条道路的实时路况）：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

// 查询「长安街」在北京的实时路况
const response = await fetch(
  "https://app-cblk1rqa5fk1-api-rLobR3D3dbg9-gateway.appmiaoda.com/traffic/v1/road" +
    "?road_name=" + encodeURIComponent("长安街") +
    "&city=" + encodeURIComponent("北京"),
  {
    method: "GET",
    headers: { "X-Gateway-Authorization": `Bearer ${apiKey}` },
  }
);
if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
const json = await response.json();
if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message}`);

// json.evaluation.status: 1=畅通, 2=缓行, 3=拥堵, 4=严重拥堵
console.log("整体路况评价：", json.evaluation.status);
console.log("拥堵路段数：", json.congestion_sections?.length ?? 0);
```

## 生成后用法（应用内通过 Edge Function 调用）

每个接口对应一个独立的 Edge Function，前端通过 `supabase.functions.invoke` 调用，
平台密钥仅在 Edge Function 服务端注入，不暴露到前端。

| 接口 | Edge Function 名称 | 参考文件 |
|------|-------------------|---------|
| 道路路况 | `traffic-road` | `references/traffic-road-api.md` |
| 矩形区域 | `traffic-bound` | `references/traffic-bound-api.md` |
| 多边形区域 | `traffic-polygon` | `references/traffic-polygon-api.md` |
| 周边路况 | `traffic-around` | `references/traffic-around-api.md` |

Web 和 MiniProgram 均使用标准 `supabase.functions.invoke` 调用方式，响应均为 JSON，
无二进制流，两个平台实现无差异。完整 Edge Function 和前端代码详见各 references/ 文件。
