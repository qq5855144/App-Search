# Gemini 图片生成与编辑接口

## API 基本信息

| 属性 | 值 |
|------|-----|
| Plugin ID | `9bb163d6-0d46-4fff-ba5e-83aab73e00de` |
| API ID | `api-o9wN0AExZQ8a` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-o9wN0AExZQ8a-gateway.appmiaoda.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent` |
| Content-Type | `application/json` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 第三方域名 | `app-cblk1rqa5fk1-api-o9wN0AExZQ8a-gateway.appmiaoda.com` |
| 流式响应 | 否 |
| 计费 | 按调用次数计费，原价 `0.00` |

---

## 请求参数表

### 顶层参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `contents` | `array` | 是 | 内容块数组，包含多模态输入 |
| `responseModalities` | `string` | 否 | 返回内容类型（`image` 返回 Base64 编码 PNG 图片，`text` 返回操作日志） |
| `temperature` | `number` | 否 | 生成温度，值越低结果越稳定，值越高创意越强 |
| `n` | `integer` | 否 | 生成结果数量 |

### `contents[i]` 结构

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `contents[i].parts` | `array` | 是 | 混合类型数组，支持 `text` 与 `inlineData` 成对出现 |

### `contents[i].parts[j]` 结构

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `parts[j].text` | `string` | 是 | 文本指令，描述编辑意图（支持中文，需明确操作类型，如背景替换/元素修改/风格调整） |
| `parts[j].inlineData` | `object` | 是 | 原图数据对象 |
| `parts[j].inlineData.mimeType` | `string` | 是 | 图片 MIME 类型，支持 `image/jpeg`、`image/png` 等标准格式 |
| `parts[j].inlineData.data` | `string` | 是 | 图片 Base64 编码数据，建议压缩至 ≤ 5 MB 以优化处理速度 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `candidates` | `array` | 生成结果数组 |
| `candidates[i].content` | `object` | 生成内容容器 |
| `candidates[i].content.role` | `string` | 固定为 `"model"` |
| `candidates[i].content.parts` | `array` | 多模态输出数组，按生成顺序排列 |
| `candidates[i].content.parts[j].text` | `string` | 操作日志文本（思考过程） |
| `candidates[i].content.parts[j].thought` | `boolean` | 思考过程标记（非最终输出，仅记录处理步骤） |
| `candidates[i].content.parts[j].inlineData` | `object` | 图片数据块 |
| `candidates[i].content.parts[j].inlineData.mimeType` | `string` | 输出图片格式（如 `image/png`） |
| `candidates[i].content.parts[j].inlineData.data` | `string` | Base64 编码图片数据 |
| `candidates[i].finishReason` | `string` | 生成终止原因（`STOP` / `MAX_TOKENS` / `ERROR`） |
| `usageMetadata` | `object` | 资源消耗明细 |
| `usageMetadata.promptTokenCount` | `integer` | 输入总 Token 数（图片 + 文本） |
| `usageMetadata.candidatesTokenCount` | `integer` | 输出总 Token 数（主要消耗在图片生成） |
| `usageMetadata.totalTokenCount` | `integer` | 累计 Token 消耗（输入 + 输出） |
| `usageMetadata.trafficType` | `string` | 计费模式（如 `ON_DEMAND` 表示按量付费） |
| `usageMetadata.promptTokensDetails` | `array` | 输入 Token 明细（按模态分类） |
| `usageMetadata.candidatesTokensDetails` | `array` | 输出 Token 明细 |
| `usageMetadata.thoughtsTokenCount` | `integer` | 思考过程 Token 数 |
| `modelVersion` | `string` | 模型版本标识 |
| `createTime` | `string` | 响应创建时间（ISO 8601 格式，UTC 时区） |
| `responseId` | `string` | 唯一响应 ID（用于请求追踪与对账） |

### 错误响应

| HTTP 状态码 | 说明 |
|------------|------|
| `400` | Bad Request，检查 `error.message` 获取详细原因 |
| `500` | Internal Server Error，服务器处理错误 |

---

## 生成期代码

```typescript
// 生成期直接调用示例（Deno 脚本）
// platform_managed：密钥由平台注入，读取 INTEGRATIONS_API_KEY
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface GeminiImageEditRequest {
  /** 中文编辑指令，如"将图片更换个背景"、"去掉图片中的人物"等 */
  editInstruction: string;
  /** 原图 Base64 编码数据（建议压缩至 ≤ 5 MB） */
  imageBase64: string;
  /** 原图 MIME 类型，如 image/jpeg、image/png */
  mimeType: string;
  /** 可选：返回内容类型，"image" 返回 Base64 PNG，"text" 返回操作日志 */
  responseModalities?: string;
  /** 可选：生成温度，值越低结果越稳定 */
  temperature?: number;
  /** 可选：生成结果数量 */
  n?: number;
}

interface GeminiImagePart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  text?: string;
  thought?: boolean;
}

