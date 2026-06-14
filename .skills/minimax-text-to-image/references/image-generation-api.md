# image-generation-api.md — MiniMax 文生图接口

## API 基本信息

| 项目 | 值 |
|------|-----|
| Plugin ID | `8f3bac45-47db-47d3-b13c-23e30182316d` |
| API ID | `api-DLEO7vB8pQba` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO7vB8pQba-gateway.appmiaoda.com/v1/image_generation` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-DLEO7vB8pQba-gateway.appmiaoda.com` |
| 支持平台 | Web、MiniProgram |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型名称，可选值：`image-01`、`image-01-live` |
| `prompt` | string | 是 | — | 图像的文本描述，最长 1500 字符 |
| `style` | object | 否 | — | 画风设置，仅当 `model` 为 `image-01-live` 时生效（见 style 子参数） |
| `style.style_type` | string | 否（使用 style 时必填）| — | 画风类型，可选：`漫画`、`元气`、`中世纪`、`水彩` |
| `style.style_weight` | float | 否 | `0.8` | 画风权重，取值范围 `(0, 1]` |
| `aspect_ratio` | string | 否 | `1:1` | 宽高比，可选：`1:1`/`16:9`/`4:3`/`3:2`/`2:3`/`3:4`/`9:16`/`21:9`（`21:9` 仅适用于 `image-01`） |
| `width` | integer | 否 | — | 图片宽度（像素），范围 [512, 2048]，须为 8 的倍数，仅 `image-01` 生效；需与 `height` 同时设置；若与 `aspect_ratio` 同时填写，优先使用 `aspect_ratio` |
| `height` | integer | 否 | — | 图片高度（像素），范围 [512, 2048]，须为 8 的倍数，仅 `image-01` 生效；需与 `width` 同时设置 |
| `response_format` | string | 否 | `url` | 返回格式：`url`（URL 有效期 24 小时）/ `base64` |
| `seed` | integer(int64) | 否 | — | 随机种子，相同种子与参数可复现相近图片；不填则对每张图单独生成随机种子 |
| `n` | integer | 否 | `1` | 生成图片数量，范围 [1, 9] |
| `prompt_optimizer` | boolean | 否 | `false` | 是否开启 prompt 自动优化 |
| `aigc_watermark` | boolean | 否 | `false` | 是否在生成的图片中添加水印 |

---

## 响应字段表

### 成功响应（`base_resp.status_code === 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `id` | string | 生成任务 ID |
| `data.image_urls` | string[] | 图片链接数组（`response_format` 为 `url` 时返回，原始 URL 有效期 24 小时） |
| `data.image_base64` | string[] | Base64 编码数组（`response_format` 为 `base64` 时返回） |
| `metadata.success_count` | integer | 成功生成的图片数量 |
| `metadata.failed_count` | integer | 因内容安全检查失败未返回的图片数量 |
| `base_resp.status_code` | integer | 状态码（0 = 成功） |
| `base_resp.status_msg` | string | 状态说明 |

### 错误状态码（`base_resp.status_code` 非 0）

| 状态码 | 含义 |
|--------|------|
| `0` | 请求成功 |
| `1002` | 触发限流，请稍后再试 |
| `1004` | 账号鉴权失败，请检查 API Key 是否正确 |
| `1008` | 账号余额不足 |
| `1026` | 图片描述涉及敏感内容 |
| `2013` | 传入参数异常，请检查入参格式 |
| `2049` | 无效的 API Key |

---

## 生成期代码

在 Deno 脚本（Agent 直接调用）中使用以下代码：

