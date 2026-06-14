# 汽车票识别 API 参考

## API 基本信息

| 属性 | 值 |
|------|-----|
| Plugin ID | `90ab1592-62ab-4f13-b170-fe46a70dc8cb` |
| API ID | `api-Xa6JZxjyqrGa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Xa6JZxjyqrGa-gateway.appmiaoda.com/rest/2.0/ocr/v1/bus_ticket` |
| Auth 模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/x-www-form-urlencoded` |
| third_part_domain | `app-cblk1rqa5fk1-api-Xa6JZxjyqrGa-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 否 | 图像数据 base64 编码，大小不超过 8M |
| `url` | string | 否 | 图片完整 URL，长度不超过 1024 字节 |
| `pdf_file` | string | 否 | PDF 文件 base64 编码 |
| `pdf_file_num` | string | 否 | PDF 页码，默认第 1 页 |
| `ofd_file` | string | 否 | OFD 文件 base64 编码 |
| `ofd_file_num` | string | 否 | OFD 页码，默认第 1 页 |

> 输入优先级：`image` > `url` > `pdf_file` > `ofd_file`，至少提供其中一个。

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 请求唯一标识 |
| `words_result_num` | number | 识别到的字段数量 |
| `words_result.InvoiceCode` | string | 发票代码 |
| `words_result.InvoiceNum` | string | 发票号码 |
| `words_result.Date` | string | 日期（格式：YYYY-MM-DD） |
| `words_result.Time` | string | 时间（格式：HH:MM） |
| `words_result.StartingStation` | string | 出发站 |
| `words_result.DestinationStation` | string | 到达站 |
| `words_result.Fare` | string | 金额（单位：元） |
| `words_result.IdNum` | string | 身份证号（脱敏） |
| `words_result.Name` | string | 姓名 |

> 部分字段在票面上不存在时可能缺失，调用方需做缺省处理。

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 错误码 |
| `error_msg` | string | 错误信息 |

---

## 生成期代码（Agent 直接调用）

```typescript
// 生成期直接调用，密钥由平台环境变量注入
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥

interface BusTicketResult {
  log_id: string;
  words_result_num: number;
  words_result: {
    InvoiceCode?: string;
    InvoiceNum?: string;
    Date?: string;
    Time?: string;
    StartingStation?: string;
    DestinationStation?: string;
    Fare?: string;
    IdNum?: string;
    Name?: string;
  };
}

/**
 * 调用汽车票 OCR 识别接口，返回结构化识别结果。
 * @param params - 输入参数，image / url / pdf_file / ofd_file 至少提供一个
 * @param params.image - 图像 base64 编码字符串（大小 ≤ 8M），可选
 * @param params.url - 图片完整 URL（长度 ≤ 1024 字节），可选
 * @param params.pdf_file - PDF 文件 base64 编码，可选
 * @param params.pdf_file_num - PDF 页码，默认 "1"，可选
 * @param params.ofd_file - OFD 文件 base64 编码，可选
 * @param params.ofd_file_num - OFD 页码，默认 "1"，可选
 * @returns 汽车票识别结果，含 words_result 各字段
 */
async function recognizeBusTicket(params: {
  image?: string;
  url?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
}): Promise<BusTicketResult> {
  if (!params.image && !params.url && !params.pdf_file && !params.ofd_file) {
    throw new Error("至少提供 image、url、pdf_file、ofd_file 其中一个参数");
  }

  // 仅将非空参数加入表单，避免传递空字符串
  const formParams: Record<string, string> = {};
  if (params.image) formParams["image"] = params.image;
  if (params.url) formParams["url"] = params.url;
  if (params.pdf_file) formParams["pdf_file"] = params.pdf_file;
  if (params.pdf_file_num) formParams["pdf_file_num"] = params.pdf_file_num;
  if (params.ofd_file) formParams["ofd_file"] = params.ofd_file;
  if (params.ofd_file_num) formParams["ofd_file_num"] = params.ofd_file_num;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyqrGa-gateway.appmiaoda.com/rest/2.0/ocr/v1/bus_ticket",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(formParams).toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP 错误：${response.status}`);
  }

  const json = await response.json();
  if (json.error_code) {
    throw new Error(`API 错误 ${json.error_code}：${json.error_msg}`);
  }

  return json as BusTicketResult;
}

