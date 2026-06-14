# 文档格式转换 — 提交请求接口

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `0cf63ee3-d579-4191-a267-fe7ec70a10d5` |
| API ID | `api-rY7JZ6jqrneL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-rY7JZ6jqrneL-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/request` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth 模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| third_part_domain | `app-cblk1rqa5fk1-api-rY7JZ6jqrneL-gateway.appmiaoda.com` |
| 计费 | 启用计费，按调用次数计费；原价 ¥2.20 / 次，折扣价 ¥1.80 / 次 |

---

## 请求参数表

> 三个输入参数（image / url / pdf_file）三选一，优先级：image > url > pdf_file。

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 三选一 | 图片 base64 编码（去掉 `data:image/jpeg;base64,` 头）。支持 jpg/jpeg/png/bmp，base64 后不超过 4M，最短边 ≥ 15px，最长边 ≤ 4096px |
| `url` | string | 三选一 | 图片完整 URL，长度 ≤ 1024 字节。支持 jpg/jpeg/png/bmp，base64 后不超过 4M。注意关闭 URL 防盗链 |
| `pdf_file` | string | 三选一 | PDF 文件 base64 编码，base64 后不超过 10M |
| `pdf_file_num` | string | 否 | 需要识别的 PDF 页码（从 1 开始）。仅 `pdf_file` 有效时生效；不传则识别所有页 |

---

## 响应字段表

### 成功响应（`success: true`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | boolean | `true` 表示请求成功 |
| `log_id` | number | 唯一 log id，用于问题定位 |
| `result.task_id` | string | 生成的任务 ID，后续用于查询结果 |
| `code` | number | 成功状态码（如 `1001`） |
| `message` | string | 详情（如 `"Create task successfully!"`） |

### 失败响应（`success: false`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | boolean | `false` 表示请求异常 |
| `log_id` | number | 唯一 log id |
| `code` | number | 错误状态码（如 `216401`） |
| `message` | string | 错误详情（如 `"Create task failed!"`） |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 提交文档格式转换任务，返回 task_id。
 * @param input - 输入来源，三选一：image（图片 base64）、url（图片完整 URL）、pdfFile（PDF base64）
 * @param pdfFileNum - 可选，指定 PDF 页码（从 1 开始），不传则识别全部页
 * @returns task_id 字符串，供后续轮询使用
 */
async function submitDocConvert(
  input: { image?: string; url?: string; pdfFile?: string },
  pdfFileNum?: string
): Promise<string> {
  const params: Record<string, string> = {};
  if (input.image) {
    params.image = input.image;
  } else if (input.url) {
    params.url = input.url;
  } else if (input.pdfFile) {
    params.pdf_file = input.pdfFile;
  } else {
    throw new Error("必须提供 image、url 或 pdfFile 其中之一");
  }
  if (pdfFileNum) params.pdf_file_num = pdfFileNum;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-rY7JZ6jqrneL-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/request",
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
  if (!json.success) {
    throw new Error(`提交失败: ${json.message} (code: ${json.code})`);
  }
  return json.result.task_id;
}
```

---

## Edge Function 代码

```typescript
// edge-functions/doc-convert-submit.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let image: string | undefined;
  let url: string | undefined;
  let pdfFile: string | undefined;
  let pdfFileNum: string | undefined;

  try {
    const body = await req.json();
    image = body.image;
    url = body.url;
    pdfFile = body.pdf_file;
    pdfFileNum = body.pdf_file_num;

    // 三选一校验
    if (!image && !url && !pdfFile) {
      throw new Error("必须提供 image、url 或 pdf_file 其中之一");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构造上游请求参数 ---
  const params: Record<string, string> = {};
  if (image) {
    params.image = image;
  } else if (url) {
    params.url = url;
  } else if (pdfFile) {
    params.pdf_file = pdfFile;
  }
  if (pdfFileNum) params.pdf_file_num = pdfFileNum;

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-rY7JZ6jqrneL-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/request",
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

---

## 前端调用代码

### 推荐方式（supabase client 可用时）

```typescript
/**
 * 调用提交接口，返回 task_id。
 * @param input - 输入来源，三选一
 * @param pdfFileNum - 可选，PDF 页码
 * @returns task_id 字符串
 */
async function submitDocConvert(
  input: { image?: string; url?: string; pdf_file?: string },
  pdfFileNum?: string
): Promise<string> {
  const body: Record<string, string> = {};
  if (input.image) body.image = input.image;
  else if (input.url) body.url = input.url;
  else if (input.pdf_file) body.pdf_file = input.pdf_file;
  if (pdfFileNum) body.pdf_file_num = pdfFileNum;

  const { data, error } = await supabase.functions.invoke("doc-convert-submit", { body });
  if (error) throw error;
  if (!data.success) throw new Error(`提交失败: ${data.message} (code: ${data.code})`);
  return data.result.task_id;
}
```

### 备用方式（无 supabase client）

```typescript
/**
 * 调用提交接口（原生 fetch），返回 task_id。
 * @param input - 输入来源，三选一
 * @param pdfFileNum - 可选，PDF 页码
 * @returns task_id 字符串
 */
async function submitDocConvert(
  input: { image?: string; url?: string; pdf_file?: string },
  pdfFileNum?: string
): Promise<string> {
  const body: Record<string, string> = {};
  if (input.image) body.image = input.image;
  else if (input.url) body.url = input.url;
  else if (input.pdf_file) body.pdf_file = input.pdf_file;
  if (pdfFileNum) body.pdf_file_num = pdfFileNum;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doc-convert-submit`,
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
  if (!json.success) throw new Error(`提交失败: ${json.message} (code: ${json.code})`);
  return json.result.task_id;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：提交请求接口按调用次数计费，原价 ¥2.20 / 次，折扣价 ¥1.80 / 次。获取结果接口不计费。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **输入优先级**：`image` > `url` > `pdf_file`，当 `image` 存在时，其余字段无效。
- **文件限制**：图片 base64 后 ≤ 4M，PDF base64 后 ≤ 10M。
- **QPS 限制**：提交接口 QPS 上限为 2，请避免高频并发提交。
- **异步流程**：提交后必须调用查询接口（`doc-convert-query`）轮询结果，详见 `doc-convert-query-api.md`。
