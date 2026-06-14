---
name: id-card-two-factor-auth
description: 身份证二要素实名认证，验证身份证号与姓名是否匹配，返回性别、生日、户籍地址等信息。需要实名核验、身份认证时使用。
license: MIT
---

## 能力概述

通过身份证号和姓名进行二要素实名认证，验证两者是否匹配，并返回用户性别、生日、身份证注册地等信息。后台配备多冗余渠道，可通过系统监控自动切换，保障服务高可用性与高成功率。

- **Endpoint**：`GET https://app-cblk1rqa5fk1-api-oLpZ74noWOMa-gateway.appmiaoda.com/idcard`
- **认证方式**：platform_managed（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`）
- **核心参数**：`idcard`（身份证号）、`name`（姓名）
- **响应格式**：JSON，业务结果在 `showapi_res_body` 中，`code=0` 表示匹配

**响应示例（匹配）：**

```json
{
  "showapi_res_error": "",
  "showapi_res_id": "68e872ddfb638ca67cdbd345",
  "showapi_res_code": 0,
  "showapi_fee_num": 1,
  "showapi_res_body": {
    "ret_code": 0,
    "code": 0,
    "msg": "匹配",
    "order": "845563287741872",
    "province": "贵州省",
    "city": "黔东南苗族侗族自治州",
    "county": "剑河县",
    "address": "详细地址",
    "sex": "M",
    "birthday": "1979-11-08"
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 调用身份证二要素实名认证接口，验证身份证号与姓名是否匹配。
 * @param idcard 身份证号，例如：522629197911080415
 * @param name 姓名，例如：张三（内部会自动进行 URL 编码）
 * @returns showapi_res_body 业务响应体
 */
async function verifyIdCardTwoFactor(
  idcard: string,
  name: string
): Promise<{
  ret_code: number;
  code: number;
  msg: string;
  order: string;
  province: string;
  city: string;
  county: string;
  address: string;
  sex: string;
  birthday: string;
}> {
  const params = new URLSearchParams({ idcard, name });
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-oLpZ74noWOMa-gateway.appmiaoda.com/idcard?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.showapi_res_code !== 0) {
    throw new Error(`API error: ${json.showapi_res_error}`);
  }

  const body = json.showapi_res_body;
  if (body.ret_code !== 0) {
    throw new Error(`业务错误 ret_code=${body.ret_code}: ${body.msg}`);
  }

  return body;
}

// 使用示例
const result = await verifyIdCardTwoFactor("522629197911080415", "张三");
console.log(`验证结果：${result.msg}，code=${result.code}`);
// code=0：匹配；code=1：不匹配；code=2：无此身份证号码
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function（`edge-functions/id-card-two-factor-auth.ts`）

```typescript
// edge-functions/id-card-two-factor-auth.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let idcard: string;
  let name: string;
  try {
    const body = await req.json();
    idcard = body.idcard;
    name = body.name;
    if (!idcard) throw new Error("Missing idcard");
    if (!name) throw new Error("Missing name");
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

  // --- 调用上游接口（注意：姓名需 URL 编码）---
  const params = new URLSearchParams({ idcard, name });
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-oLpZ74noWOMa-gateway.appmiaoda.com/idcard?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // 透传配额超限/余额不足错误
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
 * 通过 Edge Function 调用身份证二要素实名认证。
 * @param idcard 身份证号
 * @param name 姓名
 * @returns showapi_res_body 业务响应体
 */
async function verifyIdCard(idcard: string, name: string) {
  const { data, error } = await supabase.functions.invoke("id-card-two-factor-auth", {
    body: { idcard, name },
  });
  if (error) throw error;
  if (data.showapi_res_code !== 0) {
    throw new Error(`API 错误：${data.showapi_res_error}`);
  }
  const body = data.showapi_res_body;
  if (body.ret_code !== 0) {
    throw new Error(`业务错误 ret_code=${body.ret_code}: ${body.msg}`);
  }
  return body;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用身份证二要素实名认证 Edge Function。
 * @param idcard 身份证号
 * @param name 姓名
 * @returns showapi_res_body 业务响应体
 */
async function verifyIdCard(idcard: string, name: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/id-card-two-factor-auth`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idcard, name }),
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
  if (json.showapi_res_code !== 0) {
    throw new Error(`API 错误：${json.showapi_res_error}`);
  }
  const body = json.showapi_res_body;
  if (body.ret_code !== 0) {
    throw new Error(`业务错误 ret_code=${body.ret_code}: ${body.msg}`);
  }
  return body;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `idcard` | string | 是 | 身份证号，例如：522629197911080415 |
| `name` | string | 是 | 姓名，例如：张三（请求时需 URL 编码，避免中文乱码） |

### 返回字段说明

**外层公共字段：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `showapi_res_code` | number | 外层响应状态码，0 表示接口调用成功 |
| `showapi_res_error` | string | 错误信息，空字符串表示无错误 |
| `showapi_res_id` | string | 响应唯一 ID |
| `showapi_fee_num` | number | 本次请求计费次数 |
| `showapi_res_body` | object | 核心业务响应体 |

**业务字段（`showapi_res_body`）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `ret_code` | number | 业务结果码，0=成功（计费），其余=失败（不计费） |
| `code` | number | 验证标示，见下方验证标示说明 |
| `msg` | string | 验证结果说明，与 `code` 对应 |
| `order` | string | 本次验证的流水号（唯一标识） |
| `sex` | string | 性别：M=男性，F=女性（由身份证号解析） |
| `birthday` | string | 用户生日，格式 YYYY-MM-DD（由身份证号解析） |
| `province` | string | 身份证注册地-省份 |
| `city` | string | 身份证注册地-城市 |
| `county` | string | 身份证注册地-区县 |
| `address` | string | 身份证注册地-详细地址（省+市+区县） |

**验证标示（`code`）含义：**

| code 值 | 含义 |
|---------|------|
| 0 | 身份证号与姓名匹配 |
| 1 | 身份证号与姓名不匹配 |
| 2 | 无此身份证号码（身份证号不存在） |
| 3 | 身份证号与姓名匹配，但照片比对失败 |
| 4 | 请求参数不能为空 |
| 12 | 身份证号码格式不合法 |
| 14 | 姓名格式异常（如含特殊字符、长度不符合规范） |
| 15 | 暂不支持该地域的身份证校验 |
| 100 | 渠道异常，请稍后再试（系统自动切换渠道中） |
| 101 | 验证信息重复输入，需间隔 60 秒以上再次核验 |
| 102 | 接口维护中，暂时无法提供服务 |
| 103 | 24 小时内相同姓名或身份证号的核验次数超限 |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：每次成功调用（`ret_code=0`）计费 1 次，原价 ¥2.20/次，折扣价 ¥1.80/次。`ret_code≠0` 的失败调用不计费，请在业务层做好参数校验，避免无效调用。
- **参数编码**：姓名参数中含中文，发起 GET 请求时须进行 URL 编码（`URLSearchParams` 会自动处理），避免乱码导致验证失败。
- **频率限制**：同一信息（姓名+身份证号）60 秒内不可重复验证；24 小时内同一姓名或身份证号核验次数有限制（超限返回 `code=103`）。
- **渠道切换**：返回 `code=100`（渠道异常）时，系统会自动切换冗余渠道，建议稍后重试，无需手动干预。
- **地域限制**：部分地域暂不支持校验（返回 `code=15`），以接口实际响应为准。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种 HTTP 状态码，在前端给出明确提示。
