# advanced-general API 规格说明

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `4d0e6422-381e-44f2-b2ce-7d9c3168582d` |
| API ID | `api-zYm4zKQoePjL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-zYm4zKQoePjL-gateway.appmiaoda.com/rest/2.0/image-classify/v2/advanced_general` |
| 生成期 Endpoint（含 API ID 前缀） | `POST https://app-cblk1rqa5fk1-api-zYm4zKQoePjL-gateway.appmiaoda.com/rest/2.0/image-classify/v2/advanced_general` |
| Auth 模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/x-www-form-urlencoded` |
| third_part_domain | `app-cblk1rqa5fk1-api-zYm4zKQoePjL-gateway.appmiaoda.com` |
| 流式响应 | 否 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 否（二选一）| 图像 Base64 编码数据（去掉编码头，如 `data:image/png;base64,` 前缀），大小不超过 8M，最短边至少 15px，最长边最大 8192px |
| `url` | string | 否（二选一）| 图片完整 URL，长度不超过 1024 字节；当 `image` 存在时此参数失效 |
| `baike_num` | integer | 否 | 控制返回百科信息的数量，默认不返回（即默认值为 0） |

> **注意**：`image` 和 `url` 必须提供至少一个，当两者同时存在时 `image` 优先生效。

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | number | 唯一日志标识，用于问题排查 |
| `result_num` | number | 返回结果数量，最多 5 个 |
| `result` | array | 识别结果数组 |
| `result[].keyword` | string | 识别到的物体或场景名称 |
| `result[].score` | number | 置信度，范围 0–1，越大越可信 |
| `result[].root` | string | 上层分类标签（如"公众人物"、"人物-人物特写"） |
| `result[].baike_info?` | object | 百科信息（仅当 `baike_num > 0` 且有对应词条时返回） |
| `result[].baike_info.baike_url?` | string | 百度百科词条 URL |
| `result[].baike_info.image_url?` | string | 百科封面图 URL |
| `result[].baike_info.description?` | string | 百科描述摘要 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 错误码 |
| `error_msg` | string | 错误信息描述 |

---

## 生成期代码（TypeScript）

```typescript
// 通用物体和场景识别 — 生成期直接调用
// 密钥由平台注入，platform_managed 模式
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface RecognitionResult {
  keyword: string;
  score: number;
  root: string;
  baike_info?: {
    baike_url?: string;
    image_url?: string;
    description?: string;
  };
}

interface AdvancedGeneralResponse {
  log_id: number;
  result_num: number;
  result: RecognitionResult[];
}

/**
 * 调用百度通用物体和场景识别接口。
 * @param imageBase64 图像 Base64 编码数据（不含编码头），与 imageUrl 二选一
 * @param imageUrl 图片完整 URL（当 imageBase64 存在时此参数失效）
 * @param baikeNum 返回百科信息的条数，默认 0（不返回）
 * @returns 识别结果列表
 */
async function recognizeObjectsAndScenes(
  imageBase64?: string,
  imageUrl?: string,
  baikeNum = 0,
): Promise<AdvancedGeneralResponse> {
  if (!imageBase64 && !imageUrl) {
    throw new Error("必须提供 imageBase64 或 imageUrl 之一");
  }

  const params: Record<string, string> = {};
  if (imageBase64) {
    params.image = imageBase64;
  } else if (imageUrl) {
    params.url = imageUrl;
  }
  if (baikeNum > 0) {
    params.baike_num = String(baikeNum);
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-zYm4zKQoePjL-gateway.appmiaoda.com/rest/2.0/image-classify/v2/advanced_general",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP 错误：${response.status}`);
  }

  const json = await response.json();
  if (json.error_code) {
    throw new Error(`API 错误 ${json.error_code}：${json.error_msg}`);
  }

  return json as AdvancedGeneralResponse;
}

