# image-generation-api.md — MiniMax 图像生成 API

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `0120169e-f7cd-4c6f-b79d-5e185d987aac` |
| API ID | `api-6LeBzWJjy3QY` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-6LeBzWJjy3QY-gateway.appmiaoda.com/v1/image_generation` |
| 认证方式 | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-6LeBzWJjy3QY-gateway.appmiaoda.com` |
| stream | 否 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型名称，可选值：`image-01`、`image-01-live` |
| `prompt` | string | 是 | — | 图像的文本描述，最长 1500 字符 |
| `subject_reference` | array | 否 | — | 人物主体参考，用于图生图；每项包含 `type`（固定为 `"character"`）和 `image_file`（公网 URL 或 Base64 Data URL） |
| `subject_reference[].type` | string | 是（当传入时） | — | 主体类型，当前仅支持 `"character"`（人像） |
| `subject_reference[].image_file` | string | 是（当传入时） | — | 参考图，支持公网 URL 或 Base64 Data URL（`data:image/jpeg;base64,...`）；格式：JPG/JPEG/PNG，大小 < 10MB，建议单人正面照 |
| `style` | object | 否 | — | 画风设置，仅 `model=image-01-live` 时生效；包含 `style_type`（`漫画`/`元气`/`中世纪`/`水彩`）和 `style_weight`（`(0, 1]`，默认 `0.8`） |
| `aspect_ratio` | string | 否 | `"1:1"` | 图像宽高比，可选值：`1:1`（1024×1024）、`16:9`（1280×720）、`4:3`（1152×864）、`3:2`（1248×832）、`2:3`（832×1248）、`3:4`（864×1152）、`9:16`（720×1280）、`21:9`（1344×576，仅 `image-01`） |
| `width` | integer | 否 | — | 生成图片宽度（像素），仅 `model=image-01` 时生效；取值范围 [512, 2048]，必须是 8 的倍数；与 `aspect_ratio` 同时设置时，`aspect_ratio` 优先 |
| `height` | integer | 否 | — | 生成图片高度（像素），仅 `model=image-01` 时生效；取值范围 [512, 2048]，必须是 8 的倍数；与 `aspect_ratio` 同时设置时，`aspect_ratio` 优先 |
| `response_format` | string | 否 | `"url"` | 返回图片形式，可选值：`url`（有效期 24 小时）、`base64` |
| `seed` | integer | 否 | — | 随机种子；相同 seed 和参数可复现相近图片；未提供时对每张图单独生成随机种子 |
| `n` | integer | 否 | `1` | 单次请求生成图片数量，取值范围 [1, 9] |
| `prompt_optimizer` | boolean | 否 | `false` | 是否开启 prompt 自动优化 |
| `aigc_watermark` | boolean | 否 | `false` | 是否在生成的图片中添加水印 |

---

## 响应字段表

### 成功响应（`base_resp.status_code = 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `id` | string | 生成任务 ID |
| `data.image_urls` | string[] | 生成图片的 URL 数组（`response_format=url` 时返回，有效期 24 小时） |
| `data.image_base64` | string[] | 生成图片的 Base64 数组（`response_format=base64` 时返回） |
| `metadata.success_count` | integer | 成功生成的图片数量 |
| `metadata.failed_count` | integer | 因内容安全检查失败而未返回的图片数量 |
| `base_resp.status_code` | integer | 状态码，`0` 表示成功 |
| `base_resp.status_msg` | string | 状态描述 |

### 错误码说明

| status_code | 含义 |
|-------------|------|
| 0 | 请求成功 |
| 1002 | 触发限流，请稍后再试 |
| 1004 | 账号鉴权失败，请检查 API Key 是否正确 |
| 1008 | 账号余额不足 |
| 1026 | 图片描述涉及敏感内容 |
| 2013 | 传入参数异常，请检查入参是否按要求填写 |
| 2049 | 无效的 API Key |

---

## 生成期代码

适合在 Deno Agent 脚本或工作流中直接调用。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface SubjectReference {
  type: "character";
  image_file: string; // 公网 URL 或 Base64 Data URL
}

interface StyleObject {
  style_type: "漫画" | "元气" | "中世纪" | "水彩";
  style_weight?: number; // (0, 1]，默认 0.8
}

interface ImageGenerationParams {
  model: "image-01" | "image-01-live";
  prompt: string;
  subject_reference?: SubjectReference[];
  style?: StyleObject;
  aspect_ratio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9";
  width?: number;
  height?: number;
  response_format?: "url" | "base64";
  seed?: number;
  n?: number;
  prompt_optimizer?: boolean;
  aigc_watermark?: boolean;
}

