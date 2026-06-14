---
name: baidu-weather-query
description: 通过百度地图 API 查询国内城市实时天气及未来7天预报，支持行政区划代码和经纬度两种定位方式；适用于天气展示、出行助手等场景。
license: MIT
---

## 能力概述

本 skill 封装了百度地图天气查询服务的两个接口，统一由 `platform_managed` 认证（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`）。

| 接口 | 方法 | Endpoint | 核心功能 |
|------|------|----------|----------|
| 国内天气查询 | GET | `https://app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com/weather/v1/` | 按行政区划代码查询实时天气 + 未来7天预报 |
| 国内经纬度天气查询 | GET | `https://app-cblk1rqa5fk1-api-GYX1bnRz2Pxa-gateway.appmiaoda.com/weather/v1/` | 按经纬度查询实时天气 + 未来7天预报 + 24小时逐小时预报 |

**定位方式**：

| 接口 | 定位参数 | 说明 |
|------|----------|------|
| 国内天气查询 | `district_id` | 行政区划代码，如 `110100`（北京市） |
| 国内经纬度天气查询 | `location` | 经纬度坐标，格式：`纬度,经度`，如 `39.915,116.404` |

两个接口均返回 JSON，包含 `location`（位置信息）、`now`（实时天气）、`forecasts`（7天预报）字段。经纬度接口还包含 `hourly`（24小时逐小时预报）。

**平台支持**：Web / MiniProgram

---

## 生成期用法（Agent 直接调用）

两个接口均为 GET 请求，使用 Query Parameters 传参，认证方式统一为 `platform_managed`。

完整参数表、TypeScript 调用代码见：
- `references/district-weather-api.md` — 按行政区划代码查询天气
- `references/location-weather-api.md` — 按经纬度查询天气

**快速示例（以行政区划代码查询为例）**：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function getWeatherByDistrict(districtId: string, dataType = "all"): Promise<unknown> {
  const url = new URL("https://app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com/weather/v1/");
  url.searchParams.set("district_id", districtId);
  url.searchParams.set("data_type", dataType);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error status: ${json.status}`);
  return json.result;
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

每个接口需独立部署一个 Edge Function，前端通过 `supabase.functions.invoke` 调用。

| 接口 | Edge Function 名称 | references 文件 |
|------|--------------------|-----------------|
| 行政区划代码查询天气 | `district-weather` | `references/district-weather-api.md` |
| 经纬度查询天气 | `location-weather` | `references/location-weather-api.md` |

完整 Edge Function 代码及前端调用代码见：
- `references/district-weather-api.md`
- `references/location-weather-api.md`

---

## 使用示例

**查询北京市未来 7 天天气预报（按行政区划代码）：**

```typescript
const apiKey = Deno.env.get("INTEGRATIONS_API_KEY")!;

const url = new URL("https://app-cblk1rqa5fk1-api-oLpZbd8ed8wa-gateway.appmiaoda.com/weather/v1/");
url.searchParams.set("district_id", "110100"); // 北京市
url.searchParams.set("data_type", "all"); // 返回实时天气 + 7 天预报

const response = await fetch(url.toString(), {
  method: "GET",
  headers: {
    "Accept": "application/json",
    "X-Gateway-Authorization": `Bearer ${apiKey}`,
  },
});

if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
const json = await response.json();
if (json.status !== 0) throw new Error(`API error status: ${json.status}`);

const { location, now, forecasts } = json.result;
console.log(`城市：${location.city}`);
console.log(`当前温度：${now.temp}°C，天气：${now.text}`);
console.log(`明日预报：${forecasts[1].text_day}，最高 ${forecasts[1].high}°C，最低 ${forecasts[1].low}°C`);
```