// 使用示例（通过 URL）
const result = await recognizeObjectsAndScenes(
  undefined,
  "https://example.com/sample.jpg",
  1,
);
console.log(`识别到 ${result.result_num} 个标签：`);
for (const item of result.result) {
  console.log(`  ${item.keyword}（置信度：${item.score.toFixed(4)}）- ${item.root}`);
}
```

---

## Edge Function 代码

Web 和 MiniProgram 共用同一套 Edge Function（上游返回纯 JSON，无二进制流），无需区分平台。

```typescript
// edge-functions/advanced-general.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let image: string | undefined;
  let url: string | undefined;
  let baikeNum: number | undefined;

  try {
    const body = await req.json();
    image = body.image;
    url = body.url;
    baikeNum = body.baike_num;

    if (!image && !url) {
      throw new Error("缺少 image 或 url 参数");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // --- 注入平台密钥（严禁暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // --- 构造上游请求参数 ---
  const params: Record<string, string> = {};
  if (image) {
    params.image = image;
  } else if (url) {
    params.url = url;
  }
  if (baikeNum !== undefined && baikeNum > 0) {
    params.baike_num = String(baikeNum);
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-zYm4zKQoePjL-gateway.appmiaoda.com/rest/2.0/image-classify/v2/advanced_general",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    },
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

### Web 平台

**推荐方式（supabase client 可用时）：**

```typescript
interface RecognitionResult {
  keyword: string;
  score: number;
  root: string;
  baike_info?: {
    baike_url?: string;
    image_url?: string;
    description?: string;
  };
}

interface AdvancedGeneralResponse {
  log_id: number;
  result_num: number;
  result: RecognitionResult[];
}

/**
 * 通过 Edge Function 调用通用物体和场景识别接口（Web 平台）。
 * @param imageBase64 图像 Base64 编码（不含编码头），与 imageUrl 二选一
 * @param imageUrl 图片完整 URL，与 imageBase64 二选一
 * @param baikeNum 返回百科信息条数，默认 0
 * @returns 识别结果
 */
async function recognizeImage(
  imageBase64?: string,
  imageUrl?: string,
  baikeNum = 0,
): Promise<AdvancedGeneralResponse> {
  const body: Record<string, unknown> = {};
  if (imageBase64) body.image = imageBase64;
  if (imageUrl) body.url = imageUrl;
  if (baikeNum > 0) body.baike_num = baikeNum;

  const { data, error } = await supabase.functions.invoke("advanced-general", { body });
  if (error) throw error;
  if (data.error_code) {
    throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  }
  return data as AdvancedGeneralResponse;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function recognizeImage(
  imageBase64?: string,
  imageUrl?: string,
  baikeNum = 0,
): Promise<AdvancedGeneralResponse> {
  const body: Record<string, unknown> = {};
  if (imageBase64) body.image = imageBase64;
  if (imageUrl) body.url = imageUrl;
  if (baikeNum > 0) body.baike_num = baikeNum;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advanced-general`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  if (json.error_code) {
    throw new Error(`API 错误 ${json.error_code}：${json.error_msg}`);
  }
  return json as AdvancedGeneralResponse;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 通过 Edge Function 调用通用物体和场景识别接口（MiniProgram 平台）。
 * @param imageBase64 图像 Base64 编码（不含编码头），与 imageUrl 二选一
 * @param imageUrl 图片完整 URL，与 imageBase64 二选一
 * @param baikeNum 返回百科信息条数，默认 0
 * @returns 识别结果
 */
async function recognizeImage(
  imageBase64?: string,
  imageUrl?: string,
  baikeNum = 0,
): Promise<AdvancedGeneralResponse> {
  const body: Record<string, unknown> = {};
  if (imageBase64) body.image = imageBase64;
  if (imageUrl) body.url = imageUrl;
  if (baikeNum > 0) body.baike_num = baikeNum;

  const { data, error } = await supabase.functions.invoke("advanced-general", { body });
  if (error) throw error;
  if (data.error_code) {
    throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  }
  return data as AdvancedGeneralResponse;
}

// 在 MiniProgram 中读取本地图片并转为 Base64
async function recognizeLocalImage(filePath: string): Promise<AdvancedGeneralResponse> {
  return new Promise((resolve, reject) => {
    const fs = Taro.getFileSystemManager();
    fs.readFile({
      filePath,
      encoding: "base64",
      success: async (res) => {
        try {
          const result = await recognizeImage(res.data as string);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），以及上游返回的 `error_code`/`error_msg`。
- **计费**：原价 ¥0.20 / 次，折后价 ¥0.15 / 次。请避免重复调用同一张图片，建议在前端缓存识别结果。
- **Base64 编码头**：传递 `image` 参数时须去掉编码头（如 `data:image/png;base64,` 前缀），仅保留 Base64 字符串本体。
- **图片格式**：支持 jpg、jpeg、png、bmp；图片大小不超过 8M；最短边 ≥ 15px，最长边 ≤ 8192px。
- **image 与 url 互斥**：当 `image` 参数存在时，`url` 参数自动失效。
- **baike_num 默认值**：默认为 0，即不返回百科信息；按需设置，避免增加不必要的响应体积。