interface ImageGenerationResult {
  id: string;
  data: {
    image_urls?: string[];
    image_base64?: string[];
  };
  metadata: {
    success_count: number;
    failed_count: number;
  };
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * 调用 MiniMax 图像生成 API，支持文本生图和图生图（人物主体参考）。
 * @param params - 请求参数，详见 ImageGenerationParams
 * @returns 图像生成结果，含图片 URL 或 Base64 数组
 */
async function callImageGeneration(params: ImageGenerationParams): Promise<ImageGenerationResult> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-6LeBzWJjy3QY-gateway.appmiaoda.com/v1/image_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json: ImageGenerationResult = await response.json();
  if (json.base_resp.status_code !== 0) {
    throw new Error(
      `API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`
    );
  }

  return json;
}

// 示例 1：纯文本生图（16:9，生成 2 张）
const result1 = await callImageGeneration({
  model: "image-01",
  prompt: "A girl looking into the distance from a library window",
  aspect_ratio: "16:9",
  n: 2,
});
console.log("生成的图片 URL：", result1.data.image_urls);

// 示例 2：图生图（人物主体参考）
const result2 = await callImageGeneration({
  model: "image-01",
  prompt: "A girl looking into the distance from a library window",
  aspect_ratio: "16:9",
  subject_reference: [
    {
      type: "character",
      image_file:
        "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg",
    },
  ],
  n: 2,
});
console.log("图生图结果：", result2.data.image_urls);
```

---

## Edge Function 代码

返回的图片 URL 有效期仅 24 小时，Edge Function 必须将其转存至 Supabase Storage，向前端返回永久公开链接。

Web 和 MiniProgram 共用同一个 Edge Function。

```typescript
// edge-functions/minimax-image-generation.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface SubjectReference {
  type: "character";
  image_file: string;
}

interface StyleObject {
  style_type: "漫画" | "元气" | "中世纪" | "水彩";
  style_weight?: number;
}

/**
 * 将远程媒体 URL 转存至 Supabase Storage，返回永久公开链接。
 * @param mediaUrl - 待转存的媒体 URL
 * @param bucketName - Supabase Storage 桶名称
 * @param upsert - 是否覆盖同名文件，默认 false
 * @returns 成功时返回 publicUrl，失败时返回错误信息
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
  upsert = false
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl); // 验证 URL 格式

    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const isAllowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream";

    if (!isAllowed) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    return { success: true, path: data.path, publicUrl: urlData.publicUrl, contentType };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let prompt: string;
  let model: string;
  let subjectReference: SubjectReference[] | undefined;
  let style: StyleObject | undefined;
  let aspectRatio: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let responseFormat: string | undefined;
  let seed: number | undefined;
  let n: number | undefined;
  let promptOptimizer: boolean | undefined;
  let aigcWatermark: boolean | undefined;

  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    model = body.model ?? "image-01";
    subjectReference = body.subject_reference;
    style = body.style;
    aspectRatio = body.aspect_ratio;
    width = body.width;
    height = body.height;
    responseFormat = body.response_format;
    seed = body.seed;
    n = body.n;
    promptOptimizer = body.prompt_optimizer;
    aigcWatermark = body.aigc_watermark;
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

  // --- 构造请求体 ---
  const requestBody: Record<string, unknown> = { model, prompt };
  if (subjectReference !== undefined) requestBody.subject_reference = subjectReference;
  if (style !== undefined) requestBody.style = style;
  if (aspectRatio !== undefined) requestBody.aspect_ratio = aspectRatio;
  if (width !== undefined) requestBody.width = width;
  if (height !== undefined) requestBody.height = height;
  if (responseFormat !== undefined) requestBody.response_format = responseFormat;
  if (seed !== undefined) requestBody.seed = seed;
  if (n !== undefined) requestBody.n = n;
  if (promptOptimizer !== undefined) requestBody.prompt_optimizer = promptOptimizer;
  if (aigcWatermark !== undefined) requestBody.aigc_watermark = aigcWatermark;

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-6LeBzWJjy3QY-gateway.appmiaoda.com/v1/image_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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

  const upstreamData = await upstream.json();

  if (upstreamData.base_resp?.status_code !== 0) {
    return new Response(
      JSON.stringify({
        error: `API error ${upstreamData.base_resp?.status_code}: ${upstreamData.base_resp?.status_msg}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 将临时图片 URL 转存至 Supabase Storage ---
  const imageUrls: string[] = upstreamData.data?.image_urls ?? [];
  const persistentUrls: string[] = [];

  for (const url of imageUrls) {
    const transfer = await streamMediaToStorage(url, "generated-media");
    if (!transfer.success) {
      return new Response(
        JSON.stringify({ error: `Storage transfer failed: ${transfer.error}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    persistentUrls.push(transfer.publicUrl);
  }

  const responseData = {
    ...upstreamData,
    data: {
      ...upstreamData.data,
      image_urls: persistentUrls,
    },
  };

  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台

```typescript
import { supabase } from "@/lib/supabase"; // 使用项目的 supabase client

interface ImageGenerationRequest {
  prompt: string;
  model?: "image-01" | "image-01-live";
  subject_reference?: Array<{ type: "character"; image_file: string }>;
  aspect_ratio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9";
  n?: number;
  seed?: number;
  prompt_optimizer?: boolean;
  aigc_watermark?: boolean;
}

interface ImageGenerationResponse {
  id: string;
  data: {
    image_urls: string[]; // 已转存的永久 Supabase Storage 链接
  };
  metadata: {
    success_count: number;
    failed_count: number;
  };
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * 调用 minimax-image-generation Edge Function 生成图片。
 * @param params - 图像生成参数
 * @returns 包含永久图片 URL 的生成结果
 */