interface GeminiImageEditResult {
  /** Base64 编码的结果图片数据 */
  imageBase64: string;
  /** 输出图片的 MIME 类型 */
  imageMimeType: string;
  /** 操作日志文本（若有） */
  logText?: string;
  /** Token 消耗统计 */
  usage: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion: string;
  responseId: string;
}

/**
 * 调用 Gemini 图片生成与编辑接口，通过中文指令对图片进行 AI 编辑。
 * @param params - 编辑请求参数
 * @returns 编辑结果，含 Base64 图片和 Token 统计
 */
async function callGeminiImageEdit(
  params: GeminiImageEditRequest
): Promise<GeminiImageEditResult> {
  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { text: params.editInstruction },
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.imageBase64,
            },
          },
        ],
      },
    ],
  };

  if (params.responseModalities !== undefined) {
    requestBody.responseModalities = params.responseModalities;
  }
  if (params.temperature !== undefined) {
    requestBody.temperature = params.temperature;
  }
  if (params.n !== undefined) {
    requestBody.n = params.n;
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-o9wN0AExZQ8a-gateway.appmiaoda.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = await response.json();

  // 从 candidates 中提取图片和日志
  const parts: GeminiImagePart[] =
    json.candidates?.[0]?.content?.parts ?? [];

  let imageBase64 = "";
  let imageMimeType = "image/png";
  let logText: string | undefined;

  for (const part of parts) {
    if (part.inlineData?.data) {
      imageBase64 = part.inlineData.data;
      imageMimeType = part.inlineData.mimeType ?? "image/png";
    } else if (part.text && !part.thought) {
      logText = part.text;
    }
  }

  if (!imageBase64) {
    throw new Error("响应中未找到图片数据");
  }

  return {
    imageBase64,
    imageMimeType,
    logText,
    usage: {
      promptTokenCount: json.usageMetadata?.promptTokenCount ?? 0,
      candidatesTokenCount: json.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokenCount: json.usageMetadata?.totalTokenCount ?? 0,
    },
    modelVersion: json.modelVersion ?? "",
    responseId: json.responseId ?? "",
  };
}

