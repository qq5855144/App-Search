# 人脸 1:1 对比接口 API 参考

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `7aa1d315-3501-43e0-bb77-f00497304e4a` |
| API ID | `api-5YrZz81oerkY` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-5YrZz81oerkY-gateway.appmiaoda.com/rest/2.0/face/v3/match` |
| Auth 模式 | `platform_managed`（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-5YrZz81oerkY-gateway.appmiaoda.com` |
| 计费 | 启用，原价 ¥0.20/次，折扣价 ¥0.15/次 |

---

## 请求参数表

请求体为一个 JSON 数组，**必须包含恰好 2 个**人脸对象，每个对象的字段如下：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | `string` | 是 | Base64 编码的图像数据（或 face_token / URL，根据 image_type 决定） |
| `image_type` | `string` | 是 | 图像类型：`BASE64` / `FACE_TOKEN` / `URL` |
| `face_type` | `string` | 是 | 人脸图像类型：`LIVE`（生活照）/ `IDCARD`（身份证）/ `WATERMARK`（水印）/ `CERT`（证件照）/ `INFRARED`（红外）/ `HYBRID`（混合） |
| `quality_control` | `string` | 是 | 质量控制等级：`NONE` / `LOW` / `NORMAL` / `HIGH` |
| `liveness_control` | `string` | 是 | 活体检测等级：`NONE` / `LOW` / `NORMAL` / `HIGH` |

---

## 响应字段表

### 成功响应（`error_code: 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | `number` | 错误码，`0` 表示成功 |
| `error_msg` | `string` | 错误描述，成功时为 `"SUCCESS"` |
| `log_id` | `number` | 日志 ID，用于问题排查 |
| `result.score` | `number` | 相似度分数，范围 0–100，分数越高越相似 |
| `result.face_list[0].face_token` | `string` | 第一张图片人脸唯一标识，可用于后续操作 |
| `result.face_list[1].face_token` | `string` | 第二张图片人脸唯一标识，可用于后续操作 |

### 失败响应（`error_code != 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | `number` | 非零错误码 |
| `error_msg` | `string` | 错误描述 |
| `log_id` | `number` | 日志 ID |
| `result` | `null` | 失败时为 null |

---

## 生成期代码

在 Deno 脚本（生成期）中直接调用上游 API：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface FaceImage {
  /** Base64 编码图像数据、face_token 或图像 URL */
  image: string;
  /** 图像类型: BASE64 | FACE_TOKEN | URL */
  image_type: "BASE64" | "FACE_TOKEN" | "URL";
  /** 人脸类型: LIVE | IDCARD | WATERMARK | CERT | INFRARED | HYBRID */
  face_type: "LIVE" | "IDCARD" | "WATERMARK" | "CERT" | "INFRARED" | "HYBRID";
  /** 质量控制等级: NONE | LOW | NORMAL | HIGH */
  quality_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
  /** 活体检测等级: NONE | LOW | NORMAL | HIGH */
  liveness_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
}

interface FaceMatchResult {
  /** 相似度分数，范围 0-100 */
  score: number;
  /** 两张人脸的 token 列表 */
  face_list: Array<{ face_token: string }>;
}

/**
 * 对比两张图片中人脸的相似度。
 * @param face1 第一张人脸图像信息
 * @param face2 第二张人脸图像信息
 * @returns 相似度分数和人脸 token 列表
 */
async function callFaceMatch(face1: FaceImage, face2: FaceImage): Promise<FaceMatchResult> {
  const response = await fetch("https://app-cblk1rqa5fk1-api-5YrZz81oerkY-gateway.appmiaoda.com/rest/2.0/face/v3/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify([face1, face2]),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.error_code !== 0) {
    throw new Error(`API error ${json.error_code}: ${json.error_msg}`);
  }

  return json.result as FaceMatchResult;
}

// 使用示例：对比一张生活照和一张身份证照片
const result = await callFaceMatch(
  {
    image: "sfasq35sadvsvqwr5q...",  // Base64 编码的生活照
    image_type: "BASE64",
    face_type: "LIVE",
    quality_control: "LOW",
    liveness_control: "HIGH",
  },
  {
    image: "sfasq35sadvsvqwr5q...",  // Base64 编码的身份证照片
    image_type: "BASE64",
    face_type: "IDCARD",
    quality_control: "LOW",
    liveness_control: "HIGH",
  }
);

console.log(`相似度分数: ${result.score}`);
console.log(`人脸 Token 1: ${result.face_list[0].face_token}`);
console.log(`人脸 Token 2: ${result.face_list[1].face_token}`);
```

---

## Edge Function 代码

Web 和 MiniProgram 均返回 JSON，可共用同一个 Edge Function。

```typescript
// edge-functions/face-comparison.ts
import { serve } from "https://deno.land/std/http/server.ts";

