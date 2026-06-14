# air-ticket-ocr API 参考文档

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `ab465fee-da53-4566-8b2b-4f1fb033b83a` |
| API ID | `api-DLEO7Vjd8Qea` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO7Vjd8Qea-gateway.appmiaoda.com/rest/2.0/ocr/v1/air_ticket` |
| Auth 模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party Domain | `app-cblk1rqa5fk1-api-DLEO7Vjd8Qea-gateway.appmiaoda.com` |
| 计费 | 启用；原价 ¥7.20 / 5次，折扣价 ¥5.00 / 5次（即 ¥1.00/次） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `image` | string | 否 | - | 图像 Base64 编码（优先级最高）；编码后不超过 4MB，最短边 ≥ 15px，最长边 ≤ 4096px；支持 jpg/jpeg/png/bmp |
| `url` | string | 否 | - | 图片完整 URL 地址 |
| `pdf_file` | string | 否 | - | PDF 文件 Base64 编码 |
| `pdf_file_num` | string | 否 | `1` | PDF 页码，默认第 1 页 |
| `ofd_file` | string | 否 | - | OFD 文件 Base64 编码 |
| `ofd_file_num` | string | 否 | `1` | OFD 页码，默认第 1 页 |

> 注：`image`、`url`、`pdf_file`、`ofd_file` 四选一，优先级为 `image` > `url` > `pdf_file` > `ofd_file`。

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 请求唯一标识 |
| `words_result_num` | number | 识别到的字段数量 |
| `words_result.name` | string | 乘客姓名 |
| `words_result.starting_station` | string | 始发站 |
| `words_result.destination_station` | string | 目的站 |
| `words_result.flight` | string | 航班号 |
| `words_result.date` | string | 出发日期（yyyy-MM-dd） |
| `words_result.time` | string | 出发时间（HH:mm） |
| `words_result.ticket_number` | string | 电子客票号 |
| `words_result.fare` | string | 票价（元） |
| `words_result.id_num` | string | 身份证号 |
| `words_result.carrier` | string | 承运人（航空公司） |
| `words_result.dev_fund` | string | 民航发展基金（元） |
| `words_result.insurance` | string | 保险费（元） |
| `words_result.fuel_surcharge` | string | 燃油附加费 |
| `words_result.other_tax` | string | 其他税费 |
| `words_result.ticket_rates` | string | 合计金额（元） |
| `words_result.issued_date` | string | 填开日期 |
| `words_result.fare_basis` | string | 票价代码（Fare Basis Code），用于标识票价规则的字母代码 |
| `words_result.class` | string | 座位等级 |
| `words_result.cabin_class_zh` | string | 客票级别（舱位等级中文名，如"经济舱"、"商务舱"） |
| `words_result.flight_type` | string | 航班类型（如"国内"、"国际"） |
| `words_result.agent_code` | string | 销售单位号 |
| `words_result.endorsement` | string | 签注（改签/退票限制） |
| `words_result.allow` | string | 免费行李额 |
| `words_result.ck` | string | 验证码 |

### 失败响应

| 字段 | 类型 | 说明 |
|------|------|------|
| `error_code` | number | 错误码 |
| `error_msg` | string | 错误描述 |

---

## 生成期代码（Agent 直接调用）

```typescript
// 生成期：在 Deno 脚本中直接调用飞机行程单识别 API
// 密钥由平台注入，无需用户配置
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 识别飞机行程单，结构化提取乘客、航班、票价等信息。
 * @param options - 输入选项，四选一：image（Base64）、url、pdf_file（Base64）、ofd_file（Base64）
 * @param options.image - 图像 Base64 编码（优先级最高）
 * @param options.url - 图片完整 URL
 * @param options.pdf_file - PDF 文件 Base64 编码
 * @param options.pdf_file_num - PDF 页码，默认 "1"
 * @param options.ofd_file - OFD 文件 Base64 编码
 * @param options.ofd_file_num - OFD 页码，默认 "1"
 * @returns 结构化的行程单识别结果
 */
