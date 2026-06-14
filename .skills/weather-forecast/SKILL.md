---
name: weather-forecast
description: 查询全国各地今日实时天气、未来7天及未来15天天气预报，支持实时气象、生活指数、天气预警；适用于天气应用、出行规划等场景。
license: MIT
---

## 能力概述

本 skill 封装了百度气象网关的三个天气查询接口，统一由 `platform_managed` 认证（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`）。

| 接口 | 方法 | Endpoint | 核心功能 |
|------|------|----------|----------|
| 天气预报API | GET | `https://app-cblk1rqa5fk1-api-Aa2PZnjEVgyL-gateway.appmiaoda.com/lundear/weather1d` | 今日实时天气 + 当天预报 |
| 未来7日天气预报API | GET | `https://app-cblk1rqa5fk1-api-rY7JZ6jqrV6L-gateway.appmiaoda.com/lundear/weather7d` | 未来7天逐日天气预报 |
| 未来8-15日天气预报API | GET | `https://app-cblk1rqa5fk1-api-oYA6ZGjReVpa-gateway.appmiaoda.com/lundear/weather15d` | 未来第8天到第15天天气预报 |

**定位方式（四选一）**：`areaCode`（地区代码）、`areaCn`（城市级中文名称，如"广州"、"杭州"，不能传省份名如"广东"）、`ip`（IP地址）、`lng + lat`（经纬度）。

所有接口均返回 JSON，响应结构见各 references 文件。

**平台支持**：Web / MiniProgram / App（MiniProgram 涉及地理位置时需额外配置权限，详见各 references 文件）。

---

## 生成期用法（Agent 直接调用）

所有三个接口均为 GET 请求，使用 Query Parameters 传参，认证方式统一为 `platform_managed`。

完整参数表、TypeScript 调用代码见：
- `references/weather1d-api.md` — 今日实时天气
- `references/weather7d-api.md` — 未来7日天气预报
- `references/weather15d-api.md` — 未来8-15日天气预报

**快速示例（以今日天气为例）**：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function getWeather1d(areaCn: string): Promise<unknown> {
  const url = new URL("https://app-cblk1rqa5fk1-api-Aa2PZnjEVgyL-gateway.appmiaoda.com/lundear/weather1d");
  url.searchParams.set("areaCn", areaCn);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  return json.data;
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

每个接口需独立部署一个 Edge Function，前端通过 `supabase.functions.invoke` 调用。

| 接口 | Edge Function 名称 | references 文件 |
|------|--------------------|-----------------|
| 今日天气 | `weather-1d` | `references/weather1d-api.md` |
| 7日预报 | `weather-7d` | `references/weather7d-api.md` |
| 15日预报 | `weather-15d` | `references/weather15d-api.md` |

**MiniProgram 平台注意**：若需通过 `Taro.getLocation` 获取用户坐标后再调用天气接口，需要在 `app.config.ts` 中配置位置权限，详见各 references 文件中的平台差异说明。

完整 Edge Function 代码及前端调用代码见：
- `references/weather1d-api.md`
- `references/weather7d-api.md`
- `references/weather15d-api.md`
