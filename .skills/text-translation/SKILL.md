---
name: text-translation
description: 调用百度翻译 API 实现 200+ 语言互译，支持自动检测源语言；适用于需要多语言翻译的国际化应用、多语言网站和翻译工具场景。
license: MIT
---

## 能力概述

百度翻译通用版，支持中文、英语、日语、韩语、法语、德语、西班牙语、俄语等 200+ 语言互译，100+ 语种自动检测。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-e94GZ5j0PWpa-gateway.appmiaoda.com/rpc/2.0/mt/texttrans/v1`
- **认证方式**: platform_managed（密钥由平台注入，无需用户提供）
- **Content-Type**: `application/json;charset=utf-8`
- **计费**: ¥0.13 / 次（原价 ¥0.20 / 次）
- **支持平台**: Web / MiniProgram / App

**响应示例：**

```json
{
  "result": {
    "from": "en",
    "to": "zh",
    "trans_result": [
      { "src": "hello", "dst": "你好" },
      { "src": "Who are you", "dst": "你是谁" }
    ]
  }
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型   | 必填 | 说明                                               |
|--------|--------|------|----------------------------------------------------|
| `q`    | string | 是   | 待翻译文本，最大 6000 字符                         |
| `from` | string | 是   | 源语言代码，可设置为 `auto` 自动检测               |
| `to`   | string | 是   | 目标语言代码，不可设置为 `auto`                    |

**常用语言代码：** `zh`（中文简体）、`en`（英语）、`jp`（日语）、`kor`（韩语）、`fra`（法语）、
`de`（德语）、`spa`（西班牙语）、`ru`（俄语）、`pt`（葡萄牙语）、`it`（意大利语）、
`ara`（阿拉伯语）、`th`（泰语）、`vie`（越南语）

### 成功响应字段

| 字段路径                       | 类型     | 说明                     |
|-------------------------------|----------|--------------------------|
| `result.from`                 | string   | 检测到的源语言代码       |
| `result.to`                   | string   | 目标语言代码             |
| `result.trans_result[]`       | array    | 翻译结果列表             |
| `result.trans_result[].src`   | string   | 原文段落                 |
| `result.trans_result[].dst`   | string   | 译文段落                 |

### 失败响应字段

| 字段路径    | 类型   | 说明                           |
|------------|--------|--------------------------------|
| `log_id`   | number | 请求日志 ID，用于问题排查      |
| `error_code` | number | 错误码                       |
| `error_msg`  | string | 错误描述信息                 |

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 调用百度翻译通用版 API，将文本从源语言翻译为目标语言。
 * @param q - 待翻译文本，最大 6000 字符
 * @param from - 源语言代码，可设置为 "auto" 自动检测
 * @param to - 目标语言代码，不可设置为 "auto"
 * @returns 翻译结果对象，包含 from、to 和 trans_result 数组
 */
async function translateText(
  q: string,
  from: string,
  to: string,
): Promise<{
  from: string;
  to: string;
  trans_result: Array<{ src: string; dst: string }>;
}> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-e94GZ5j0PWpa-gateway.appmiaoda.com/rpc/2.0/mt/texttrans/v1",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ q, from, to }),
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.error_code) {
    throw new Error(`API error ${json.error_code}: ${json.error_msg}`);
  }

  return json.result;
}

// 使用示例
const result = await translateText("hello world", "auto", "zh");
console.log(result.trans_result.map((r) => r.dst).join("\n"));
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/text-translation.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let q: string;
  let from: string;
  let to: string;
  try {
    const body = await req.json();
    q = body.q;
    from = body.from;
    to = body.to;
    if (!q) throw new Error("Missing q");
    if (!from) throw new Error("Missing from");
    if (!to) throw new Error("Missing to");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-e94GZ5j0PWpa-gateway.appmiaoda.com/rpc/2.0/mt/texttrans/v1",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ q, from, to }),
    },
  );

  // 透传配额超限和余额不足错误
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

### 前端调用代码

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 调用百度翻译 API。
 * @param q - 待翻译文本
 * @param from - 源语言代码（可用 "auto" 自动检测）
 * @param to - 目标语言代码
 * @returns 翻译结果对象
 */
async function translateText(
  q: string,
  from: string,
  to: string,
): Promise<{ from: string; to: string; trans_result: Array<{ src: string; dst: string }> }> {
  const { data, error } = await supabase.functions.invoke("text-translation", {
    body: { q, from, to },
  });
  if (error) throw error;
  if (data.error_code) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过 Edge Function 调用百度翻译 API（原生 fetch 方式）。
 * @param q - 待翻译文本
 * @param from - 源语言代码（可用 "auto" 自动检测）
 * @param to - 目标语言代码
 * @returns 翻译结果对象
 */
async function translateText(
  q: string,
  from: string,
  to: string,
): Promise<{ from: string; to: string; trans_result: Array<{ src: string; dst: string }> }> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-translation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, from, to }),
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
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.error_code) throw new Error(`API 错误 ${json.error_code}：${json.error_msg}`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足），以及 API 返回的 `error_code`/`error_msg`。
- **计费**: 折扣价 ¥0.13 / 次（原价 ¥0.20 / 次），请避免不必要的重复调用。
- **文本长度**: 单次请求最多 6000 字符，超出需拆分。
- **目标语言限制**: `to` 字段不可设置为 `auto`，须指定明确的语言代码。
- **自动检测**: `from` 设置为 `auto` 时，实际检测到的源语言可从响应的 `result.from` 字段获取。
