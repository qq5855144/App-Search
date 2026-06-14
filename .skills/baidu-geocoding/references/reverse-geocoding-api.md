# 百度地图逆地理编码接口（坐标 → 地址）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `dd5f588a-c7bb-4ca1-984e-6d91565eadd1` |
| API ID | `api-baBwZEjbe1X9` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-baBwZEjbe1X9-gateway.appmiaoda.com/reverse_geocoding/v3` |
| 认证模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/x-www-form-urlencoded`（GET 请求参数附在 URL 上） |
| third_part_domain | `app-cblk1rqa5fk1-api-baBwZEjbe1X9-gateway.appmiaoda.com` |
| 计费 | 免费（`enable_billing: false`，`original_price: "0"`），但会统计调用次数 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `location` | string | 是 | 经纬度坐标，格式为「纬度,经度」，如 `31.225696563611,121.49884033194` |
| `coordtype` | string | 否 | 传入坐标类型，默认 `bd09ll`，可选 `bd09ll`、`bd09mc`、`gcj02ll`、`wgs84ll` |
| `ret_coordtype` | string | 否 | 返回坐标类型，默认 `bd09ll` |
| `extensions_poi` | string | 否 | 是否召回 POI 数据：`0` 不召回，`1` 召回（默认 1000 米内），默认 `0` |
| `extensions_road` | string | 否 | 是否召回周围最近 3 条道路数据：`true` 召回，`false` 不召回，默认 `false` |
| `region_data_source` | string | 否 | 区域数据源 |
| `radius` | integer | 否 | POI 召回半径，0-3000 米，默认 1000 |
| `output` | string | 否 | 输出格式，可选 `json` 或 `xml`，默认 `xml` |
| `language` | string | 否 | 行政区划语言类型，默认 `en`（国内默认 `zh-CN`） |
| `language_auto` | string | 否 | 语言自动识别 |
| `poi_types` | string | 否 | POI 类型 |

---

## 响应字段表

### 成功响应（status = 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，`0` 表示成功 |
| `message` | string | 状态描述 |
| `result.location.lng` | number | 经度 |
| `result.location.lat` | number | 纬度 |
| `result.formatted_address` | string | 结构化地址（不含 POI） |
| `result.formatted_address_poi` | string? | 结构化地址（含 POI），需 `extensions_poi=1` |
| `result.business` | string | 所在商圈信息，最多 3 个，逗号分隔 |
| `result.addressComponent.country` | string | 国家 |
| `result.addressComponent.province` | string | 省份 |
| `result.addressComponent.city` | string | 城市 |
| `result.addressComponent.district` | string | 区县 |
| `result.addressComponent.street` | string | 街道 |
| `result.addressComponent.street_number` | string | 门牌号 |
| `result.addressComponent.adcode` | string | 行政区划代码 |
| `result.pois` | array? | 周边 POI 列表，需 `extensions_poi=1` |
| `result.roads` | array? | 周边道路信息，需 `extensions_road=true` |
| `result.sematic_description` | string? | 语义化位置描述，需 `extensions_poi=1` |

### 失败响应（status ≠ 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 错误码（非 0） |
| `message` | string | 错误描述 |

**响应示例：**

```json
{
  "status": 0,
  "message": "",
  "result": {
    "location": {
      "lng": 121.50989077799083,
      "lat": 31.22932842411674
    },
    "formatted_address": "上海市黄浦区中山南路187",
    "business": "外滩,陆家嘴,董家渡",
    "addressComponent": {
      "country": "中国",
      "province": "上海市",
      "city": "上海市",
      "district": "黄浦区",
      "street": "中山南路",
      "street_number": "187",
      "adcode": "310101"
    }
  }
}
```

---

## 生成期代码（TypeScript）