interface FaceImage {
  /** Base64 编码图像数据、face_token 或图像 URL */
  image: string;
  /** 图像类型: BASE64 | FACE_TOKEN | URL */
  image_type: "BASE64" | "FACE_TOKEN" | "URL";
  /** 人脸类型: LIVE | IDCARD | WATERMARK | CERT | INFRARED | HYBRID */
  face_type: "LIVE" | "IDCARD" | "WATERMARK" | "CERT" | "INFRARED" | "HYBRID";
  /** 质量控制等级: NONE | LOW | NORMAL | HIGH */
  quality_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
  /** 活体检测等级: NONE | LOW | NORMAL | HIGH */
  liveness_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let face1: FaceImage;
  let face2: FaceImage;
  try {
    const body = await req.json();
    face1 = body.face1;
    face2 = body.face2;
    if (!face1 || !face2) throw new Error("Missing face1 or face2");
    if (!face1.image || !face1.image_type || !face1.face_type ||
        !face1.quality_control || !face1.liveness_control) {
      throw new Error("face1 is missing required fields");
    }
    if (!face2.image || !face2.image_type || !face2.face_type ||
        !face2.quality_control || !face2.liveness_control) {
      throw new Error("face2 is missing required fields");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: `Invalid request body: ${(e as Error).message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（绝不暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-5YrZz81oerkY-gateway.appmiaoda.com/rest/2.0/face/v3/match",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify([face1, face2]),
    }
  );

  // 原样转发配额/余额错误
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

---

## 前端调用代码

### Web 平台（React / Vite）

**推荐方式（supabase client 可用时）：**

```typescript
import { supabase } from "@/lib/supabaseClient";

interface FaceImage {
  image: string;
  image_type: "BASE64" | "FACE_TOKEN" | "URL";
  face_type: "LIVE" | "IDCARD" | "WATERMARK" | "CERT" | "INFRARED" | "HYBRID";
  quality_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
  liveness_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
}

/**
 * 调用人脸 1:1 对比接口，返回相似度分数。
 * @param face1 第一张人脸图像信息
 * @param face2 第二张人脸图像信息
 * @returns 相似度分数（0-100）和人脸 token 列表
 */
async function fetchFaceMatch(face1: FaceImage, face2: FaceImage) {
  const { data, error } = await supabase.functions.invoke("face-comparison", {
    body: { face1, face2 },
  });
  if (error) throw error;
  if (data.error_code !== 0) {
    throw new Error(`API 错误 ${data.error_code}: ${data.error_msg}`);
  }
  return data.result as { score: number; face_list: Array<{ face_token: string }> };
}

// 使用示例
const result = await fetchFaceMatch(
  {
    image: "<base64-encoded-image-1>",
    image_type: "BASE64",
    face_type: "LIVE",
    quality_control: "LOW",
    liveness_control: "HIGH",
  },
  {
    image: "<base64-encoded-image-2>",
    image_type: "BASE64",
    face_type: "IDCARD",
    quality_control: "LOW",
    liveness_control: "HIGH",
  }
);
console.log(`相似度分数: ${result.score}`);
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchFaceMatch(face1: FaceImage, face2: FaceImage) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/face-comparison`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ face1, face2 }),
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
  if (json.error_code !== 0) throw new Error(`API 错误 ${json.error_code}: ${json.error_msg}`);
  return json.result as { score: number; face_list: Array<{ face_token: string }> };
}
```

### MiniProgram 平台（Taro）

```typescript
import { supabase } from "@/lib/supabaseClient";

interface FaceImage {
  image: string;
  image_type: "BASE64" | "FACE_TOKEN" | "URL";
  face_type: "LIVE" | "IDCARD" | "WATERMARK" | "CERT" | "INFRARED" | "HYBRID";
  quality_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
  liveness_control: "NONE" | "LOW" | "NORMAL" | "HIGH";
}

/**
 * 调用人脸 1:1 对比接口（MiniProgram 版本）。
 * @param face1 第一张人脸图像信息
 * @param face2 第二张人脸图像信息
 * @returns 相似度分数（0-100）和人脸 token 列表
 */
async function fetchFaceMatch(face1: FaceImage, face2: FaceImage) {
  const { data, error } = await supabase.functions.invoke("face-comparison", {
    body: { face1, face2 },
  });
  if (error) throw error;
  if (data.error_code !== 0) {
    throw new Error(`API 错误 ${data.error_code}: ${data.error_msg}`);
  }
  return data.result as { score: number; face_list: Array<{ face_token: string }> };
}
```

---

## 注意事项

1. **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get` 读取，
   严禁暴露到前端代码或浏览器环境。

2. **错误处理**: 务必处理以下错误码：
   - HTTP 429 — 配额超限，建议提示用户稍后重试
   - HTTP 402 — 账户余额不足，需充值后继续使用
   - `error_code !== 0` — 上游 API 业务错误，常见原因：图片质量不达标、未检测到人脸、图片格式不支持

3. **计费**: 每次调用费用 ¥0.15（折扣价），原价 ¥0.20，请避免不必要的重复调用（如用户未确认时勿频繁发送）。

4. **图片格式**: 支持 jpg、jpeg、png、bmp 格式，使用 BASE64 时请确保编码后不含 data URI 前缀
   （即 `data:image/jpeg;base64,` 这类前缀需去掉，仅传纯 Base64 字符串）。

5. **请求体约束**: 请求数组**必须恰好包含 2 个**人脸对象，多于或少于 2 个均会报错。

6. **质量与活体控制**: `quality_control` 和 `liveness_control` 建议根据场景选择：
   - 安全要求高的认证场景（如身份核验）: 两者均设为 `HIGH`
   - 普通人脸登录场景: 可设为 `NORMAL` 或 `LOW` 以提高通过率
