# 发送短信验证码接口

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `3f0f386a-cdcf-47ed-a17a-df726918136d` |
| API ID | `api-W9z3M74x6ZNL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-W9z3M74x6ZNL-gateway.appmiaoda.com/v1/code/send_message` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-W9z3M74x6ZNL-gateway.appmiaoda.com` |
| 计费 | 启用，原价 ¥2.70 / 次，折扣价 ¥2.00 / 次（price_unit: 2） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `mobile` | string | 是 | 接收短信的手机号码 |
| `sessionId` | string | 否 | 用于标识会话的唯一 ID；若为空则自动生成 UUID 格式的 sessionId 并在响应中返回；若提供，长度必须小于 100 个字符 |

---

## 响应字段表

### 成功响应（status: 0）

```json
{
  "msg": "发送成功",
  "status": 0,
  "data": {
    "sessionId": "e325ea68-02c1-47ad-8844-c7b93cafaeba"
  }
}
```

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，0 表示成功，其他值表示失败 |
| `msg` | string | 响应描述信息 |
| `data.sessionId` | string | UUID 格式的会话唯一标识符（36 字符），后续验证时需携带相同值 |

### 失败响应（status 非 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 非 0 的错误码 |
| `msg` | string | 错误描述信息 |

---

## 使用场景说明

当应用需要通过短信验证用户身份时使用本接口，例如用户注册、登录时的手机号验证，或敏感操作（如修改密码、绑定账号）前的二次身份核验。典型调用流程为：用户填写手机号后触发发送请求，后端调用本接口获取 `sessionId`，再将其与手机号一同传递给前端，供后续调用验证接口时使用。

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface SendMessageResponse {
  msg: string;
  status: number;
  data: {
    sessionId: string;
  };
}

/**
 * 向指定手机号发送短信验证码，返回用于后续验证的 sessionId。
 * @param mobile 接收短信的手机号码
 * @param sessionId 可选，用于标识会话的唯一 ID；为空时自动生成 UUID
 * @returns 包含 sessionId 的响应数据
 */
async function sendSmsCode(
  mobile: string,
  sessionId?: string,
): Promise<SendMessageResponse["data"]> {
  const body: Record<string, string> = { mobile };
  if (sessionId) {
    body.sessionId = sessionId;
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-W9z3M74x6ZNL-gateway.appmiaoda.com/v1/code/send_message",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: SendMessageResponse = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.msg}`);

  return json.data;
}

// 示例用法
const result = await sendSmsCode("18600737571");
console.log("sessionId:", result.sessionId);
```

---

## Edge Function 代码

```typescript
// edge-functions/send-sms-code.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let mobile: string;
  let sessionId: string | undefined;
  try {
    const body = await req.json();
    mobile = body.mobile;
    if (!mobile) throw new Error("Missing mobile");
    sessionId = body.sessionId;
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
  const requestBody: Record<string, string> = { mobile };
  if (sessionId) {
    requestBody.sessionId = sessionId;
  }

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-W9z3M74x6ZNL-gateway.appmiaoda.com/v1/code/send_message",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
interface SendSmsResult {
  sessionId: string;
}

/**
 * 通过 Edge Function 发送短信验证码。
 * @param mobile 手机号码
 * @param sessionId 可选，自定义会话 ID（长度 < 100 字符）
 * @returns 包含 sessionId 的对象
 */
async function sendSmsCode(
  mobile: string,
  sessionId?: string,
): Promise<SendSmsResult> {
  const { data, error } = await supabase.functions.invoke("send-sms-code", {
    body: { mobile, ...(sessionId ? { sessionId } : {}) },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`发送失败 ${data.status}：${data.msg}`);
  return data.data as SendSmsResult;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 通过 Edge Function 发送短信验证码（小程序端）。
 * @param mobile 手机号码
 * @param sessionId 可选，自定义会话 ID
 * @returns 包含 sessionId 的对象
 */
async function sendSmsCode(
  mobile: string,
  sessionId?: string,
): Promise<SendSmsResult> {
  const { data, error } = await supabase.functions.invoke("send-sms-code", {
    body: { mobile, ...(sessionId ? { sessionId } : {}) },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`发送失败 ${data.status}：${data.msg}`);
  return data.data as SendSmsResult;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：发送接口已启用计费，折扣价 ¥2.00 / 次，原价 ¥2.70 / 次，避免不必要的重复调用。
- **sessionId 生命周期**：sessionId 需在发送和验证接口中保持一致，以关联同一业务会话。
  若前端自行管理会话，建议在发送时传入自定义 sessionId；否则从响应中提取自动生成的值。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），这两类错误由 Edge Function 原样转发。
- **sessionId 格式**：若提供自定义值，长度必须小于 100 个字符；自动生成时为 UUID 格式（36 字符）。
