# taxi-receipt-ocr API 参考文档

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `0d5623f2-4b41-4d17-885d-e41178515b29` |
| API ID | `api-ELbWz8Omem6Y` |
| Endpoint | `https://app-cblk1rqa5fk1-api-ELbWz8Omem6Y-gateway.appmiaoda.com/rest/2.0/ocr/v1/taxi_receipt` |
| Method | `POST` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth 模式 | `platform_managed`（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Third-party Domain | `app-cblk1rqa5fk1-api-ELbWz8Omem6Y-gateway.appmiaoda.com` |

---

## 请求参数表

> 四个输入参数均为可选，但至少需要提供其中一个。优先级：`image > url > pdf_file > ofd_file`

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 否 | 图像数据 Base64 编码，大小不超过 8M（jpg/jpeg/png/bmp） |
| `url` | string | 否 | 图片完整 URL 地址 |
| `pdf_file` | string | 否 | PDF 文件 Base64 编码 |
| `pdf_file_num` | string | 否 | PDF 页码，默认第 1 页 |
| `ofd_file` | string | 否 | OFD 文件 Base64 编码 |
| `ofd_file_num` | string | 否 | OFD 页码，默认第 1 页 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 请求日志 ID，用于问题排查 |
| `words_result_num` | number | 识别字段数量 |
| `words_result.InvoiceCode` | string | 发票代码 |
| `words_result.InvoiceNum` | string | 发票号码 |
| `words_result.TaxiNum` | string | 车牌号 |
| `words_result.Date` | string | 日期（格式：YYYY-MM-DD） |
| `words_result.Time` | string | 上下车时间范围（格式：HH:mm-HH:mm） |
| `words_result.PickupTime` | string | 上车时间（格式：HH:mm） |
| `words_result.DropoffTime` | string | 下车时间（格式：HH:mm） |
| `words_result.Fare` | string | 计价金额（含单位，如 "¥153.30元"） |
| `words_result.FuelOilSurcharge` | string | 燃油附加费（含单位，如 "¥1.00"） |
| `words_result.CallServiceSurcharge` | string | 叫车服务费（含单位，如 "¥1.00"） |
| `words_result.TotalFare` | string | 总金额（含单位，如 "¥155.30元"） |
| `words_result.Province` | string | 省份 |
| `words_result.City` | string | 城市 |
| `words_result.Location`? | string | 开票城市（部分发票含此字段） |
| `words_result.PricePerkm` | string | 单价（格式：如 "2.50元/KM"） |
| `words_result.Distance` | string | 里程（格式：如 "4.5KM"） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | number | 请求日志 ID |
| `error_code` | number | 错误码 |
| `error_msg` | string | 错误描述信息 |

**常见错误码：**

| error_code | 说明 |
|------------|------|
| 216101 | 缺少必需参数（image/url/pdf_file/ofd_file 均未提供） |
| 216102 | 图片格式错误 |
| 216103 | 图片大小超限（超过 8M） |
| 216630 | 识别错误 |
| 282000 | 服务内部错误 |

---

## 生成期代码

完整 TypeScript 实现，可直接在 Deno 脚本中运行：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface TaxiReceiptWordsResult {
  InvoiceCode?: string;
  InvoiceNum?: string;
  TaxiNum?: string;
  Date?: string;
  Time?: string;
  PickupTime?: string;
  DropoffTime?: string;
  Fare?: string;
  FuelOilSurcharge?: string;
  CallServiceSurcharge?: string;
  TotalFare?: string;
  Province?: string;
  City?: string;
  Location?: string;
  PricePerkm?: string;
  Distance?: string;
}

interface TaxiReceiptResponse {
  log_id: string;
  words_result_num: number;
  words_result: TaxiReceiptWordsResult;
}

interface TaxiReceiptParams {
  image?: string;       // Base64 编码图片，优先级最高
  url?: string;         // 图片完整 URL
  pdf_file?: string;    // PDF 文件 Base64 编码
  pdf_file_num?: string; // PDF 页码，默认第 1 页
  ofd_file?: string;    // OFD 文件 Base64 编码
  ofd_file_num?: string; // OFD 页码，默认第 1 页
}

/**
 * 识别出租车票，提取16个关键字段。
 * @param params - 输入参数，至少提供 image/url/pdf_file/ofd_file 之一
 * @returns 识别结果，含 words_result 和 words_result_num
 */
