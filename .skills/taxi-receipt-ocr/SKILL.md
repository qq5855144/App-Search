---
name: taxi-receipt-ocr
description: 识别全国各大城市出租车票，提取发票号、车牌号、金额、时间等16个关键字段；适用于财务报销、出行费用管理场景。
license: MIT
---

## 能力概述

调用百度 OCR 接口识别出租车票图片，支持 jpg/jpeg/png/bmp 格式，返回 16 个结构化字段（发票代码、发票号码、车牌号、日期、上下车时间、金额、燃油附加费、叫车服务费、总金额、省份、城市、单价、里程等）。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-ELbWz8Omem6Y-gateway.appmiaoda.com/rest/2.0/ocr/v1/taxi_receipt`
- **Content-Type**：`application/x-www-form-urlencoded`
- **认证模式**：`platform_managed`（密钥由平台注入，无需用户配置）
- **输入方式**：支持 Base64 图片、图片 URL、PDF 文件（Base64）、OFD 文件（Base64），优先级：`image > url > pdf_file > ofd_file`
- **响应格式**：JSON，含 `words_result` 对象和 `words_result_num` 计数

### 多平台差异说明

| 维度 | Web | MiniProgram |
|------|-----|-------------|
| Edge Function | 标准 JSON 响应 | 标准 JSON 响应（相同） |
| 前端调用 | `supabase.functions.invoke` | `supabase.functions.invoke` |
| 图片处理 | FileReader API 读取 Base64 | `Taro.chooseImage` + FileSystemManager 读取 Base64 |

> 详细参数表、响应结构、完整代码见 [references/taxi-receipt-ocr-api.md](references/taxi-receipt-ocr-api.md)

---

## 生成期用法（Agent 直接调用）

本 skill 含 Base64 图像输入，完整代码见 `references/taxi-receipt-ocr-api.md` 的「生成期代码」章节。

简要调用方式：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 识别出租车票，提取发票号、车牌号、金额、时间等 16 个关键字段。
 * @param image - 图片 Base64 编码字符串（不含 data URI 前缀，大小不超过 8M）
 * @returns 识别结果，含 words_result 对象和 words_result_num 计数
 */
async function recognizeTaxiReceipt(image: string): Promise<TaxiReceiptResult> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8Omem6Y-gateway.appmiaoda.com/rest/2.0/ocr/v1/taxi_receipt",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ image }).toString(), // image 为 Base64 字符串
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.error_code) throw new Error(`API error ${json.error_code}: ${json.error_msg}`);
  return json;
}

// 典型用法：将 File 转为 Base64 后传入
// const base64 = await fileToBase64(file); // 读取 Base64，去掉 data URI 前缀
// const result = await recognizeTaxiReceipt(base64);
// console.log(result.words_result); // 输出 16 个结构化字段
```

详见 [references/taxi-receipt-ocr-api.md](references/taxi-receipt-ocr-api.md)

---

## 生成后用法（应用内通过 Edge Function 调用）

客户端将图片 Base64 发送到 Edge Function，Edge Function 注入平台密钥后转发至上游 OCR 接口，原始 JSON 响应透传回客户端。

| 平台 | Edge Function 文件 | 前端调用方式 |
|------|-------------------|-------------|
| Web | `edge-functions/taxi-receipt-ocr.ts` | `supabase.functions.invoke` 或原生 `fetch` |
| MiniProgram | `edge-functions/taxi-receipt-ocr.ts`（同一份） | `supabase.functions.invoke`，图片需用 FileSystemManager 读取 Base64 |

完整 Edge Function 代码和前端调用代码见 [references/taxi-receipt-ocr-api.md](references/taxi-receipt-ocr-api.md)