// 使用示例：通过图片 URL 识别
const result = await recognizeBusTicket({
  url: "https://example.com/bus_ticket.jpg",
});
console.log("识别结果：", JSON.stringify(result.words_result, null, 2));
```

---

## Edge Function 代码

```typescript
// edge-functions/bus-ticket-ocr.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * 汽车票 OCR Edge Function。
   * 接收前端传入的图片数据（image base64 / url / pdf_file / ofd_file），
   * 注入平台密钥后转发到百度 OCR 接口，返回识别结果 JSON。
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求体 ---
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
      throw new Error("至少提供 image、url、pdf_file、ofd_file 其中一个参数");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（严禁暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构造表单参数，仅传非空字段 ---
  const formParams: Record<string, string> = {};
  if (image) formParams["image"] = image;
  if (url) formParams["url"] = url;
  if (pdf_file) formParams["pdf_file"] = pdf_file;
  if (pdf_file_num) formParams["pdf_file_num"] = pdf_file_num;
  if (ofd_file) formParams["ofd_file"] = ofd_file;
  if (ofd_file_num) formParams["ofd_file_num"] = ofd_file_num;

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyqrGa-gateway.appmiaoda.com/rest/2.0/ocr/v1/bus_ticket",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(formParams).toString(),
    }
  );

  // 原样转发配额超限和余额不足错误
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `上游服务错误：${upstream.status}` }),
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

### Web 平台（推荐方式，使用 supabase client）

```typescript
interface BusTicketWords {
  InvoiceCode?: string;
  InvoiceNum?: string;
  Date?: string;
  Time?: string;
  StartingStation?: string;
  DestinationStation?: string;
  Fare?: string;
  IdNum?: string;
  Name?: string;
}

interface BusTicketResponse {
  log_id: string;
  words_result_num: number;
  words_result: BusTicketWords;
}

/**
 * 调用汽车票 OCR Edge Function，返回识别结果。
 * @param params - 输入参数，image / url / pdf_file / ofd_file 至少提供一个
 * @returns 汽车票识别结果
 */
async function recognizeBusTicket(params: {
  image?: string;
  url?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
}): Promise<BusTicketWords> {
  const { data, error } = await supabase.functions.invoke("bus-ticket-ocr", {
    body: params,
  });
  if (error) throw error;
  if (data.error_code) {
    throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  }
  return (data as BusTicketResponse).words_result;
}

// 使用示例：通过图片 URL 识别
const words = await recognizeBusTicket({
  url: "https://example.com/bus_ticket.jpg",
});
console.log("出发站：", words.StartingStation);
console.log("到达站：", words.DestinationStation);
console.log("金额：", words.Fare);
```

### MiniProgram 平台（使用 supabase client）

MiniProgram 与 Web 端的接口调用方式相同，直接使用 `supabase.functions.invoke` 即可，返回 JSON 数据，无需特殊处理。

```typescript
// MiniProgram（Taro）前端调用示例
const handleRecognize = async (imageBase64: string) => {
  const { data, error } = await supabase.functions.invoke("bus-ticket-ocr", {
    body: { image: imageBase64 },
  });
  if (error) throw error;
  if (data.error_code) {
    throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  }
  const words = data.words_result as BusTicketWords;
  // 在界面上展示识别结果
  console.log("汽车票识别结果：", words);
};
```

### 备用方式（无法使用 supabase client 时）

```typescript
/**
 * 通过原生 fetch 调用汽车票 OCR Edge Function。
 * @param params - 输入参数
 * @returns 汽车票识别结果
 */
async function recognizeBusTicketRaw(params: {
  image?: string;
  url?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
}): Promise<BusTicketWords> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bus-ticket-ocr`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
  if (json.error_code) {
    throw new Error(`API 错误 ${json.error_code}：${json.error_msg}`);
  }
  return json.words_result as BusTicketWords;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **输入参数**：`image`、`url`、`pdf_file`、`ofd_file` 至少提供一个；同时提供多个时，优先级为
  `image > url > pdf_file > ofd_file`。
- **图片大小**：base64 编码图片大小不超过 8M；图片 URL 长度不超过 1024 字节。
- **字段缺失**：部分票面上缺少的字段（如 Time、IdNum）在 `words_result` 中不会返回，调用方需做可选字段处理。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误，并向用户提供明确提示。
- **计费**：单次调用原价 ¥2.40，折扣价 ¥2.00（按 `price_unit=2` 即每 2 次计费），请避免重复调用或
  在无效图片上消耗配额。
- **支持格式**：jpg、jpeg、png、bmp 格式图片；同时支持 PDF 和 OFD 文档按页识别。