```typescript
// 生成期直接调用逆地理编码接口
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface AddressComponent {
  country: string;
  province: string;
  city: string;
  district: string;
  street: string;
  street_number: string;
  adcode: string;
}

interface ReverseGeocodeResult {
  location: { lng: number; lat: number };
  formatted_address: string;
  business: string;
  addressComponent: AddressComponent;
  pois?: unknown[];
  roads?: unknown[];
  sematic_description?: string;
}

/**
 * 将经纬度坐标解析为结构化地址信息（逆地理编码）。
 * @param latitude - 纬度
 * @param longitude - 经度
 * @param coordtype - 传入坐标类型，默认 bd09ll
 * @param extensionsPoi - 是否召回 POI 数据，默认 0
 * @returns 逆地理编码结果，含格式化地址及行政区划
 */
async function reverseGeocode(
  latitude: number,
  longitude: number,
  coordtype = "bd09ll",
  extensionsPoi = "0"
): Promise<ReverseGeocodeResult> {
  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    coordtype,
    extensions_poi: extensionsPoi,
    output: "json",
    language: "zh-CN",
  });

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-baBwZEjbe1X9-gateway.appmiaoda.com/reverse_geocoding/v3?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`百度地图 API 错误，status: ${json.status}`);

  return json.result as ReverseGeocodeResult;
}

// 使用示例
const result = await reverseGeocode(31.225696563611, 121.49884033194);
console.log(`地址: ${result.formatted_address}`);
console.log(`商圈: ${result.business}`);
console.log(`行政区划: ${result.addressComponent.province} ${result.addressComponent.city} ${result.addressComponent.district}`);
```

---

## Edge Function 代码

### Web 平台（`edge-functions/reverse-geocoding.ts`）

```typescript
// edge-functions/reverse-geocoding.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let location: string;
  let coordtype: string | undefined;
  let extensionsPoi: string | undefined;
  let extensionsRoad: string | undefined;

  try {
    const body = await req.json();
    location = body.location;
    coordtype = body.coordtype;
    extensionsPoi = body.extensions_poi;
    extensionsRoad = body.extensions_road;
    if (!location) throw new Error("Missing location");
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

  // --- 调用上游 ---
  const params = new URLSearchParams({
    location,
    coordtype: coordtype ?? "bd09ll",
    extensions_poi: extensionsPoi ?? "0",
    output: "json",
    language: "zh-CN",
  });
  if (extensionsRoad) params.set("extensions_road", extensionsRoad);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-baBwZEjbe1X9-gateway.appmiaoda.com/reverse_geocoding/v3?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // 转发配额/余额错误
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

### MiniProgram 平台

MiniProgram 端 Edge Function 与 Web 端**相同**（返回 JSON 数据，无二进制流），使用同一份 `edge-functions/reverse-geocoding.ts` 即可。

---

## 前端调用代码

### Web 平台（React/Vue）

```typescript
import { supabase } from "@/lib/supabase";

interface AddressComponent {
  country: string;
  province: string;
  city: string;
  district: string;
  street: string;
  street_number: string;
  adcode: string;
}

interface ReverseGeocodeResult {
  location: { lng: number; lat: number };
  formatted_address: string;
  business: string;
  addressComponent: AddressComponent;
}

/**
 * 通过 Edge Function 调用逆地理编码接口，将坐标解析为地址。
 * @param latitude - 纬度
 * @param longitude - 经度
 * @param coordtype - 坐标类型，默认 bd09ll
 * @returns 逆地理编码结果
 */