async function recognizeTaxiReceipt(params: TaxiReceiptParams): Promise<TaxiReceiptResponse> {
  if (!params.image && !params.url && !params.pdf_file && !params.ofd_file) {
    throw new Error("至少需要提供 image、url、pdf_file 或 ofd_file 之一");
  }

  const bodyParams: Record<string, string> = {};
  if (params.image) bodyParams.image = params.image;
  else if (params.url) bodyParams.url = params.url;
  else if (params.pdf_file) {
    bodyParams.pdf_file = params.pdf_file;
    if (params.pdf_file_num) bodyParams.pdf_file_num = params.pdf_file_num;
  } else if (params.ofd_file) {
    bodyParams.ofd_file = params.ofd_file;
    if (params.ofd_file_num) bodyParams.ofd_file_num = params.ofd_file_num;
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8Omem6Y-gateway.appmiaoda.com/rest/2.0/ocr/v1/taxi_receipt",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(bodyParams).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.error_code) throw new Error(`API error ${json.error_code}: ${json.error_msg}`);

  return json as TaxiReceiptResponse;
}
```

---

## Edge Function 代码

> 本接口 Web 和 MiniProgram 均返回 JSON 数据，两个平台可共用同一个 Edge Function。

```typescript
// edge-functions/taxi-receipt-ocr.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let image: string | undefined;
  let url: string | undefined;
  let pdf_file: string | undefined;
  let pdf_file_num: string | undefined;
  let ofd_file: string | undefined;
  let ofd_file_num: string | undefined;

  try {
    const body = await req.json();
    image = body.image;
    url = body.url;
    pdf_file = body.pdf_file;
    pdf_file_num = body.pdf_file_num;
    ofd_file = body.ofd_file;
    ofd_file_num = body.ofd_file_num;

    if (!image && !url && !pdf_file && !ofd_file) {
      throw new Error("Missing input: provide image, url, pdf_file, or ofd_file");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（严禁暴露给客户端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构造请求参数（优先级：image > url > pdf_file > ofd_file） ---
  const bodyParams: Record<string, string> = {};
  if (image) {
    bodyParams.image = image;
  } else if (url) {
    bodyParams.url = url;
  } else if (pdf_file) {
    bodyParams.pdf_file = pdf_file;
    if (pdf_file_num) bodyParams.pdf_file_num = pdf_file_num;
  } else if (ofd_file) {
    bodyParams.ofd_file = ofd_file;
    if (ofd_file_num) bodyParams.ofd_file_num = ofd_file_num;
  }

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8Omem6Y-gateway.appmiaoda.com/rest/2.0/ocr/v1/taxi_receipt",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(bodyParams).toString(),
    }
  );

  // 透传配额超限 / 余额不足错误
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

### Web 平台

**推荐方式（supabase client 可用时）：**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface TaxiReceiptResult {
  log_id: string;
  words_result_num: number;
  words_result: Record<string, string>;
}

/**
 * 通过 Edge Function 调用出租车票识别接口（Web 端）。
 * @param imageBase64 - 图片 Base64 编码字符串（不含 data URI 前缀）
 * @returns 识别结果
 */
async function recognizeTaxiReceiptWeb(imageBase64: string): Promise<TaxiReceiptResult> {
  const { data, error } = await supabase.functions.invoke("taxi-receipt-ocr", {
    body: { image: imageBase64 },
  });
  if (error) throw error;
  if (data.error_code) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data as TaxiReceiptResult;
}

// 从 File 对象读取 Base64（Web 端）
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 去掉 "data:image/xxx;base64," 前缀
      const result = (reader.result as string).split(",")[1];
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 使用示例
// const file = event.target.files[0];
// const base64 = await fileToBase64(file);
// const result = await recognizeTaxiReceiptWeb(base64);
// console.log(result.words_result);
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用出租车票识别 Edge Function（Web 备用方案）。
 * @param imageBase64 - 图片 Base64 编码字符串
 * @returns 识别结果
 */
async function recognizeTaxiReceiptFetch(imageBase64: string): Promise<TaxiReceiptResult> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taxi-receipt-ocr`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
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
  return json as TaxiReceiptResult;
}
```

---

### MiniProgram 平台（Taro）

```typescript
import Taro from "@tarojs/taro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!
);

/**
 * 从本地临时文件路径读取图片 Base64（小程序端）。
 * @param filePath - 本地临时文件路径（chooseImage 返回的 tempFilePath）
 * @returns Base64 编码字符串（不含前缀）
 */
async function tempFileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = Taro.getFileSystemManager();
    fs.readFile({
      filePath,
      encoding: "base64",
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });
}

/**
 * 选择图片并调用出租车票识别接口（小程序端）。
 * @returns 识别结果
 */
async function recognizeTaxiReceiptMiniProgram(): Promise<TaxiReceiptResult> {
  // 步骤 1：用户选择图片
  const chooseResult = await Taro.chooseImage({
    count: 1,
    sizeType: ["original", "compressed"],
    sourceType: ["album", "camera"],
  });
  const tempFilePath = chooseResult.tempFilePaths[0];

  // 步骤 2：读取 Base64
  const imageBase64 = await tempFileToBase64(tempFilePath);

  // 步骤 3：调用 Edge Function
  const { data, error } = await supabase.functions.invoke("taxi-receipt-ocr", {
    body: { image: imageBase64 },
  });
  if (error) throw error;
  if (data.error_code) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data as TaxiReceiptResult;
}
```

---

## 注意事项

### 密钥安全
`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get("INTEGRATIONS_API_KEY")` 读取，严禁暴露到前端代码或客户端环境变量中。

### 计费
- **原价**：¥2.40 / 次
- **折扣价**：¥2.00 / 次
- 每次成功调用均计费（`need_count_calls: true`），请在应用中避免不必要的重复调用，建议对相同图片做本地缓存。

### 错误处理
- 务必处理 429（配额超限）和 402（余额不足）两种情况，Edge Function 已将这两类错误透传给客户端。
- OCR 识别失败时（如 error_code=216630），应向用户提示重新上传更清晰的图片。

### 图片要求
- 支持格式：jpg、jpeg、png、bmp
- 图片大小：不超过 8M
- Base64 编码时不需要包含 `data:image/xxx;base64,` 前缀，直接传编码后的字符串即可。

### 参数优先级
当同时传入多个输入参数时，服务端按 `image > url > pdf_file > ofd_file` 的优先级处理，建议只传一个输入参数以避免混淆。
