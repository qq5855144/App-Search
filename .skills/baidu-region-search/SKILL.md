---
name: baidu-region-search
description: 百度地图行政区划查询，根据关键字或adcode检索省市区县乡镇街道等多级行政区划信息，支持返回下级行政区列表和边界坐标，适合地址补全、区域选择等场景。
license: MIT
---

## 能力概述

基于百度地图提供全国标准行政区划查询能力，根据关键字（行政区名称或 adcode）检索省、市、区县、乡镇街道等多级行政区划信息，可选择返回下级行政区列表（最多3级）和区划边界坐标数据。

| 属性 | 值 |
|------|---|
| Endpoint | `GET https://app-cblk1rqa5fk1-api-DYJwn2VZXvEa-gateway.appmiaoda.com/api_region_search/v1/` |
| 认证模式 | platform_managed（密钥由平台注入，读取 `INTEGRATIONS_API_KEY`） |
| 响应格式 | JSON |
| 计费 | 原价 ¥1.20 / 千次，折扣价 ¥0.75 / 千次 |

**响应示例：**

```json
{
  "status": 0,
  "data_version": "20220722",
  "result_size": 1,
  "districts": [
    {
      "code": "",
      "name": "山东省",
      "level": 1,
      "districts": [
        {
          "code": "",
          "name": "济南市",
          "level": 2,
          "districts": []
        }
      ]
    }
  ]
}
```

---

## 生成期用法（Agent 直接调用）

在代码生成阶段，Agent 从 `INTEGRATIONS_API_KEY` 环境变量读取密钥，直接调用上游接口。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 查询中国行政区划信息。
 *
 * @param keyword - 行政区划关键字，可填写区划名称（如"山东"、"济南市"）或 adcode，必填
 * @param subAdmin - 返回下级行政区层级数：0（不返回）、1、2、3，默认 0
 * @param extensionsCode - 是否返回国标行政区划编码：1（返回）、0（不返回），默认 0
 * @param boundary - 是否返回区划边界数据：0（不返回）、1（返回，仅支持省市区），默认 0
 * @param boundarycode - 需要返回边界数据的行政区划编码，不填则返回 keyword 匹配到的第一个区划边界
 * @returns 包含 districts 列表和可选 polyline 的响应对象
 */
async function queryAdminRegion(
  keyword: string,
  subAdmin: string = "0",
  extensionsCode: string = "0",
  boundary: string = "0",
  boundarycode?: string,
): Promise<{
  status: number;
  data_version: string;
  result_size: number;
  districts: Array<{
    code: string;
    name: string;
    level: number;
    districts: unknown[];
  }>;
  polyline?: string;
}> {
  const params = new URLSearchParams({ keyword, sub_admin: subAdmin, extensions_code: extensionsCode, boundary });
  if (boundarycode) {
    params.set("boundarycode", boundarycode);
  }

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-DYJwn2VZXvEa-gateway.appmiaoda.com/api_region_search/v1/?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== 0) {
    throw new Error(`API error ${json.status}: 查询行政区划失败`);
  }

  return json;
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

生成的应用中，前端**不得直接持有 `INTEGRATIONS_API_KEY`**。必须通过 Deno Edge Function 代理调用——Edge Function 从 `INTEGRATIONS_API_KEY` 环境变量读取密钥后转发请求。

### Edge Function

