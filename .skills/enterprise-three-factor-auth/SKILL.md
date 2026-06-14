---
name: enterprise-three-factor-auth
description: 验证企业名称、统一社会信用代码和法人姓名三要素是否一致，适用于企业身份核实、工商信息验证等场景
license: MIT
---

## 能力概述

调用企业三要素验证接口，传入企业名称、统一社会信用代码和法人姓名，校验三要素是否与工商信息一致，并返回具体不一致项。

- **Endpoint**: `GET https://app-cblk1rqa5fk1-api-Aa2PZnjE80BL-gateway.appmiaoda.com/company_three/get`
- **认证方式**: platform_managed（密钥由平台注入，读取 `INTEGRATIONS_API_KEY`）
- **Content-Type**: `application/json;charset=UTF-8`
- **响应格式**: JSON

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `companyName` | string | 是 | 公司名称 |
| `creditNo` | string | 是 | 统一社会信用代码 |
| `legalPerson` | string | 是 | 法人姓名 |

### 响应字段说明

**成功响应（`success: true`, `code: 200`）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | boolean | 请求成功标识，`true` 为成功 |
| `code` | number | 状态码，成功为 200 |
| `msg` | string | 状态描述 |
| `data.order_no` | string | 订单号 |
| `data.result` | number | 验证结果码（见下表） |
| `data.desc` | string | 结果描述 |

**`result` 结果对照表：**

| result | 说明 |
|--------|------|
| 0 | 一致 |
| 1 | 企业名称不一致 |
| 2 | 社会统一信用代码不一致 |
| 3 | 法人名称不一致 |
| 9 | 不一致 |

**失败响应（`success: false`）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | boolean | `false` |
| `code` | number | 错误状态码（如 400） |
| `msg` | string | 错误描述（如"入参错误"） |
| `data` | object | 空对象 `{}` |

### 响应示例

```json
{
  "msg": "成功",
  "success": true,
  "code": 200,
  "data": {
    "order_no": "426621381069965596",
    "result": 0,
    "desc": "一致"
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface CompanyThreeFactorResult {
  order_no: string;
  result: number;
  desc: string;
}

/**
 * 验证企业三要素（企业名称、统一社会信用代码、法人姓名）是否与工商信息一致。
 * @param companyName - 公司名称
 * @param creditNo - 统一社会信用代码
 * @param legalPerson - 法人姓名
 * @returns 验证结果，含 result 码和描述
 */
async function verifyCompanyThreeFactors(
  companyName: string,
  creditNo: string,
  legalPerson: string
): Promise<CompanyThreeFactorResult> {
  const params = new URLSearchParams({ companyName, creditNo, legalPerson });
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-Aa2PZnjE80BL-gateway.appmiaoda.com/company_three/get?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (!json.success || json.code !== 200) {
    throw new Error(`API error ${json.code}: ${json.msg}`);
  }

  return json.data;
}

// 示例调用
const result = await verifyCompanyThreeFactors(
  "示例公司",
  "91110000000000000X",
  "张三"
);
console.log(`验证结果: ${result.result} - ${result.desc}`);
// result === 0 表示三要素一致
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/company-three-factor-auth.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let companyName: string;
  let creditNo: string;
  let legalPerson: string;
  try {
    const body = await req.json();
    companyName = body.companyName;
    creditNo = body.creditNo;
    legalPerson = body.legalPerson;
    if (!companyName) throw new Error("Missing companyName");
    if (!creditNo) throw new Error("Missing creditNo");
    if (!legalPerson) throw new Error("Missing legalPerson");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const params = new URLSearchParams({ companyName, creditNo, legalPerson });
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-Aa2PZnjE80BL-gateway.appmiaoda.com/company_three/get?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

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

### 前端调用代码

Web 和 MiniProgram 均可使用 supabase client 调用，响应为标准 JSON，无平台差异。

**推荐方式（supabase client 可用时）：**

```typescript
interface CompanyThreeFactorResult {
  order_no: string;
  result: number;
  desc: string;
}

/**
 * 通过 Edge Function 验证企业三要素。
 * @param companyName - 公司名称
 * @param creditNo - 统一社会信用代码
 * @param legalPerson - 法人姓名
 * @returns 验证结果，含 result 码和描述
 */
async function verifyCompanyThreeFactors(
  companyName: string,
  creditNo: string,
  legalPerson: string
): Promise<CompanyThreeFactorResult> {
  const { data, error } = await supabase.functions.invoke("company-three-factor-auth", {
    body: { companyName, creditNo, legalPerson },
  });
  if (error) throw error;
  if (!data.success || data.code !== 200) {
    throw new Error(`API 错误 ${data.code}：${data.msg}`);
  }
  return data.data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用企业三要素 Edge Function。
 * @param companyName - 公司名称
 * @param creditNo - 统一社会信用代码
 * @param legalPerson - 法人姓名
 * @returns 验证结果，含 result 码和描述
 */
async function verifyCompanyThreeFactors(
  companyName: string,
  creditNo: string,
  legalPerson: string
): Promise<CompanyThreeFactorResult> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-three-factor-auth`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, creditNo, legalPerson }),
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
  if (!json.success || json.code !== 200) {
    throw new Error(`API 错误 ${json.code}：${json.msg}`);
  }
  return json.data;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种错误状态码。
- **计费**：每次调用按次计费，折扣价 ¥3.75 / 次（原价 ¥4.50 / 次），避免不必要的重复调用。
- **结果判断**：`data.result === 0` 表示三要素完全一致；其他值表示具体哪项不一致，详见 result 对照表。
- **必填参数**：`companyName`、`creditNo`、`legalPerson` 三个参数均为必填，任一缺失将返回 400 入参错误。
- **Plugin ID**: `a7c30985-2084-4205-9dbd-9d84238e0b3f`
- **API ID**: `api-Aa2PZnjE80BL`
- **third_part_domain**: `app-cblk1rqa5fk1-api-Aa2PZnjE80BL-gateway.appmiaoda.com`
