# 图像内容理解 — 提交请求接口

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `b335d1cb-8d7e-44ab-b419-752d3d363680` |
| API ID | `api-DYJwo27V85oa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DYJwo27V85oa-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/request` |
| 生成期 URL（含 API ID） | `https://app-cblk1rqa5fk1-api-DYJwo27V85oa-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/request` |
| Content-Type | `application/json` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 认证模式 | `platform_managed` |
| third_part_domain | `app-cblk1rqa5fk1-api-DYJwo27V85oa-gateway.appmiaoda.com` |
| 计费 | 启用，原价 ¥10.40/千次，折扣价 ¥7.50/千次 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `question` | string | 是 | 提问信息，如「这张图片里有什么？」，限制 100 个字符以内 |
| `image` | string | 否 | 图片 Base64 编码数据，大小不超过 10M，最短边至少 64px，最长边最大 8192px |
| `url` | string | 否 | 图片完整 URL，长度不超过 1024 字节，优先级低于 `image` 字段 |

> `image` 与 `url` 至少提供一个；`image` 优先级高于 `url`。

---

## 响应字段表

**成功响应（HTTP 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 请求日志 ID |
| `result.task_id` | string | 异步任务 ID，用于查询结果 |

**响应示例：**

```json
{
  "log_id": "1826091287582742824",
  "result": {
    "task_id": "1826091287582742824"
  }
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 提交图像内容理解请求，返回异步任务 ID。
 * @param question - 提问信息，不超过 100 个字符
 * @param imageBase64 - 图片 Base64 编码（与 imageUrl 二选一，优先）
 * @param imageUrl - 图片 URL（与 imageBase64 二选一）
 * @returns 任务 ID
 */
async function submitImageUnderstanding(
  question: string,
  imageBase64?: string,
  imageUrl?: string
): Promise<{ taskId: string }> {
  if (!imageBase64 && !imageUrl) {
    throw new Error("image 或 url 至少需要提供一个");
  }

  const requestBody: Record<string, string> = { question };
  if (imageBase64) {
    requestBody.image = imageBase64;
  } else if (imageUrl) {
    requestBody.url = imageUrl;
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DYJwo27V85oa-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/request",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (!json.result?.task_id) {
    throw new Error(`提交失败：${JSON.stringify(json)}`);
  }

  return { taskId: json.result.task_id };
}
```

---

## Edge Function 代码

```typescript
// edge-functions/image-understanding-request.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let question: string;
  let imageBase64: string | undefined;
  let imageUrl: string | undefined;

  try {
    const body = await req.json();
    question = body.question;
    if (!question) throw new Error("Missing question");
    if (!body.image && !body.url) throw new Error("Missing image or url");
    imageBase64 = body.image;
    imageUrl = body.url;
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
  const requestBody: Record<string, string> = { question };
  if (imageBase64) {
    requestBody.image = imageBase64;
  } else if (imageUrl) {
    requestBody.url = imageUrl;
  }

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DYJwo27V85oa-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/request",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  // 直接透传配额/余额错误
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

### 图片获取（平台差异）

**小程序（Taro）**：图片选择后得到 `wxfile://` 临时路径，必须用回调式 API 读取为 base64，然后传 `image` 字段。不能将临时路径作为 `url` 传给 API（外部 API 无法访问设备本地文件，会返回 `image fetch failed`）。

```typescript
function readFileAsBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(err)
    })
  })
}

// 使用示例：选择图片后
const files = await selectMediaFiles({ count: 1, mediaType: ['image'] })
const tempFilePath = files[0].tempFilePath
const base64Data = await readFileAsBase64(tempFilePath)
const taskId = await submitImageUnderstanding('描述这张图片', base64Data)
```

**Web（React/Vue）**：图片选择后得到 `File` 对象，用 `FileReader` 转 base64。

```typescript
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // 去掉 data:image/xxx;base64, 前缀
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

**App（Expo）**：使用 `expo-image-picker`，`base64: true` 直接返回纯 Base64，无 `data:image/...;base64,` 前缀，与 API `image` 字段格式完全匹配，无需截取。

```typescript
import * as ImagePicker from 'expo-image-picker';

// 安装依赖：npx expo install expo-image-picker
async function pickImageAsBase64(): Promise<{ base64: string; mimeType: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true, // 直接返回纯 Base64，无需手动截取前缀
  });
  if (result.canceled || !result.assets[0].base64) return null;
  return {
    base64: result.assets[0].base64,           // 纯 Base64，直接传给 image 字段
    mimeType: result.assets[0].mimeType ?? 'image/jpeg',
  };
}
```

本接口为普通 JSON 请求（非 SSE 流式）。App 端为保持方案统一，**必须从 `expo/fetch` 导入 `fetch`**，再调用 `supabase.functions.invoke` 或直接 `fetch` Edge Function URL（见下方"提交请求（通用）"）。

### 提交请求（通用）

**推荐方式（supabase client 可用时）：**

```typescript
async function submitImageUnderstanding(
  question: string,
  imageBase64?: string,
  imageUrl?: string
): Promise<string> {
  const body: Record<string, string> = { question };
  if (imageBase64) body.image = imageBase64;
  else if (imageUrl) body.url = imageUrl;

  const { data, error } = await supabase.functions.invoke("image-understanding-request", {
    body,
  });
  if (error) throw error;
  if (!data?.result?.task_id) throw new Error(`提交失败：${JSON.stringify(data)}`);
  return data.result.task_id;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function submitImageUnderstanding(
  question: string,
  imageBase64?: string,
  imageUrl?: string
): Promise<string> {
  const body: Record<string, string> = { question };
  if (imageBase64) body.image = imageBase64;
  else if (imageUrl) body.url = imageUrl;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-understanding-request`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  if (!json?.result?.task_id) throw new Error(`提交失败：${JSON.stringify(json)}`);
  return json.result.task_id;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：提交请求接口启用计费，原价 ¥10.40/千次，折扣价 ¥7.50/千次，避免不必要的重复提交。
- **图片优先级**：`image`（Base64）字段优先级高于 `url`，两者同时传入时以 `image` 为准。
- **小程序必须用 base64**：小程序选择图片后得到 `wxfile://` 临时路径，外部 API 无法访问，必须读取为 base64 后传 `image` 字段。直接传临时路径到 `url` 会返回 `image fetch failed (282115)`。
- **App（Expo）base64 无前缀**：`expo-image-picker` 的 `base64: true` 返回的是纯 Base64 字符串，不含 `data:image/...;base64,` 前缀，可直接传给 `image` 字段，无需任何处理。App 本地图片 URI（如 `file://...`）同样不可传给 `url` 字段，外部 API 无法访问设备本地路径，必须使用 `image` 字段传 base64。
- **App 必须使用 `expo/fetch`**：为保持 Expo 项目方案统一，App 端需从 `expo/fetch` 导入 `fetch`，即使本接口非 SSE 流式，也应统一使用 `expo/fetch` 发起请求。
- **question 长度限制**：`question` 不超过 100 个字符，超出会返回 `input text length invalid (282501)`。
- **图片格式**：支持 JPG/JPEG/PNG/BMP/WEBP，超过 4096px 自动压缩，最大 10M。
- **task_id**：提交成功后必须保存 `task_id` 用于后续结果查询。
