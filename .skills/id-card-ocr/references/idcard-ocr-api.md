# 身份证识别接口 API 参考

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `feccaf6c-9221-4532-b7e0-f95086eec01d` |
| API ID | `api-k93RZBjP0zqa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-k93RZBjP0zqa-gateway.appmiaoda.com/rest/2.0/ocr/v1/idcard` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 认证模式 | `platform_managed` |
| third_part_domain | `app-cblk1rqa5fk1-api-k93RZBjP0zqa-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 否（与 `url` 二选一） | 图像 base64 编码（去掉编码头，如 `data:image/jpeg;base64,` 前缀） |
| `url` | string | 否（与 `image` 二选一） | 图片完整 URL，支持 jpg/jpeg/png/bmp 格式 |
| `id_card_side` | string | 是 | 身份证正反面：`front`（正面/头像面）或 `back`（反面/国徽面） |
| `detect_ps` | string | 否 | 是否检测 PS：`true` / `false` |
| `detect_risk` | string | 否 | 是否检测风险类型（复印件、临时证、翻拍、修改等）：`true` / `false` |
| `detect_quality` | string | 否 | 是否检测质量（清晰度、边框完整性、遮挡）：`true` / `false` |
| `detect_direction` | string | 否 | 是否检测图片方向并自动矫正：`true` / `false` |

> `image` 和 `url` 必须传其中一个；同时传入时以 `image` 优先。

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 唯一请求标识 |
| `image_status` | string | 图片状态：`normal`（正常）等 |
| `words_result` | object | 识别结果，key 为字段名称 |
| `words_result.姓名.words` | string | 姓名（正面） |
| `words_result.性别.words` | string | 性别（正面） |
| `words_result.民族.words` | string | 民族（正面） |
| `words_result.出生.words` | string | 出生日期，格式 `YYYYMMDD`（正面） |
| `words_result.住址.words` | string | 住址（正面） |
| `words_result.公民身份号码.words` | string | 18 位身份证号码（正面） |
| `words_result.签发机关.words` | string | 签发机关（反面） |
| `words_result.签发日期.words` | string | 签发日期，格式 `YYYYMMDD`（反面） |
| `words_result.失效日期.words` | string | 失效日期，格式 `YYYYMMDD`（反面） |
| `words_result_num` | number | 识别到的字段数量 |
| `risk_type`? | string | 风险类型（仅 `detect_risk=true` 时返回） |
| `card_quality`? | object | 质量评分（仅 `detect_quality=true` 时返回） |
| `card_ps`? | string | PS 检测结果（仅 `detect_ps=true` 时返回） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 错误码 |
| `error_msg` | string | 错误描述 |

---

## 生成期代码（TypeScript）

```typescript
/**
 * 调用百度 OCR 接口识别身份证信息。
 *
 * @param idCardSide - 正面 "front" 或反面 "back"
 * @param imageBase64 - 图片 base64（不含编码头），与 imageUrl 二选一
 * @param imageUrl - 图片完整 URL，与 imageBase64 二选一
 * @param options - 可选检测项
 * @returns 包含 words_result 的 OCR 结果对象
 */
async function recognizeIdCard(
  idCardSide: "front" | "back",
  imageBase64?: string,
  imageUrl?: string,
  options?: {
    detectPs?: boolean;
    detectRisk?: boolean;
    detectQuality?: boolean;
    detectDirection?: boolean;
  }
): Promise<Record<string, unknown>> {
  const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

  const params: Record<string, string> = {
    id_card_side: idCardSide,
  };
  if (imageBase64) params.image = imageBase64;
  if (imageUrl) params.url = imageUrl;
  if (options?.detectPs !== undefined) params.detect_ps = String(options.detectPs);
  if (options?.detectRisk !== undefined) params.detect_risk = String(options.detectRisk);
  if (options?.detectQuality !== undefined) params.detect_quality = String(options.detectQuality);
  if (options?.detectDirection !== undefined) params.detect_direction = String(options.detectDirection);

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-k93RZBjP0zqa-gateway.appmiaoda.com/rest/2.0/ocr/v1/idcard",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.error_code) {
    throw new Error(`API error ${json.error_code}: ${json.error_msg}`);
  }

  return json;
}

