---
name: phone-location-lookup
description: 根据手机号查询归属地（省份-城市）、原运营商及是否为虚拟运营商，适用于风控校验、用户画像、客服辅助等场景。
license: MIT
---

## 能力概述

通过手机号实时查询号码归属地信息，直连三大运营商数据源，非缓存，支持携号转网状态识别。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-ELbWz8OmB58Y-gateway.appmiaoda.com/mobile/area`
- **核心参数**：`mobile_number`（手机号，查询参数传递）
- **响应格式**：JSON，返回归属地省市、原运营商、是否虚拟运营商
- **适用场景**：风控校验、用户画像补全、客服辅助、号码信息识别

响应示例：

```json
{
  "code": 200,
  "taskNo": "69564903663951243279",
  "data": {
    "area": "江苏-南通",
    "originalIsp": "电信",
    "isVirtuallyIsp": 1
  }
}
```

## 生成期用法（Agent 直接调用）

`traefik: true` → `platform_managed`，密钥由平台注入，从 `process.env["INTEGRATIONS_API_KEY"]` 读取。

**注意**：所有参数通过 URL Query 参数传递，请求体为空。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed：密钥由平台注入

/**
 * 查询手机号归属地、原运营商及是否为虚拟运营商。
 * @param mobileNumber - 手机号，例如：13800138000
 * @returns 包含 area、originalIsp、isVirtuallyIsp 的对象
 */
async function queryMobileLocation(
  mobileNumber: string
): Promise<{ area: string; originalIsp: string; isVirtuallyIsp: number }> {
  const url = new URL("https://app-cblk1rqa5fk1-api-ELbWz8OmB58Y-gateway.appmiaoda.com/mobile/area");
  url.searchParams.set("mobile_number", mobileNumber);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}

// 使用示例
const result = await queryMobileLocation("13800138000");
console.log(result.area);          // "江苏-南通"
console.log(result.originalIsp);   // "电信"
console.log(result.isVirtuallyIsp); // 1（虚拟运营商）
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/phone-location-lookup.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let mobileNumber: string;
  try {
    const body = await req.json();
    mobileNumber = body.mobile_number;
    if (!mobileNumber) throw new Error("Missing mobile_number");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API（参数通过 Query 传递） ---
  const upstreamUrl = new URL("https://app-cblk1rqa5fk1-api-ELbWz8OmB58Y-gateway.appmiaoda.com/mobile/area");
  upstreamUrl.searchParams.set("mobile_number", mobileNumber);

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

### 前端调用（Web / MiniProgram 通用）

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询手机号归属地。
 * @param mobileNumber - 手机号，例如：13800138000
 * @returns 包含 area、originalIsp、isVirtuallyIsp 的对象
 */
async function fetchMobileLocation(mobileNumber: string) {
  const { data, error } = await supabase.functions.invoke("phone-location-lookup", {
    body: { mobile_number: mobileNumber },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 查询手机号归属地。
 * @param mobileNumber - 手机号，例如：13800138000
 * @returns 包含 area、originalIsp、isVirtuallyIsp 的对象
 */
async function fetchMobileLocation(mobileNumber: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-location-lookup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile_number: mobileNumber }),
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
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.data;
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `mobile_number` | string | 是 | 手机号，例如：13800138000。通过 URL Query 参数传递，不在请求体中 |

### 返回字段说明

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `taskNo` | string | 任务编号 |
| `data.area` | string | 手机号归属地（省份-城市），例如：江苏-南通 |
| `data.originalIsp` | string | 原运营商，例如：电信 / 移动 / 联通 |
| `data.isVirtuallyIsp` | number | 是否虚拟运营商：0 = 否，1 = 是 |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码，见下表 |
| `msg` | string | 错误描述 |

**错误码说明：**

| code | 说明 |
|------|------|
| 400 | 参数错误（如手机号格式不正确） |
| 501 | 官方数据源维护，请稍候再试 |
| 999 | 其他错误，以实际返回为准 |

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **参数传递方式**：`mobile_number` 必须通过 URL Query 参数传递，不在请求体中，请勿放入 POST body。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），以及业务错误码 400 / 501 / 999。
- **计费**：每次调用折扣价 ¥0.02（原价 ¥0.10），请避免不必要的重复调用。
- **数据时效**：接口直连三大运营商实时查询，非缓存数据，可用于携号转网状态识别。
- **Plugin ID**：`693a129f-b564-47d3-8d45-a080bab70148`
- **API ID**：`api-ELbWz8OmB58Y`