```typescript
/**
 * 调用 MiniMax 文生图接口，生成图片并返回 URL 列表。
 * @param prompt - 图像文本描述，最长 1500 字符
 * @param options - 可选参数（宽高比、生成数量等）
 * @returns 图片 URL 数组
 */
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface ImageGenerationOptions {
  model?: "image-01" | "image-01-live";
  aspect_ratio?: "1:1" | "16:9" | "4:3" | "3:2" | "2:3" | "3:4" | "9:16" | "21:9";
  width?: number;
  height?: number;
  response_format?: "url" | "base64";
  seed?: number;
  n?: number;
  prompt_optimizer?: boolean;
  aigc_watermark?: boolean;
}

async function generateImages(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<string[]> {
  const requestBody = {
    model: options.model ?? "image-01",
    prompt,
    ...(options.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
    ...(options.width && { width: options.width }),
    ...(options.height && { height: options.height }),
    response_format: options.response_format ?? "url",
    ...(options.seed !== undefined && { seed: options.seed }),
    n: options.n ?? 1,
    prompt_optimizer: options.prompt_optimizer ?? false,
    aigc_watermark: options.aigc_watermark ?? false,
  };

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO7vB8pQba-gateway.appmiaoda.com/v1/image_generation",
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
  if (json.base_resp?.status_code !== 0) {
    throw new Error(
      `API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`
    );
  }

  return json.data.image_urls ?? [];
}

// 示例调用
const urls = await generateImages(
  "A man in a white t-shirt, full-body, standing front view, outdoors, " +
  "with the Venice Beach sign in the background, Los Angeles. " +
  "Fashion photography in 90s documentary style, film grain, photorealistic.",
  { aspect_ratio: "16:9", n: 3, prompt_optimizer: true }
);
console.log("生成的图片 URL：", urls);

// 示例：使用 image-01-live 模型 + style 参数生成漫画风格图片
async function generateLiveStyleImages(prompt: string, styleType: string): Promise<string[]> {
  const requestBody = {
    model: "image-01-live",
    prompt,
    style: {
      style_type: styleType,  // 可选：漫画 / 元气 / 中世纪 / 水彩
      style_weight: 0.8,
    },
    aspect_ratio: "1:1",
    response_format: "url",
    n: 1,
  };

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO7vB8pQba-gateway.appmiaoda.com/v1/image_generation",
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
  if (json.base_resp?.status_code !== 0) {
    throw new Error(
      `API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`
    );
  }
  return json.data.image_urls ?? [];
}

// 使用示例：生成漫画风格图片
const liveUrls = await generateLiveStyleImages(
  "一位年轻女性，穿着校服，站在樱花树下，阳光明媚",
  "漫画"
);
console.log("漫画风格图片 URL：", liveUrls);
```

---

## Edge Function 代码

Edge Function 负责：
1. 接收前端请求参数
2. 注入平台密钥，调用 MiniMax 上游接口
3. 将返回的临时图片 URL 转存至 Supabase Storage（持久化）
4. 返回持久化 publicUrl 列表给前端

> 注意：
> - MiniMax 返回的 `image_urls` 有效期仅 24 小时，必须转存至 Supabase Storage。
> - 当 `response_format=base64` 时，MiniMax 返回 `data.image_base64` 数组，`image_urls` 为空。Edge Function
>   需读取 `data.image_base64` 并添加 `data:image/png;base64,` 前缀构造 Data URI，不可从 `image_urls` 取值。