// 使用示例：识别正面
const result = await recognizeIdCard("front", undefined, "https://example.com/idcard_front.jpg");
console.log("姓名:", result.words_result?.["姓名"]?.words);
console.log("公民身份号码:", result.words_result?.["公民身份号码"]?.words);
```

---

## Edge Function 代码

### Web 平台 Edge Function（`edge-functions/id-card-ocr.ts`）

```typescript
// edge-functions/id-card-ocr.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let idCardSide: string;
  let image: string | undefined;
  let url: string | undefined;
  let detectPs: string | undefined;
  let detectRisk: string | undefined;
  let detectQuality: string | undefined;
  let detectDirection: string | undefined;

  try {
    const body = await req.json();
    idCardSide = body.id_card_side;
    if (!idCardSide) throw new Error("Missing id_card_side");
    if (!body.image && !body.url) throw new Error("Missing image or url");
    image = body.image;
    url = body.url;
    detectPs = body.detect_ps;
    detectRisk = body.detect_risk;
    detectQuality = body.detect_quality;
    detectDirection = body.detect_direction;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（绝不暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构造上游请求参数 ---
  const params: Record<string, string> = { id_card_side: idCardSide };
  if (image) params.image = image;
  if (url) params.url = url;
  if (detectPs !== undefined) params.detect_ps = detectPs;
  if (detectRisk !== undefined) params.detect_risk = detectRisk;
  if (detectQuality !== undefined) params.detect_quality = detectQuality;
  if (detectDirection !== undefined) params.detect_direction = detectDirection;

  // --- 调用上游 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-k93RZBjP0zqa-gateway.appmiaoda.com/rest/2.0/ocr/v1/idcard",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
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

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### MiniProgram 平台 Edge Function

MiniProgram 与 Web 使用相同的 Edge Function（均返回 JSON，无二进制媒体流），无需单独实现。
部署同一个 `id-card-ocr` Edge Function 即可。

---

## 前端调用代码

### Web 平台前端（React / TypeScript）

```typescript
import { supabase } from "@/lib/supabase";

interface IdCardOcrOptions {
  /** 正面 "front" 或反面 "back" */
  idCardSide: "front" | "back";
  /** 图片 base64（不含编码头），与 imageUrl 二选一 */
  imageBase64?: string;
  /** 图片完整 URL，与 imageBase64 二选一 */
  imageUrl?: string;
  detectPs?: boolean;
  detectRisk?: boolean;
  detectQuality?: boolean;
  detectDirection?: boolean;
}

interface WordResult {
  words: string;
}

interface IdCardOcrResult {
  log_id: string;
  image_status: string;
  words_result: Record<string, WordResult>;
  words_result_num: number;
  risk_type?: string;
  card_quality?: Record<string, unknown>;
  card_ps?: string;
}

/**
 * 通过 Edge Function 识别身份证信息。
 *
 * @param options - 识别选项，含图片来源和可选检测项
 * @returns OCR 识别结果
 */
async function recognizeIdCard(options: IdCardOcrOptions): Promise<IdCardOcrResult> {
  const body: Record<string, unknown> = {
    id_card_side: options.idCardSide,
  };
  if (options.imageBase64) body.image = options.imageBase64;
  if (options.imageUrl) body.url = options.imageUrl;
  if (options.detectPs !== undefined) body.detect_ps = String(options.detectPs);
  if (options.detectRisk !== undefined) body.detect_risk = String(options.detectRisk);
  if (options.detectQuality !== undefined) body.detect_quality = String(options.detectQuality);
  if (options.detectDirection !== undefined) body.detect_direction = String(options.detectDirection);

  const { data, error } = await supabase.functions.invoke("id-card-ocr", { body });
  if (error) throw error;
  if (data.error_code) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data as IdCardOcrResult;
}

// 使用示例
async function handleIdCardUpload(file: File, side: "front" | "back") {
  // 将 File 转为 base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 去掉 data:image/jpeg;base64, 前缀
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const result = await recognizeIdCard({ idCardSide: side, imageBase64: base64 });
  console.log("识别结果:", result.words_result);
  if (side === "front") {
    console.log("姓名:", result.words_result["姓名"]?.words);
    console.log("证件号:", result.words_result["公民身份号码"]?.words);
  } else {
    console.log("签发机关:", result.words_result["签发机关"]?.words);
    console.log("有效期:", result.words_result["签发日期"]?.words, "~", result.words_result["失效日期"]?.words);
  }
  return result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function recognizeIdCardRaw(options: IdCardOcrOptions): Promise<IdCardOcrResult> {
  const body: Record<string, unknown> = { id_card_side: options.idCardSide };
  if (options.imageBase64) body.image = options.imageBase64;
  if (options.imageUrl) body.url = options.imageUrl;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/id-card-ocr`,
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
  if (json.error_code) throw new Error(`API 错误 ${json.error_code}：${json.error_msg}`);
  return json as IdCardOcrResult;
}
```

### MiniProgram 平台前端（Taro / TypeScript）

```typescript
import { supabase } from "@/lib/supabase";

