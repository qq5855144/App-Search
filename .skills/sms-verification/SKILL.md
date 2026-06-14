---
name: sms-verification
description: 发送和验证短信验证码，适用于安全认证、用户登录、身份核验等需要短信 OTP 的场景
license: MIT
---

## ⚠️ 适用范围警告

**本插件不适用于登录/注册场景的手机验证码。**

如果需求是「用户注册或登录时验证手机号」，必须使用 Supabase Auth 原生接口，而不是本插件：

```ts
// Step 1: Send OTP（发送验证码）
const { error } = await supabase.auth.signInWithOtp({
  phone: "+86" + phoneNumber,
});

// Step 2: Verify OTP（验证验证码 → 完成登录）
const { data, error } = await supabase.auth.verifyOtp({
  phone: "+86" + phoneNumber,
  token: otpCode,
  type: "sms",
});
```

原因：本插件维护自己独立的 SMS 状态（sessionId），与 Supabase Auth OTP 流程并行运行，会导致双重发送、状态不同步或静默失败。

**本插件的适用场景：** 与登录无关的业务短信验证，例如支付确认、操作二次验证、手机绑定等。

---

## 能力概述

本插件提供完整的短信验证码发送与验证流程，包含两个接口：

| 接口 | 端点 | 说明 |
|------|------|------|
| 发送短信验证码 | POST `https://app-cblk1rqa5fk1-api-W9z3M74x6ZNL-gateway.appmiaoda.com/v1/code/send_message` | 向指定手机号发送验证码，返回 sessionId |
| 验证短信验证码 | POST `https://app-cblk1rqa5fk1-api-Xa6JZxjyqK0a-gateway.appmiaoda.com/v1/code/verify_message_code` | 根据 sessionId + 手机号 + 验证码进行校验 |

**核心流程：**
1. 调用"发送"接口，传入手机号（可选 sessionId），获得 `sessionId`
2. 用户收到验证码后，调用"验证"接口，传入 sessionId、手机号、验证码，返回验证结果

**认证方式：** `platform_managed`，密钥由平台注入（`INTEGRATIONS_API_KEY`）
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**支持平台：** Web、MiniProgram

详细参数表和代码实现见：
- `references/send-message-api.md` — 发送短信验证码接口
- `references/verify-message-code-api.md` — 验证短信验证码接口

---

## 生成期用法（Agent 直接调用）

认证模式为 `platform_managed`，密钥从环境变量读取：`process.env["INTEGRATIONS_API_KEY"]`。

两个接口需依次调用：先发送，获得 sessionId 后再验证。

详见：
- `references/send-message-api.md` — 发送接口生成期代码
- `references/verify-message-code-api.md` — 验证接口生成期代码

---

## 生成后用法（应用内通过 Edge Function 调用）

每个接口对应一个独立 Edge Function，前端通过 `supabase.functions.invoke` 调用。
Web 和 MiniProgram 共用相同的 Edge Function，均返回 JSON 响应，无平台差异。

详见：
- `references/send-message-api.md` — 发送接口 Edge Function + 前端代码
- `references/verify-message-code-api.md` — 验证接口 Edge Function + 前端代码
