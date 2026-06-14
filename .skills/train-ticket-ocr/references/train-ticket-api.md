# 火车票识别 API

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `6386ef84-de65-46f3-b77a-dee7078966a6` |
| API ID | `api-Xa6JZxjyqZna` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Xa6JZxjyqZna-gateway.appmiaoda.com/rest/2.0/ocr/v1/train_ticket` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| 认证模式 | `platform_managed` |
| Third-party Domain | `app-cblk1rqa5fk1-api-Xa6JZxjyqZna-gateway.appmiaoda.com` |
| 流式响应 | 否 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `image` | string | 否 | — | 图片 Base64 编码，大小不超过 8M；支持 jpg/jpeg/png/bmp |
| `url` | string | 否 | — | 图片完整 URL 地址 |
| `pdf_file` | string | 否 | — | PDF 文件 Base64 编码 |
| `pdf_file_num` | string | 否 | `"1"` | PDF 页码，默认第 1 页 |
| `ofd_file` | string | 否 | — | OFD 文件 Base64 编码 |
| `ofd_file_num` | string | 否 | `"1"` | OFD 页码，默认第 1 页 |

> **输入优先级**：`image` > `url` > `pdf_file` > `ofd_file`，至少传入其中一项。

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 请求日志 ID |
| `direction` | number | 图片方向（0 正向，1 旋转 90°，2 旋转 180°，3 旋转 270°） |
| `words_result_num` | number | 识别字段数量 |
| `words_result.ticket_num` | string | 车票号 |
| `words_result.starting_station` | string | 始发站 |
| `words_result.destination_station` | string | 到达站 |
| `words_result.train_num` | string | 车次号 |
| `words_result.date` | string | 出发日期 |
| `words_result.time` | string | 出发时间 |
| `words_result.ticket_rates` | string | 票价 |
| `words_result.seat_category` | string | 席别 |
| `words_result.seat_num` | string | 座位号 |
| `words_result.name` | string | 乘客姓名 |
| `words_result.id_num` | string | 身份证号（部分脱敏） |
| `words_result.serial_number` | string | 序列号 |
| `words_result.sales_station` | string | 售票站 |
| `words_result.refund_flag`? | string | 退票标识（电子票专属） |
| `words_result.invoice_num`? | string | 发票号码（电子票专属） |
| `words_result.invoice_date`? | string | 开票日期（电子票专属） |
| `words_result.fare`? | string | 不含税金额（电子票专属） |
| `words_result.tax_rate`? | string | 税率（电子票专属） |
| `words_result.tax`? | string | 税额（电子票专属） |
| `words_result.elec_ticket_num`? | string | 电子客票号（电子票专属） |

### 失败响应

| 字段 | 类型 | 说明 |
|------|------|------|
| `error_code` | number | 错误码（如 110 Token 无效，282000 服务器内部错误） |
| `error_msg` | string | 错误描述 |

---

## 生成期代码

适用于后台脚本、批量任务、Agent 直接调用场景（Deno 运行时）。

```typescript
/**
 * 调用火车票识别接口，对火车票图片或电子客票文件进行结构化 OCR 识别。
 * @param params - 请求参数，至少提供 image/url/pdf_file/ofd_file 之一
 * @returns 识别结果的 words_result 对象
 */
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface TrainTicketParams {
  image?: string;       // 图片 Base64，大小不超过 8M
  url?: string;         // 图片完整 URL
  pdf_file?: string;    // PDF 文件 Base64
  pdf_file_num?: string; // PDF 页码，默认 "1"
  ofd_file?: string;    // OFD 文件 Base64
  ofd_file_num?: string; // OFD 页码，默认 "1"
}

interface TrainTicketResult {
  ticket_num?: string;
  starting_station?: string;
  destination_station?: string;
  train_num?: string;
  date?: string;
  time?: string;
  ticket_rates?: string;
  seat_category?: string;
  seat_num?: string;
  name?: string;
  id_num?: string;
  serial_number?: string;
  sales_station?: string;
  refund_flag?: string;
  invoice_num?: string;
  invoice_date?: string;
  fare?: string;
  tax_rate?: string;
  tax?: string;
  elec_ticket_num?: string;
}

async function recognizeTrainTicket(params: TrainTicketParams): Promise<TrainTicketResult> {
  /**
   * 识别火车票关键字段，返回结构化 words_result 对象。
   * @param params - 请求参数，优先级: image > url > pdf_file > ofd_file
   * @returns words_result 对象，含票号、车次、站点、日期等字段
   */
  const formData = new URLSearchParams();
  if (params.image) formData.append("image", params.image);
  if (params.url) formData.append("url", params.url);
  if (params.pdf_file) formData.append("pdf_file", params.pdf_file);
  if (params.pdf_file_num) formData.append("pdf_file_num", params.pdf_file_num);
  if (params.ofd_file) formData.append("ofd_file", params.ofd_file);
  if (params.ofd_file_num) formData.append("ofd_file_num", params.ofd_file_num);

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyqZna-gateway.appmiaoda.com/rest/2.0/ocr/v1/train_ticket",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: formData.toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);

  const json = await response.json();
  if (json.error_code) {
    throw new Error(`API 错误 ${json.error_code}: ${json.error_msg}`);
  }

  return json.words_result as TrainTicketResult;
}

