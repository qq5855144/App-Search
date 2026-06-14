---
name: baidu-geocoding
description: 提供百度地图地理编码和逆地理编码能力：地址转坐标、坐标转地址；适用于地图定位、导航、LBS 等场景
license: MIT
---

## 能力概述

本 Skill 封装百度地图定位插件，提供两个核心接口：

| 接口 | 方向 | Endpoint | Method |
|------|------|----------|--------|
| 地理编码 | 地址 → 坐标 | `GET https://app-cblk1rqa5fk1-api-GaDwZ0j3erOY-gateway.appmiaoda.com/geocoding/v3/` | GET |
| 逆地理编码 | 坐标 → 地址 | `GET https://app-cblk1rqa5fk1-api-baBwZEjbe1X9-gateway.appmiaoda.com/reverse_geocoding/v3` | GET |

- **认证模式**: `platform_managed`（`traefik: true`），密钥由平台注入，无需用户配置
- **响应格式**: JSON
- **支持平台**: Web、MiniProgram（Taro）、App

**MiniProgram 平台关键差异：**
- 使用地图组件（Map）时，H5 端不可用，需显示兼容提示
- 调用 `Taro.getLocation` 前须在 `app.config.ts` 中配置 `requiredPrivateInfos` 和位置权限
- `Taro.getLocation` 的 `type` 参数在 H5 端用 `wgs84`，在 WeApp 端用 `gcj02`

---

## 生成期用法（Agent 直接调用）

两个接口各有独立的 Deno TypeScript 实现，详见：
- `references/geocoding-api.md` — 地理编码接口（地址 → 坐标）
- `references/reverse-geocoding-api.md` — 逆地理编码接口（坐标 → 地址）

**快速示例（地理编码）：**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

const params = new URLSearchParams({
  address: "百度大厦",
  city: "北京市",
  output: "json",
});
const response = await fetch(
  `https://app-cblk1rqa5fk1-api-GaDwZ0j3erOY-gateway.appmiaoda.com/geocoding/v3/?${params}`,
  {
    method: "GET",
    headers: {
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  }
);
const json = await response.json();
// json.result.location.lng / json.result.location.lat
```

---

## 生成后用法（应用内通过 Edge Function 调用）

每个接口需部署一个独立的 Edge Function，分别将请求转发至百度地图 API 并向客户端返回 JSON。

| 接口 | Edge Function 文件 | 前端调用函数 |
|------|--------------------|-------------|
| 地理编码 | `edge-functions/geocoding.ts` | `fetchGeocode(address, city?)` |
| 逆地理编码 | `edge-functions/reverse-geocoding.ts` | `fetchReverseGeocode(location)` |

**平台差异说明（MiniProgram）：**
在小程序中调用这两个接口前，通常需要先通过 `Taro.getLocation` 获取用户坐标。请注意：
- H5 端 `type` 传 `wgs84`，WeApp 端传 `gcj02`
- 需在 `app.config.ts` 中声明 `requiredPrivateInfos: ["getLocation"]` 和 `permission.scope.userLocation`

完整 Edge Function 和前端代码详见：
- `references/geocoding-api.md`
- `references/reverse-geocoding-api.md`
