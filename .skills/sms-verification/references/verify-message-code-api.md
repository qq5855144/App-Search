# 验证短信验证码接口

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `3f0f386a-cdcf-47ed-a17a-df726918136d` |
| API ID | `api-Xa6JZxjyqK0a` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Xa6JZxjyqK0a-gateway.appmiaoda.com/v1/code/verify_message_code` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-Xa6JZxjyqK0a-gateway.appmiaoda.com` |
| 计费 | 未启用（`enable_billing: false`） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `sessionId` | string | 是 | 短信验证会话的唯一标识符，必须与发送短信验证码时返回的 sessionId 保持一致 |
| `code` | string | 是 | 用户输入的短信验证码 |
| `mobile` | string | 是 | 接收短信的手机号码 |

---

## 响应字段表

### 成功响应（status: 0）

```json
{
  "msg": "验证成功",
  "status": 0
}
```

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，0 表示验证成功，其他值表示失败 |
| `msg` | string | 响应描述信息，如"验证成功" |

### 失败响应（status 非 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 非 0 的错误码，表示验证失败 |
| `msg` | string | 错误描述信息，如验证码错误、已过期等 |

---

## 使用场景说明

当用户收到短信验证码并填写后，调用本接口完成验证环节。典型场景包括：用户注册时确认手机号归属、登录时校验身份，以及修改密码等敏感操作的二次确认。调用时需携带发送接口返回的 `sessionId`、用户输入的验证码以及对应手机号，三者须与发送时保持一致方可通过校验。

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface VerifyMessageResponse {
  msg: string;
  status: number;
}

/**
 * 验证短信验证码，通过 sessionId 关联发送和验证操作。
 * @param sessionId 发送验证码时获得的会话 ID
 * @param code 用户输入的短信验证码
 * @param mobile 接收短信的手机号码
 * @returns 验证成功时返回响应对象（status: 0）
 */
async function verifySmsCode(
  sessionId: string,
  code: string,
  mobile: string,
): Promise<VerifyMessageResponse> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyqK0a-gateway.appmiaoda.com/v1/code/verify_message_code",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ sessionId, code, mobile }),
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: VerifyMessageResponse = await response.json();
  if (json.status !== 0) throw new Error(`验证失败 ${json.status}: ${json.msg}`);

  return json;
}

// 示例用法（配合发送接口）
const { sessionId } = await sendSmsCode("18600737571");
const result = await verifySmsCode(sessionId, "379016", "18600737571");
console.log("验证结果:", result.msg);
```

---

## Edge Function 代码

```typescript
// edge-functions/verify-sms-code.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let sessionId: string;
  let code: string;
  let mobile: string;
  try {
    const body = await req.json();
    sessionId = body.sessionId;
    code = body.code;
    mobile = body.mobile;
    if (!sessionId) throw new Error("Missing sessionId");
    if (!code) throw new Error("Missing code");
    if (!mobile) throw new Error("Missing mobile");
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

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyqK0a-gateway.appmiaoda.com/v1/code/verify_message_code",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ sessionId, code, mobile }),
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

---

## 前端调用代码

### Web 平台（推荐，supabase client 可用时）

```typescript
interface VerifySmsResult {
  status: number;
  msg: string;
}

/**
 * 通过 Edge Function 验证短信验证码。
 * @param sessionId 发送验证码时返回的会话 ID
 * @param code 用户输入的验证码
 * @param mobile 手机号码
 * @returns 验证响应对象
 */
async function verifySmsCode(
  sessionId: string,
  code: string,
  mobile: string,
): Promise<VerifySmsResult> {
  const { data, error } = await supabase.functions.invoke("verify-sms-code", {
    body: { sessionId, code, mobile },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`验证失败 ${data.status}：${data.msg}`);
  return data as VerifySmsResult;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 通过 Edge Function 验证短信验证码（小程序端）。
 * @param sessionId 发送验证码时返回的会话 ID
 * @param code 用户输入的验证码
 * @param mobile 手机号码
 * @returns 验证响应对象
 */
async function verifySmsCode(
  sessionId: string,
  code: string,
  mobile: string,
): Promise<VerifySmsResult> {
  const { data, error } = await supabase.functions.invoke("verify-sms-code", {
    body: { sessionId, code, mobile },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`验证失败 ${data.status}：${data.msg}`);
  return data as VerifySmsResult;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：验证接口未启用计费（`enable_billing: false`），调用不产生费用。
- **sessionId 一致性**：必须使用与发送接口相同的 sessionId，确保发送和验证属于同一业务会话。
  sessionId 来源：若发送时未提供，从发送接口响应的 `data.sessionId` 中读取。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），这两类错误由 Edge Function 原样转发。
  验证失败（如验证码错误或过期）通过 `status !== 0` 和 `msg` 字段表达，不会返回 HTTP 错误码。
- **验证码时效**：短信验证码存在有效期，建议在用户收到验证码后尽快完成验证，避免超时失效。