```typescript
// edge-functions/minimax-text-to-image.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远程媒体 URL 转存至 Supabase Storage，返回持久化的公开 URL。
 * @param mediaUrl - 远程图片 URL
 * @param bucketName - 目标 Storage bucket 名称
 * @returns 转存结果，包含 publicUrl
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl);

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

    if (!isAllowed) throw new Error(`Unsupported content type: ${contentType}`);

    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });

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

  // --- 解析请求体 ---
  let prompt: string;
  let model: string;
  let aspect_ratio: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let response_format: string;
  let seed: number | undefined;
  let n: number;
  let prompt_optimizer: boolean;
  let aigc_watermark: boolean;
  let style: { style_type: string; style_weight?: number } | undefined;

  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("Missing prompt");
    model = body.model ?? "image-01";
    aspect_ratio = body.aspect_ratio;
    width = body.width;
    height = body.height;
    response_format = body.response_format ?? "url";
    seed = body.seed;
    n = body.n ?? 1;
    prompt_optimizer = body.prompt_optimizer ?? false;
    aigc_watermark = body.aigc_watermark ?? false;
    // style 参数仅在 model=image-01-live 时生效
    style = body.style;
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

  // --- 构造上游请求体 ---
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    response_format,
    n,
    prompt_optimizer,
    aigc_watermark,
  };
  if (aspect_ratio) requestBody.aspect_ratio = aspect_ratio;
  if (width) requestBody.width = width;
  if (height) requestBody.height = height;
  if (seed !== undefined) requestBody.seed = seed;
  // style 参数仅在 model=image-01-live 时传递
  if (model === "image-01-live" && style) requestBody.style = style;

  // --- 调用上游 MiniMax 接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO7vB8pQba-gateway.appmiaoda.com/v1/image_generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

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
  if (data.base_resp?.status_code !== 0) {
    return new Response(
      JSON.stringify({
        error: `MiniMax API error ${data.base_resp?.status_code}: ${data.base_resp?.status_msg}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- base64 模式：直接返回 base64 数据，添加 data URI 前缀 ---
  if (response_format === "base64") {
    const base64List: string[] = data.data?.image_base64 ?? [];
    const dataUris = base64List.map(
      (b64: string) => `data:image/png;base64,${b64}`
    );
    return new Response(
      JSON.stringify({
        id: data.id,
        image_urls: dataUris,
        metadata: data.metadata,
        base_resp: data.base_resp,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- url 模式：将临时 image_urls 转存至 Supabase Storage ---
  const rawUrls: string[] = data.data?.image_urls ?? [];
  const persistentUrls: string[] = [];
  for (const rawUrl of rawUrls) {
    const transfer = await streamMediaToStorage(rawUrl, "generated-media");
    if (!transfer.success) {
      console.error("Storage transfer failed:", transfer.error);
      persistentUrls.push(rawUrl); // 降级：使用原始 URL（有效期 24 小时）
    } else {
      persistentUrls.push(transfer.publicUrl);
    }
  }

  return new Response(
    JSON.stringify({
      id: data.id,
      image_urls: persistentUrls,
      metadata: data.metadata,
      base_resp: data.base_resp,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

---

## 前端调用代码

### Web（React / Taro H5）

```typescript
/**
 * 调用 minimax-text-to-image Edge Function，生成图片并返回持久化 URL 列表。
 * @param prompt - 图像文本描述
 * @param options - 可选参数（宽高比、数量等）
 * @returns 持久化图片 URL 数组
 */
interface GenerateImagesOptions {
  model?: "image-01" | "image-01-live";
  aspect_ratio?: string;
  width?: number;
  height?: number;
  n?: number;
  seed?: number;
  prompt_optimizer?: boolean;
  aigc_watermark?: boolean;
  /** 风格控制，仅 image-01-live 模型支持，如 "anime"、"realistic" 等 */
  style?: string;
}

async function generateImages(
  prompt: string,
  options: GenerateImagesOptions = {}
): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("minimax-text-to-image", {
    body: { prompt, ...options },
  });
  if (error) throw error;
  if (!data.image_urls?.length) {
    throw new Error(`生成失败：${data.base_resp?.status_msg ?? "未知错误"}`);
  }
  return data.image_urls as string[];
}

// 示例：在 React 组件中使用
const [imageUrls, setImageUrls] = useState<string[]>([]);
const [loading, setLoading] = useState(false);

const handleGenerate = async () => {
  setLoading(true);
  try {
    const urls = await generateImages(
      "A scenic mountain landscape at sunset, ultra-realistic, 8K.",
      { aspect_ratio: "16:9", n: 2, prompt_optimizer: true }
    );
    setImageUrls(urls);
  } catch (err) {
    console.error("图片生成失败：", err);
  } finally {
    setLoading(false);
  }
};
```

### MiniProgram（Taro 微信小程序）

```typescript
/**
 * 在小程序中调用 minimax-text-to-image Edge Function。
 * @param prompt - 图像文本描述
 * @param options - 可选参数
 * @returns 持久化图片 URL 数组
 */
async function generateImagesMiniProgram(
  prompt: string,
  options: GenerateImagesOptions = {}
): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke("minimax-text-to-image", {
    body: { prompt, ...options },
  });
  if (error) throw error;
  if (!data.image_urls?.length) {
    throw new Error(`生成失败：${data.base_resp?.status_msg ?? "未知错误"}`);
  }
  return data.image_urls as string[];
}

// 示例：在 Taro 小程序组件中使用
const [imageUrls, setImageUrls] = useState<string[]>([]);
const [loading, setLoading] = useState(false);

const handleGenerate = async () => {
  setLoading(true);
  try {
    const urls = await generateImagesMiniProgram(
      "水墨风山水画，意境深远。",
      { aspect_ratio: "3:4", n: 1 }
    );
    setImageUrls(urls);
  } catch (err) {
    console.error("图片生成失败：", err);
  } finally {
    setLoading(false);
  }
};
```

---

## 注意事项

### 密钥安全
- `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get("INTEGRATIONS_API_KEY")` 读取，**严禁暴露到前端**。

### 计费
- 计费信息以平台实际配置为准。
- 每次 API 调用均计入调用次数（`need_count_calls: true`），避免不必要的重复调用。

### 媒体 URL 持久化
- MiniMax 返回的 `image_urls` 原始 URL **有效期仅 24 小时**，Edge Function 会自动将其转存至 Supabase Storage。
- 当 `response_format=base64` 时，Edge Function 从 `data.image_base64` 字段取值并添加 `data:image/png;base64,`
  前缀返回 Data URI，不依赖 `image_urls`（该字段在 base64 模式下为空）。
- 若 Storage 转存失败，Edge Function 降级返回原始临时 URL 并记录错误日志，请关注日志排查原因。
- 确保 Supabase Storage 中存在名为 `generated-media` 的 bucket，并已设置公开访问权限。

### 错误处理
- 务必处理 429（配额超限）和 402（余额不足）状态码。
- 检查 `base_resp.status_code`：常见错误有 `1026`（敏感内容）、`2013`（参数异常）、`1004`（鉴权失败）。
- `metadata.failed_count > 0` 表示部分图片因内容安全被拦截，`image_urls` 数量可能少于请求的 `n`。

### 参数约束
- `width`/`height` 需同时设置，且须为 8 的倍数，范围 [512, 2048]，仅适用于 `image-01`。
- 若同时填写 `aspect_ratio` 与 `width`/`height`，优先使用 `aspect_ratio`。
- `style` 对象仅在 `model` 为 `image-01-live` 时生效。