async function recognizeAirTicket(options: {
  image?: string;
  url?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
}): Promise<{
  log_id: string;
  words_result_num: number;
  words_result: Record<string, string>;
}> {
  const params: Record<string, string> = {};

  if (options.image) {
    params.image = options.image;
  } else if (options.url) {
    params.url = options.url;
  } else if (options.pdf_file) {
    params.pdf_file = options.pdf_file;
    if (options.pdf_file_num) params.pdf_file_num = options.pdf_file_num;
  } else if (options.ofd_file) {
    params.ofd_file = options.ofd_file;
    if (options.ofd_file_num) params.ofd_file_num = options.ofd_file_num;
  } else {
    throw new Error("至少需要提供 image、url、pdf_file、ofd_file 中的一个参数");
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO7Vjd8Qea-gateway.appmiaoda.com/rest/2.0/ocr/v1/air_ticket",
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

// 使用示例（Base64 图片）
// const result = await recognizeAirTicket({ image: "<base64编码的图片内容>" });
// console.log(result.words_result.name, result.words_result.flight);

// 使用示例（URL）
// const result = await recognizeAirTicket({ url: "https://example.com/air_ticket.jpg" });
```

---

## Edge Function 代码

Web 和 MiniProgram 均返回 JSON，使用同一个 Edge Function。

```typescript
// edge-functions/air-ticket-ocr.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * 飞机行程单识别 Edge Function
   * 接收前端发送的图片（Base64/URL/PDF/OFD），调用百度 OCR API 返回结构化识别结果。
   * 支持 Web 和 MiniProgram 平台，均返回 JSON。
   */
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
      throw new Error("缺少必要参数：image、url、pdf_file、ofd_file 至少提供一个");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构建上游请求参数 ---
  const params: Record<string, string> = {};
  if (image) {
    params.image = image;
  } else if (url) {
    params.url = url;
  } else if (pdf_file) {
    params.pdf_file = pdf_file;
    if (pdf_file_num) params.pdf_file_num = pdf_file_num;
  } else if (ofd_file) {
    params.ofd_file = ofd_file;
    if (ofd_file_num) params.ofd_file_num = ofd_file_num;
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DLEO7Vjd8Qea-gateway.appmiaoda.com/rest/2.0/ocr/v1/air_ticket",
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

  // 上游 API 错误（如图片格式不对、识别失败等）
  if (data.error_code) {
    return new Response(
      JSON.stringify({ error: `API error ${data.error_code}: ${data.error_msg}` }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * 识别飞机行程单（Web 平台）。
 * @param options - 输入选项，四选一：imageBase64、imageUrl、pdfBase64、ofdBase64
 * @returns 结构化识别结果，包含 words_result 各字段
 */
async function recognizeAirTicketWeb(options: {
  imageBase64?: string;
  imageUrl?: string;
  pdfBase64?: string;
  pdfFileNum?: string;
  ofdBase64?: string;
  ofdFileNum?: string;
}) {
  const body: Record<string, string> = {};
  if (options.imageBase64) {
    body.image = options.imageBase64;
  } else if (options.imageUrl) {
    body.url = options.imageUrl;
  } else if (options.pdfBase64) {
    body.pdf_file = options.pdfBase64;
    if (options.pdfFileNum) body.pdf_file_num = options.pdfFileNum;
  } else if (options.ofdBase64) {
    body.ofd_file = options.ofdBase64;
    if (options.ofdFileNum) body.ofd_file_num = options.ofdFileNum;
  }

  const { data, error } = await supabase.functions.invoke("air-ticket-ocr", { body });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data as {
    log_id: string;
    words_result_num: number;
    words_result: Record<string, string>;
  };
}

// 使用示例（读取本地文件转 Base64）
// const file = e.target.files[0];
// const base64 = await new Promise<string>((resolve) => {
//   const reader = new FileReader();
//   reader.onload = () => resolve((reader.result as string).split(",")[1]);
//   reader.readAsDataURL(file);
// });
// const result = await recognizeAirTicketWeb({ imageBase64: base64 });
// console.log(result.words_result.name, result.words_result.flight);
```

### MiniProgram 平台（Taro）

```typescript
import Taro from "@tarojs/taro";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!
);

/**
 * 识别飞机行程单（MiniProgram 平台，Taro）。
 * @param options - 输入选项，四选一：imageBase64、imageUrl、pdfBase64、ofdBase64
 * @returns 结构化识别结果，包含 words_result 各字段
 */
async function recognizeAirTicketMiniProgram(options: {
  imageBase64?: string;
  imageUrl?: string;
  pdfBase64?: string;
  pdfFileNum?: string;
  ofdBase64?: string;
  ofdFileNum?: string;
}) {
  const body: Record<string, string> = {};
  if (options.imageBase64) {
    body.image = options.imageBase64;
  } else if (options.imageUrl) {
    body.url = options.imageUrl;
  } else if (options.pdfBase64) {
    body.pdf_file = options.pdfBase64;
    if (options.pdfFileNum) body.pdf_file_num = options.pdfFileNum;
  } else if (options.ofdBase64) {
    body.ofd_file = options.ofdBase64;
    if (options.ofdFileNum) body.ofd_file_num = options.ofdFileNum;
  }

  const { data, error } = await supabase.functions.invoke("air-ticket-ocr", { body });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data as {
    log_id: string;
    words_result_num: number;
    words_result: Record<string, string>;
  };
}

// 使用示例（微信小程序选择图片并转 Base64）
// const res = await Taro.chooseImage({ count: 1, sizeType: ["compressed"] });
// const tempPath = res.tempFilePaths[0];
// const fsm = Taro.getFileSystemManager();
// const base64 = await new Promise<string>((resolve, reject) => {
//   fsm.readFile({
//     filePath: tempPath,
//     encoding: "base64",
//     success: (r) => resolve(r.data as string),
//     fail: reject,
//   });
// });
// const result = await recognizeAirTicketMiniProgram({ imageBase64: base64 });
// console.log(result.words_result.name, result.words_result.flight);
```

---

## 注意事项

1. **密钥安全**: `INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁在前端代码或客户端环境中暴露。

2. **计费**: 原价 ¥7.20 / 5次（折扣价 ¥5.00 / 5次，即 ¥1.00/次）。每次调用均计费，避免因重试逻辑导致不必要的重复调用。

3. **错误处理**: 务必处理以下错误码：
   - HTTP 429：配额已用尽
   - HTTP 402：余额不足
   - 上游 `error_code` 非零：图片格式不支持、识别失败等

4. **图片要求**:
   - Base64 编码后不超过 4MB
   - 最短边 ≥ 15px，最长边 ≤ 4096px
   - 支持格式：jpg、jpeg、png、bmp

5. **多航班支持**: 单张行程单上若有多个航班信息，API 可一次性识别。

6. **字段缺失**: 若行程单某字段无法识别，对应字段值为空字符串 `""`，调用方需做空值判断。