async function fetchReverseGeocode(
  latitude: number,
  longitude: number,
  coordtype = "bd09ll"
): Promise<ReverseGeocodeResult> {
  const { data, error } = await supabase.functions.invoke("reverse-geocoding", {
    body: { location: `${latitude},${longitude}`, coordtype },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`百度地图 API 错误，status: ${data.status}`);
  return data.result as ReverseGeocodeResult;
}

// 使用示例
const result = await fetchReverseGeocode(31.225696563611, 121.49884033194);
console.log(result.formatted_address); // "上海市黄浦区中山南路187"
```

### MiniProgram 平台（Taro）

```typescript
import { supabase } from "@/lib/supabase";
import Taro from "@tarojs/taro";

interface ReverseGeocodeResult {
  location: { lng: number; lat: number };
  formatted_address: string;
  business: string;
  addressComponent: {
    country: string;
    province: string;
    city: string;
    district: string;
    street: string;
    street_number: string;
    adcode: string;
  };
}

/**
 * 获取当前用户位置坐标（Taro 跨平台）。
 * H5 端使用 wgs84 坐标，WeApp 端使用 gcj02 坐标（用于 openLocation）。
 * 调用前须在 app.config.ts 中配置 requiredPrivateInfos 和 scope.userLocation。
 * @returns 用户当前坐标及坐标类型
 */
async function getUserLocation(): Promise<{ latitude: number; longitude: number; coordtype: string }> {
  // app.config.ts 须配置：
  // requiredPrivateInfos: ["getLocation"]
  // permission.scope.userLocation.desc: "您的位置信息将用于地图定位功能"
  const isWeApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP;
  const type = isWeApp ? "gcj02" : "wgs84";
  const location = await Taro.getLocation({ type });
  // 传入逆地理编码时，坐标类型对应：gcj02 → gcj02ll，wgs84 → wgs84ll
  const coordtype = isWeApp ? "gcj02ll" : "wgs84ll";
  return { latitude: location.latitude, longitude: location.longitude, coordtype };
}

/**
 * 通过 Edge Function 调用逆地理编码接口（MiniProgram Taro 端）。
 * @param latitude - 纬度
 * @param longitude - 经度
 * @param coordtype - 坐标类型，需与 Taro.getLocation 返回的坐标类型匹配
 * @returns 逆地理编码结果
 */
async function fetchReverseGeocode(
  latitude: number,
  longitude: number,
  coordtype = "bd09ll"
): Promise<ReverseGeocodeResult> {
  const { data, error } = await supabase.functions.invoke("reverse-geocoding", {
    body: { location: `${latitude},${longitude}`, coordtype },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`百度地图 API 错误，status: ${data.status}`);
  return data.result as ReverseGeocodeResult;
}

// 完整用法示例（自动获取位置 + 逆地理编码）
async function getCurrentAddress(): Promise<string> {
  const { latitude, longitude, coordtype } = await getUserLocation();
  const result = await fetchReverseGeocode(latitude, longitude, coordtype);
  return result.formatted_address;
}

// Map 组件兼容性处理
// 若 Taro.getEnv() === Taro.ENV_TYPE.WEB，Map 组件在 H5 端不生效
// 需显示文本提示："由于兼容性问题，无法在当前页面中展示地图，请前往微信小程序测试与使用"
```

---

## 注意事项

- **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）。
- **计费**: 当前免费（`original_price: "0"`），但会统计调用次数（`need_count_calls: true`），避免不必要的重复调用。
- **坐标类型匹配**: 传入的 `location` 坐标类型必须与 `coordtype` 参数一致：
  - `Taro.getLocation({ type: "gcj02" })` → `coordtype: "gcj02ll"`
  - `Taro.getLocation({ type: "wgs84" })` → `coordtype: "wgs84ll"`
- **output 默认值**: 上游 API 的 `output` 默认值为 `xml`，Edge Function 中务必显式设置 `output=json`。
- **MiniProgram 位置权限**: 调用 `Taro.getLocation` 前须在 `app.config.ts` 中配置：
  ```json
  {
    "requiredPrivateInfos": ["getLocation"],
    "permission": {
      "scope.userLocation": {
        "desc": "您的位置信息将用于获取当前地址"
      }
    }
  }
  ```
- **H5 Map 组件**: 在 Taro H5 端 `Map` 组件不生效，需在 UI 层做平台判断，展示兼容性提示文本。