// 使用示例
// 假设 imageBase64 已通过 Deno.readFile + base64 编码获得
const result = await callGeminiImageEdit({
  editInstruction: "将图片更换个背景",
  imageBase64: "<base64_encoded_image>",
  mimeType: "image/jpeg",
});
console.log("生成图片 Base64 长度:", result.imageBase64.length);
console.log("Token 消耗:", result.usage);
```

---

## Edge Function 代码

Web 和 MiniProgram 使用相同的 Edge Function（均返回 Base64 JSON），前端处理方式不同。

```typescript
// edge-functions/gemini-image-editing.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let editInstruction: string;
  let imageBase64: string;
  let mimeType: string;
  let responseModalities: string | undefined;
  let temperature: number | undefined;
  let n: number | undefined;

  try {
    const body = await req.json();
    editInstruction = body.editInstruction;
    imageBase64 = body.imageBase64;
    mimeType = body.mimeType;
    responseModalities = body.responseModalities;
    temperature = body.temperature;
    n = body.n;

    if (!editInstruction) throw new Error("Missing editInstruction");
    if (!imageBase64) throw new Error("Missing imageBase64");
    if (!mimeType) throw new Error("Missing mimeType");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（不可暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构造请求体 ---
  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { text: editInstruction },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
  };

  if (responseModalities !== undefined) {
    requestBody.responseModalities = responseModalities;
  }
  if (temperature !== undefined) {
    requestBody.temperature = temperature;
  }
  if (n !== undefined) {
    requestBody.n = n;
  }

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-o9wN0AExZQ8a-gateway.appmiaoda.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
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
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();

  // --- 提取图片数据，简化返回结构 ---
  interface Part {
    inlineData?: { mimeType: string; data: string };
    text?: string;
    thought?: boolean;
  }

  const parts: Part[] = data.candidates?.[0]?.content?.parts ?? [];
  let resultImageBase64 = "";
  let resultMimeType = "image/png";
  let logText: string | undefined;

  for (const part of parts) {
    if (part.inlineData?.data) {
      resultImageBase64 = part.inlineData.data;
      resultMimeType = part.inlineData.mimeType ?? "image/png";
    } else if (part.text && !part.thought) {
      logText = part.text;
    }
  }

  return new Response(
    JSON.stringify({
      imageBase64: resultImageBase64,
      mimeType: resultMimeType,
      logText,
      usage: data.usageMetadata,
      modelVersion: data.modelVersion,
      responseId: data.responseId,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

---

## 前端调用代码

### Web 平台

```typescript
// Web 前端：调用 Edge Function 并渲染编辑后的图片

/**
 * 将 File 对象转换为 Base64 字符串（不含 data URI 前缀）。
 * @param file - 图片文件
 * @returns Base64 编码字符串
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 去掉 "data:image/jpeg;base64," 前缀，仅保留 Base64 数据
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 调用 Gemini 图片编辑 Edge Function，返回编辑后的图片 Base64 数据。
 * @param editInstruction - 中文编辑指令
 * @param imageFile - 待编辑的图片文件
 * @returns 编辑结果，含 imageBase64 和 mimeType
 */
async function editImageWithGemini(
  editInstruction: string,
  imageFile: File
): Promise<{ imageBase64: string; mimeType: string; logText?: string }> {
  const imageBase64 = await fileToBase64(imageFile);
  const mimeType = imageFile.type || "image/jpeg";

  const { data, error } = await supabase.functions.invoke(
    "gemini-image-editing",
    {
      body: { editInstruction, imageBase64, mimeType },
    }
  );

  if (error) throw error;
  if (!data.imageBase64) throw new Error("未收到图片数据");

  return {
    imageBase64: data.imageBase64,
    mimeType: data.mimeType ?? "image/png",
    logText: data.logText,
  };
}

// 使用示例（React）
// const { imageBase64, mimeType } = await editImageWithGemini("将图片更换个背景", selectedFile);
// const imgSrc = `data:${mimeType};base64,${imageBase64}`;
// <img src={imgSrc} alt="编辑后的图片" />
```

### MiniProgram（Taro）平台

在微信小程序真机环境中，`<image>` 组件不支持 `data:` URI，需先将 Base64 写入临时文件，再使用临时文件路径展示。

```typescript
// MiniProgram 前端：调用 Edge Function 并展示编辑后的图片

/**
 * 调用 Gemini 图片编辑 Edge Function，获取编辑后图片的 Base64 数据。
 * @param editInstruction - 中文编辑指令
 * @param imageBase64 - 原图 Base64 编码（不含 data URI 前缀）
 * @param mimeType - 原图 MIME 类型，如 image/jpeg
 * @returns 编辑结果，含 imageBase64 和 mimeType
 */
async function editImageWithGemini(
  editInstruction: string,
  imageBase64: string,
  mimeType: string
): Promise<{ imageBase64: string; mimeType: string }> {
  const { data, error } = await supabase.functions.invoke(
    "gemini-image-editing",
    {
      body: { editInstruction, imageBase64, mimeType },
    }
  );

  if (error) throw error;
  if (!data.imageBase64) throw new Error("未收到图片数据");

  return { imageBase64: data.imageBase64, mimeType: data.mimeType ?? "image/png" };
}

/**
 * 将 Base64 图片数据写入临时文件，返回临时文件路径（适配 weapp 真机）。
 * weapp 真机上 <image> 组件不接受 data: URI，必须写临时文件后展示。
 * @param base64Data - Base64 编码图片数据（不含前缀）
 * @param ext - 文件扩展名，如 "png"、"jpg"
 * @returns 临时文件路径
 */
async function base64ToTempFile(base64Data: string, ext = "png"): Promise<string> {
  const tempFilePath =
    `${Taro.env.USER_DATA_PATH}/gemini_edit_${Date.now()}.${ext}`;

  await new Promise<void>((resolve, reject) => {
    const fs = Taro.getFileSystemManager();
    fs.writeFile({
      filePath: tempFilePath,
      data: base64Data,
      encoding: "base64",
      success: () => resolve(),
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });

  return tempFilePath;
}

// 使用示例（Taro + React）
// 步骤 1：生成编辑图片
// const { imageBase64, mimeType } = await editImageWithGemini("将图片更换个背景", srcBase64, "image/jpeg");
//
// 步骤 2：写临时文件（weapp 真机必须，H5 可用 data: URI）
// let displaySrc: string;
// if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
//   displaySrc = `data:${mimeType};base64,${imageBase64}`;
// } else {
//   displaySrc = await base64ToTempFile(imageBase64, mimeType.split("/")[1] ?? "png");
// }
// setResultImageSrc(displaySrc);
// <Image src={displaySrc} />
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
2. **图片大小**：建议将原图压缩至 ≤ 5 MB 再做 Base64 编码，避免请求超时或 Token 消耗过高。
3. **Token 计费**：
   - 图片模态 Token 约 500–1000 Token/MB，文本 Token 约 2–3 Token/字（中文）。
   - 一次典型编辑（约 1 MB 图片）消耗约 1500–2000 Token。
   - 接口原价 `0.00`，按调用次数计费（`need_count_calls: true`）。
4. **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足），Edge Function 已将这两类错误原文转发。
5. **响应结构**：`candidates[].content.parts` 中可能同时包含 `thought: true` 的文本（思考过程日志）和 `inlineData`（图片数据），提取图片时需过滤 `thought: true` 的元素。
6. **MiniProgram 真机**：微信小程序真机不支持 `data:` URI 渲染图片，必须通过 `FileSystemManager.writeFile` 写临时文件后使用临时路径。
7. **`finishReason`**：若值为 `ERROR` 或 `MAX_TOKENS`，说明生成失败或截断，需在前端给出提示并允许重试。
