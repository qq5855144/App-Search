---
name: document-format-conversion
description: 将图片或 PDF 文档转换为 Word/Excel，保留原版式，支持表格/印章/水印/手写内容。需要 OCR 文档格式转换、PDF 转 Word/Excel 时使用。
license: MIT
---

## 能力概述

**文档格式转换**（百度 OCR）是一个**异步**接口，分两步完成：

1. **提交请求**（Submit）：上传图片或 PDF，获取 `task_id`
2. **轮询结果**（Poll）：用 `task_id` 查询进度，直到 `ret_code = 3` 时获取下载链接

| 维度 | 说明 |
|------|------|
| 提交接口 | `POST https://app-cblk1rqa5fk1-api-rY7JZ6jqrneL-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/request` |
| 查询接口 | `POST https://app-cblk1rqa5fk1-api-oYA6ZGjReooa-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/get_request_result` |
| Content-Type | `application/x-www-form-urlencoded` |
| 认证模式 | `platform_managed`（`traefik: true`） |
| 输入格式 | 图片 base64（jpg/jpeg/png/bmp，≤4M）、图片 URL，或 PDF base64（≤10M） |
| 输出格式 | Word 和 Excel 文件下载链接（有效期 30 天） |
| 计费 | 原价 ¥2.20 / 次，折扣价 ¥1.80 / 次（按提交请求计次，获取结果不计费） |

**关键约束：**
- `ret_code = 1`（未开始）、`ret_code = 2`（进行中）时**必须继续轮询**，不可停止
- 仅 `ret_code = 3` 时停止轮询，读取 `result_data.word` / `result_data.excel` 下载链接
- 提交接口 QPS 上限 2，查询接口 QPS 上限 10
- 建议提交后等待 5～10 秒再首次查询

---

## 生成期用法（Agent 直接调用）

完整异步工作流（提交 → 轮询 → 获取结果），详见 `references/doc-convert-submit-api.md` 和
`references/doc-convert-query-api.md`。

以下为端到端完整示例：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 提交文档格式转换任务。
 * @param input - 输入来源，三选一：image（图片 base64）、url（图片 URL）、pdfFile（PDF base64）
 * @param pdfFileNum - 可选，指定 PDF 页码（从 1 开始），不传则识别所有页
 * @returns task_id 字符串
 */
async function submitDocConvert(
  input: { image?: string; url?: string; pdfFile?: string },
  pdfFileNum?: string
): Promise<string> {
  const params: Record<string, string> = {};
  if (input.image) params.image = input.image;
  else if (input.url) params.url = input.url;
  else if (input.pdfFile) params.pdf_file = input.pdfFile;
  else throw new Error("必须提供 image、url 或 pdfFile 其中之一");
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
  if (!json.success) throw new Error(`提交失败: ${json.message} (code: ${json.code})`);
  return json.result.task_id;
}

/**
 * 查询文档格式转换任务结果。
 * @param taskId - 提交时返回的 task_id
 * @returns 查询结果对象（含 ret_code、result_data 等）
 */
async function queryDocConvert(taskId: string): Promise<{
  ret_code: number;
  percent: number;
  result_data?: { word: string; excel: string };
}> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-oYA6ZGjReooa-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/get_request_result",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ task_id: taskId }).toString(),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (!json.success) throw new Error(`查询失败: ${json.message} (code: ${json.code})`);
  return json.result;
}

/**
 * 完整端到端：提交文档转换任务并等待结果。
 * @param input - 输入来源（三选一）
 * @param pdfFileNum - 可选，指定 PDF 页码
 * @returns Word 和 Excel 文件下载链接
 */
async function convertDocument(
  input: { image?: string; url?: string; pdfFile?: string },
  pdfFileNum?: string
): Promise<{ word: string; excel: string }> {
  const taskId = await submitDocConvert(input, pdfFileNum);

  const POLL_INTERVAL_MS = 7000;           // 建议 5～10 秒
  const TIMEOUT_MS = 10 * 60 * 1000;      // 最长等待 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryDocConvert(taskId);

    if (result.ret_code === 3) {
      // 已完成，返回下载链接
      return result.result_data ?? { word: "", excel: "" };
    }
    // ret_code = 1（未开始）或 2（进行中）：继续轮询，不可停止
  }
  throw new Error(`任务 ${taskId} 在 10 分钟内未完成，已超时`);
}
```

详细参数说明与响应结构见：
- `references/doc-convert-submit-api.md`（提交请求接口）
- `references/doc-convert-query-api.md`（获取结果接口）

---

## 生成后用法（应用内通过 Edge Function 调用）

本插件为**异步**流程，需要两个 Edge Function（分别对应提交和查询），前端负责轮询。

| 平台 | Edge Function | 前端轮询方式 |
|------|--------------|-------------|
| Web / MiniProgram | `doc-convert-submit` + `doc-convert-query` | 调用两次 Edge Function，`ret_code ≠ 3` 时继续轮询 |

完整 Edge Function 代码、前端调用代码及注意事项详见：
- `references/doc-convert-submit-api.md`（提交 Edge Function + 前端调用）
- `references/doc-convert-query-api.md`（查询 Edge Function + 前端轮询循环）