interface IdCardOcrOptions {
  idCardSide: "front" | "back";
  imageBase64?: string;
  imageUrl?: string;
}

/**
 * 通过 Edge Function 识别身份证信息（MiniProgram 平台）。
 *
 * @param options - 识别选项
 * @returns OCR 识别结果
 */
async function recognizeIdCard(options: IdCardOcrOptions): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { id_card_side: options.idCardSide };
  if (options.imageBase64) body.image = options.imageBase64;
  if (options.imageUrl) body.url = options.imageUrl;

  const { data, error } = await supabase.functions.invoke("id-card-ocr", { body });
  if (error) throw error;
  if (data.error_code) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data;
}

// 使用示例：选择图片并识别正面
async function handleChooseAndRecognize() {
  const res = await Taro.chooseImage({ count: 1, sizeType: ["compressed"] });
  const filePath = res.tempFilePaths[0];

  // 读取文件为 base64
  const fs = Taro.getFileSystemManager();
  const base64 = await new Promise<string>((resolve, reject) => {
    fs.readFile({
      filePath,
      encoding: "base64",
      success: (r) => resolve(r.data as string),
      fail: (e) => reject(new Error(JSON.stringify(e))),
    });
  });

  const result = await recognizeIdCard({ idCardSide: "front", imageBase64: base64 });
  console.log("识别结果:", result.words_result);
  return result;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端或客户端代码中。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足）两类错误，并向用户给出友好提示。
- **图片格式**：支持 jpg、jpeg、png、bmp 格式；传 base64 时需去掉 `data:image/...;base64,` 前缀。
- **正反面区分**：`id_card_side` 为必传参数，`front` 识别头像面（姓名/性别/民族/出生/住址/证件号），
  `back` 识别国徽面（签发机关/签发日期/失效日期）。
- **可选检测项**：
  - `detect_quality=true`：检测清晰度、边框完整性、遮挡情况，返回 `card_quality` 字段。
  - `detect_risk=true`：检测复印件、临时身份证、翻拍、修改等风险，返回 `risk_type` 字段。
  - `detect_ps=true`：检测是否被 PS，返回 `card_ps` 字段。
- **计费**：计费以平台实际配置为准，请在业务逻辑中避免不必要的重复调用（如
  相同图片重复提交）。可结合前端缓存或哈希去重来控制调用次数。
- **第三方域名**：实际请求转发至 `app-cblk1rqa5fk1-api-k93RZBjP0zqa-gateway.appmiaoda.com`，网关代理后客户端无需感知。