```typescript
// edge-functions/baidu-region-search.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let keyword: string;
  let subAdmin: string = "0";
  let extensionsCode: string = "0";
  let boundary: string = "0";
  let boundarycode: string | undefined;

  try {
    const body = await req.json();
    keyword = body.keyword;
    if (!keyword) {
      throw new Error("Missing keyword");
    }
    if (body.sub_admin !== undefined) {
      subAdmin = String(body.sub_admin);
    }
    if (body.extensions_code !== undefined) {
      extensionsCode = String(body.extensions_code);
    }
    if (body.boundary !== undefined) {
      boundary = String(body.boundary);
    }
    if (body.boundarycode !== undefined) {
      boundarycode = String(body.boundarycode);
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const params = new URLSearchParams({ keyword, sub_admin: subAdmin, extensions_code: extensionsCode, boundary });
  if (boundarycode) {
    params.set("boundarycode", boundarycode);
  }

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-DYJwn2VZXvEa-gateway.appmiaoda.com/api_region_search/v1/?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
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
      { status: 502, headers: { "Content-Type": "application/json" } },
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
 * 通过 Edge Function 查询行政区划信息。
 *
 * @param keyword - 行政区划关键字（名称或 adcode）
 * @param options - 可选参数：sub_admin、extensions_code、boundary、boundarycode
 * @returns 行政区划列表及相关元数据
 */
async function fetchAdminRegion(
  keyword: string,
  options?: {
    sub_admin?: string;
    extensions_code?: string;
    boundary?: string;
    boundarycode?: string;
  },
) {
  const { data, error } = await supabase.functions.invoke("baidu-region-search", {
    body: { keyword, ...options },
  });
  if (error) {
    throw error;
  }
  if (data.status !== 0) {
    throw new Error(`API 错误 ${data.status}：查询行政区划失败`);
  }
  return data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过 Edge Function 查询行政区划信息（fetch 直调方式）。
 *
 * @param keyword - 行政区划关键字（名称或 adcode）
 * @param options - 可选参数：sub_admin、extensions_code、boundary、boundarycode
 * @returns 行政区划列表及相关元数据
 */
async function fetchAdminRegion(
  keyword: string,
  options?: {
    sub_admin?: string;
    extensions_code?: string;
    boundary?: string;
    boundarycode?: string;
  },
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-region-search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, ...options }),
    },
  );

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`配额已用尽：${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`余额不足：${err.message ?? res.statusText}`);
  }
  if (!res.ok) {
    throw new Error(`请求失败：${res.status}`);
  }

  const json = await res.json();
  if (json.status !== 0) {
    throw new Error(`API 错误 ${json.status}：查询行政区划失败`);
  }
  return json;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `keyword` | string | 是 | — | 行政区划关键字，可填写区划名称（如"中国"、"山东"、"济南市"）或 adcode，不支持多关键字 |
| `sub_admin` | string | 否 | `"0"` | 返回子级行政区层级数：0（不返回）、1（下一级）、2（下两级）、3（下三级） |
| `extensions_code` | string | 否 | `"0"` | 是否返回国标行政区划编码：1（返回）、0（不返回） |
| `boundary` | string | 否 | `"0"` | 是否返回区划边界数据：0（不返回）、1（返回，仅支持省市区，不返回子级数据） |
| `boundarycode` | string | 否 | — | 需要返回边界数据的行政区划编码；若不填则返回 keyword 匹配到的第一个区划边界 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | `number` | 状态码：0 正常，-1 关键字为空，-3 未知错误 |
| `data_version` | `string` | 行政区划数据版本（如"20220722"） |
| `result_size` | `number` | 检索到的包含关键字信息的行政区划个数 |
| `districts` | `array` | 行政区划列表 |
| `districts[].code` | `string` | 行政区划编码（adcode） |
| `districts[].name` | `string` | 行政区划名称 |
| `districts[].level` | `number` | 行政区划级别：0（全国）、1（省份）、2（市）、3（区/县）、4（镇/乡/街道） |
| `districts[].districts` | `array` | 下级行政区列表（受 `sub_admin` 控制） |
| `polyline` | `string?` | 行政区划边界数据（仅 `boundary=1` 时返回），多块地块以 `|` 分隔 |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），以及 `status` 非 0 的业务错误（-1 关键字为空，-3 未知错误）。
- **计费**：原价 ¥1.20 / 千次，折扣价 ¥0.75 / 千次，避免不必要的重复调用。
- **boundary 限制**：`boundary=1` 时仅返回所查询区划的边界数据，不返回子级数据，且仅支持省、市、区三级。
- **单关键字限制**：`keyword` 不支持多关键字检索，每次只能查询一个区划名称或 adcode。
- **sub_admin 与 boundary 互斥**：同时传 `sub_admin>0` 和 `boundary=1` 时，边界数据不返回子级，以 API 文档约定为准。
