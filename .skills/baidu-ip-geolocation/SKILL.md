---
name: baidu-ip-geolocation
description: 通过 IP 地址查询地理位置，返回省市区县、行政区划代码及经纬度坐标；适用于用户属地识别、城市归属判定、位置坐标获取等场景
license: MIT
---

## 能力概述

基于百度地图 IP 定位接口，通过用户的 IPv4 地址获取对应的地理位置信息，包括省份、城市、区县、街道及经纬度坐标。如果请求中不提供 IP 地址，则自动定位发起请求的 IP 地址。支持百度墨卡托坐标、百度经纬度坐标（bd09ll）、国测局 02 坐标（gcj02）三种坐标系。

- **Endpoint**：`GET https://app-cblk1rqa5fk1-api-79jK62Ze2pQL-gateway.appmiaoda.com/location/ip`
- **认证模式**：`platform_managed`（密钥由平台注入，取自 `INTEGRATIONS_API_KEY`）
- **响应格式**：JSON
- **Plugin ID**：`3ab7447f-1695-46f5-a2b8-d4eb6ddecd37`
- **API ID**：`api-79jK62Ze2pQL`

### 响应示例

```json
{
  "status": 0,
  "address": "CN|北京市|北京市|None|None|100|100|0",
  "content": {
    "address": "北京市",
    "address_detail": {
      "adcode": "110000",
      "city": "北京市",
      "city_code": 131,
      "district": "",
      "province": "北京市",
      "street": "",
      "street_number": ""
    },
    "point": {
      "x": "12959219.6",
      "y": "4825334.63"
    }
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 通过 IP 地址查询地理位置信息。
 * @param ip - 可选，用户的 IPv4 地址；不传则自动定位请求来源 IP
 * @param coor - 可选，坐标系类型：不填返回百度墨卡托坐标；"bd09ll" 返回百度经纬度坐标；"gcj02" 返回国测局 02 坐标
 * @returns 包含地址信息与坐标的 JSON 对象
 */
async function callIpLocation(
  ip?: string,
  coor?: string
): Promise<{
  status: number;
  address: string;
  content: {
    address: string;
    address_detail: {
      province: string;
      city: string;
      city_code: number;
      district: string;
      street: string;
      street_number: string;
      adcode: string;
    };
    point: { x: string; y: string };
  };
}> {
  const params = new URLSearchParams();
  if (ip) params.set("ip", ip);
  if (coor) params.set("coor", coor);

  const url = `https://app-cblk1rqa5fk1-api-79jK62Ze2pQL-gateway.appmiaoda.com/location/ip${
    params.toString() ? "?" + params.toString() : ""
  }`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error status ${json.status}`);

  return json;
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/baidu-ip-geolocation.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求（两个参数均为可选）---
  let ip: string | undefined;
  let coor: string | undefined;
  try {
    const body = await req.json();
    ip = body.ip;
    coor = body.coor;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构建上游请求 URL ---
  const params = new URLSearchParams();
  if (ip) params.set("ip", ip);
  if (coor) params.set("coor", coor);
  const upstreamUrl = `https://app-cblk1rqa5fk1-api-79jK62Ze2pQL-gateway.appmiaoda.com/location/ip${
    params.toString() ? "?" + params.toString() : ""
  }`;

  // --- 调用上游 ---
  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  // 透传配额/余额错误
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 前端调用代码（Web / MiniProgram 通用）

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 调用 IP 定位接口。
 * @param ip - 可选，待查询的 IPv4 地址；不传则定位请求来源 IP
 * @param coor - 可选，坐标系类型："bd09ll" | "gcj02" | 不传（默认墨卡托）
 * @returns 上游 JSON 响应，含 status、address、content 字段
 */
async function fetchIpLocation(ip?: string, coor?: string) {
  const { data, error } = await supabase.functions.invoke("baidu-ip-geolocation", {
    body: { ip, coor },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 status=${data.status}`);
  return data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用 IP 定位 Edge Function。
 * @param ip - 可选，待查询的 IPv4 地址
 * @param coor - 可选，坐标系类型
 * @returns 上游 JSON 响应
 */
async function fetchIpLocation(ip?: string, coor?: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-ip-geolocation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, coor }),
    }
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`配额已用尽：${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`余额不足：${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.status !== 0) throw new Error(`API 错误 status=${json.status}`);
  return json;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `ip` | string | 否 | 用户上网的 IPv4 地址；不提供则自动定位请求来源 IP |
| `coor` | string | 否 | 坐标系类型：不填或空返回百度墨卡托坐标；`bd09ll` 返回百度经纬度坐标；`gcj02` 返回国测局 02 坐标 |

### 返回字段说明

#### 成功响应（status = 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | `number` | 状态码，0 表示成功 |
| `address` | `string` | 详细地址及可信度，格式：`国家代码\|省份\|城市\|区县\|街道\|省份可信度\|城市可信度\|区县可信度` |
| `content.address` | `string` | 简要地址（如"北京市"） |
| `content.address_detail.province` | `string` | 省份 |
| `content.address_detail.city` | `string` | 城市 |
| `content.address_detail.city_code` | `number` | 百度城市代码 |
| `content.address_detail.district` | `string` | 区县 |
| `content.address_detail.street` | `string` | 道路名 |
| `content.address_detail.street_number` | `string` | 门牌号 |
| `content.address_detail.adcode` | `string` | 行政区划代码 |
| `content.point.x` | `string` | 经度（坐标系由 coor 参数决定） |
| `content.point.y` | `string` | 纬度（坐标系由 coor 参数决定） |

#### 错误状态码

| 状态码 | 说明 |
|--------|------|
| `0` | 正常 |
| `210` | APP IP 校验失败 |
| `211` | APP SN 校验失败 |
| `302` | 天配额超限 |
| `401` | 并发量超限 |
| `1001` | 没有 IPv6 地址访问权限 |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误，同时检查响应体中的 `status` 字段（非 0 即为业务错误）。
- **计费**：折后单价 **¥0.75 / 千次调用**（原价 ¥1.20），请避免不必要的重复调用。
- **坐标系**：默认返回百度墨卡托坐标（适合百度地图 SDK），若需与高德/Google 地图集成，请传 `coor=gcj02`；纯经纬度展示请传 `coor=bd09ll`。
- **IP 精度**：定位精度为城市级，区县及街道字段在部分 IP 段下可能为空字符串。
- **IPv6**：该接口仅支持 IPv4，如需 IPv6 定位需单独申请权限（错误码 1001）。