async function generateImage(
  params: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const { data, error } = await supabase.functions.invoke(
    "minimax-image-generation",
    { body: params }
  );
  if (error) throw error;
  return data as ImageGenerationResponse;
}

// 使用示例 1：纯文本生图
const result = await generateImage({
  prompt: "A girl looking into the distance from a library window",
  aspect_ratio: "16:9",
  n: 2,
});
console.log("图片链接：", result.data.image_urls);

// 使用示例 2：图生图（人物主体参考）
const result2 = await generateImage({
  prompt: "A girl looking into the distance from a library window",
  aspect_ratio: "16:9",
  subject_reference: [
    {
      type: "character",
      image_file:
        "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg",
    },
  ],
  n: 2,
});
console.log("图生图链接：", result2.data.image_urls);
```

### MiniProgram 平台（Taro）

```typescript
import { supabase } from "@/lib/supabase";

interface ImageGenerationRequest {
  prompt: string;
  model?: "image-01" | "image-01-live";
  subject_reference?: Array<{ type: "character"; image_file: string }>;
  aspect_ratio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9";
  n?: number;
  seed?: number;
  prompt_optimizer?: boolean;
  aigc_watermark?: boolean;
}

/**
 * 调用 minimax-image-generation Edge Function 生成图片（小程序端）。
 * @param params - 图像生成参数
 * @returns 包含永久图片 URL 的生成结果
 */
async function generateImage(params: ImageGenerationRequest) {
  const { data, error } = await supabase.functions.invoke(
    "minimax-image-generation",
    { body: params }
  );
  if (error) throw error;
  return data;
}

// 使用示例（在 Taro 组件中展示图片）
const handleGenerate = async () => {
  try {
    const result = await generateImage({
      prompt: "一个站在图书馆窗前眺望远方的女孩",
      aspect_ratio: "16:9",
      n: 1,
    });
    // result.data.image_urls 为永久 Supabase Storage 链接，可直接用于 <Image src=... />
    console.log("图片链接：", result.data.image_urls);
  } catch (err) {
    console.error("生成失败：", err);
  }
};
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
2. **图片 URL 有效期**：MiniMax 返回的图片 URL 有效期仅 24 小时，Edge Function 中必须将其转存至 Supabase Storage，并向前端返回永久公开链接。
3. **Supabase Storage 桶**：需在 Supabase 项目中提前创建名为 `generated-media` 的公开存储桶，或根据实际项目需求修改桶名称。
4. **计费**：实际调用费用以 MiniMax 官方定价为准，避免不必要的批量生成。
5. **错误处理**：
   - `status_code 1002`：触发限流，建议添加重试逻辑（指数退避）。
   - `status_code 1026`：prompt 涉及敏感内容，需调整描述文本。
   - `metadata.failed_count > 0`：部分图片被内容安全检查拦截，实际返回图片数少于请求数量。
6. **参数约束**：`width` 和 `height` 必须同时设置且均为 8 的倍数；当与 `aspect_ratio` 同时传入时，`aspect_ratio` 优先生效。
7. **参考图要求**：`subject_reference[].image_file` 推荐使用单人正面照，格式为 JPG/JPEG/PNG，大小不超过 10MB。
8. **`image-01-live` 模型**：`style` 参数仅在 `model=image-01-live` 时生效，`image-01` 模型不支持此参数。