// 使用示例：通过图片 URL 识别
const result = await recognizeTrainTicket({
  url: "https://example.com/train-ticket.jpg",
});
console.log("车次:", result.train_num);
console.log("出发:", result.starting_station, "→", result.destination_station);
console.log("乘客:", result.name, "座位:", result.seat_num);
```

---

## Edge Function 代码

Web 和 MiniProgram 均返回 JSON 响应，Edge Function 实现相同，部署一份即可。

```typescript
// edge-functions/train-ticket-ocr.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * 火车票识别 Edge Function。
   * 接收前端传入的图片/URL/PDF/OFD 数据，调用上游 OCR 接口并返回结构化识别结果。
   * @param req - HTTP POST 请求，Body 为 JSON，至少包含 image/url/pdf_file/ofd_file 之一
   * @returns JSON 响应，包含 words_result 对象
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
      throw new Error("至少需要提供 image、url、pdf_file、ofd_file 之一");
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "无效的请求体" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（禁止暴露给客户端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "服务器配置错误：缺少 INTEGRATIONS_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 构建上游请求参数 ---
  const formData = new URLSearchParams();
  if (image) formData.append("image", image);
  if (url) formData.append("url", url);
  if (pdf_file) formData.append("pdf_file", pdf_file);
  if (pdf_file_num) formData.append("pdf_file_num", pdf_file_num);
  if (ofd_file) formData.append("ofd_file", ofd_file);
  if (ofd_file_num) formData.append("ofd_file_num", ofd_file_num);

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Xa6JZxjyqZna-gateway.appmiaoda.com/rest/2.0/ocr/v1/train_ticket",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: formData.toString(),
    }
  );

  // 转发配额/余额错误原文
  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `上游服务错误: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();

  // 检查业务错误码
  if (data.error_code) {
    return new Response(
      JSON.stringify({ error: `OCR 错误 ${data.error_code}: ${data.error_msg}` }),
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

**推荐方式（supabase client 可用时）：**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * 通过图片 Base64 或 URL 调用火车票识别 Edge Function。
 * @param params - 识别参数，至少传入 image 或 url 之一
 * @returns words_result 对象
 */
async function recognizeTrainTicket(params: {
  image?: string;
  url?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
}) {
  const { data, error } = await supabase.functions.invoke("train-ticket-ocr", {
    body: params,
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.words_result;
}

// 使用示例：通过图片 URL 识别
const result = await recognizeTrainTicket({
  url: "https://example.com/train-ticket.jpg",
});
console.log(`${result.train_num} ${result.starting_station} → ${result.destination_station}`);
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用火车票识别 Edge Function（无 supabase client 时使用）。
 * @param params - 识别参数
 * @returns words_result 对象
 */
async function recognizeTrainTicket(params: {
  image?: string;
  url?: string;
  pdf_file?: string;
  pdf_file_num?: string;
  ofd_file?: string;
  ofd_file_num?: string;
}) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/train-ticket-ocr`,
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
  if (json.error) throw new Error(json.error);
  return json.words_result;
}
```

### MiniProgram 平台（Taro）

```typescript
import { createClient } from "@supabase/supabase-js";
import Taro from "@tarojs/taro";

const supabase = createClient(
  process.env.TARO_APP_SUPABASE_URL!,
  process.env.TARO_APP_SUPABASE_ANON_KEY!
);

/**
 * 小程序端：将本地图片转 Base64 后调用火车票识别接口。
 * @param localFilePath - 本地图片路径（由 Taro.chooseImage 获取）
 * @returns words_result 对象
 */
async function recognizeTrainTicketFromLocal(localFilePath: string) {
  // 读取本地文件并转换为 Base64
  const fs = Taro.getFileSystemManager();
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    fs.readFile({
      filePath: localFilePath,
      encoding: "base64",
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });

  const { data, error } = await supabase.functions.invoke("train-ticket-ocr", {
    body: { image: imageBase64 },
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.words_result;
}

// 使用示例：选图并识别
async function handlePickAndRecognize() {
  const res = await Taro.chooseImage({ count: 1, sizeType: ["compressed"] });
  const filePath = res.tempFilePaths[0];
  const result = await recognizeTrainTicketFromLocal(filePath);
  console.log("车次:", result.train_num, "票价:", result.ticket_rates);
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁在前端代码中直接使用或暴露。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足）状态码，并给用户明确提示。
- **计费**：折扣价 **¥2.00 / 次**（原价 ¥2.40 / 次），每次成功调用计费，请避免重复提交相同图片。
- **图片大小**：Base64 编码后的图片不超过 8M，建议前端压缩后再传输。
- **输入格式**：支持 jpg、jpeg、png、bmp 格式图片；电子客票支持 PDF 和 OFD 文件。
- **多输入模式**：同时传入多个输入时，按 `image` > `url` > `pdf_file` > `ofd_file` 优先级取用第一个有效输入。
- **脱敏字段**：`id_num`（身份证号）返回值含星号脱敏，不可依赖其完整性做身份验证。
- **电子票字段**：`refund_flag`、`invoice_num`、`fare`、`tax_rate`、`tax`、`elec_ticket_num` 仅在识别铁路电子客票时返回，普通纸质票不含这些字段。
