---
name: rideshare-receipt-ocr
description: 识别网约车行程单图片/PDF/OFD，结构化提取服务商、时间、金额、行程明细等信息，适用于财务报销和出行费用管理场景。
license: MIT
---

## 能力概述

对各大主要服务商（滴滴企业版等）的网约车行程单进行结构化 OCR 识别，支持识别 16 个关键字段，包括服务商名称、行程起止时间、总金额、行程明细数组等。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-zYkZz8qoKp1L-gateway.appmiaoda.com/rest/2.0/ocr/v1/online_taxi_itinerary`
- **Content-Type**: `application/x-www-form-urlencoded`
- **认证模式**: `platform_managed`（密钥由平台注入，客户端无需关心）
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。
- **支持平台**: Web、MiniProgram
- **响应格式**: JSON（结构化字段，无媒体 URL）

**输入模式优先级**（四选一）：

| 优先级 | 参数 | 说明 |
|--------|------|------|
| 1 | `image` | 图片 base64 编码（最大 4 MB），支持 jpg/jpeg/png/bmp |
| 2 | `url` | 图片完整 HTTP/HTTPS URL |
| 3 | `pdf_file` | PDF 文件 base64 编码，配合 `pdf_file_num` 指定页码 |
| 4 | `ofd_file` | OFD 文件 base64 编码，配合 `ofd_file_num` 指定页码 |

**响应示例（成功）：**

```json
{
  "log_id": "1385196013945356288",
  "words_result_num": 7,
  "words_result": {
    "ServiceProvider": "滴滴企业版",
    "StartTime": "2020-07-01 16:00",
    "EndTime": "2020-07-30 19:00",
    "Phone": "13000000000",
    "TotalFare": "2316",
    "ItemNum": "3",
    "items": [
      {
        "ItemId": "1",
        "PickupDate": "20-07-01",
        "PickupTime": "16:00",
        "StartPlace": "鱼化寨地铁-D口",
        "DestinationPlace": "创新港",
        "CarType": "快车",
        "Distance": "9.7",
        "City": "西安市",
        "Fare": "20.86"
      }
    ]
  }
}
```

详细参数表与字段说明见 [references/online-taxi-itinerary-ocr-api.md](references/online-taxi-itinerary-ocr-api.md)。

---

## 生成期用法（Agent 直接调用）

在生成期（脚本/Agent 工具调用）中，直接请求上游 API，密钥从平台环境变量读取。

完整的 TypeScript 调用代码见 [references/online-taxi-itinerary-ocr-api.md](references/online-taxi-itinerary-ocr-api.md) — **生成期代码** 章节。

---

## 生成后用法（应用内通过 Edge Function 调用）

在应用内（Web / MiniProgram），前端不可直接持有 `INTEGRATIONS_API_KEY`，须通过 Supabase Edge Function 中转。

- Web 和 MiniProgram 响应均为 JSON，**两个平台共用同一个 Edge Function**，前端调用方式相同。
- Edge Function 从 Deno 环境变量读取密钥，前端只发送 base64 图片或 URL 等参数即可。

完整的 Edge Function 代码与前端调用代码见
[references/online-taxi-itinerary-ocr-api.md](references/online-taxi-itinerary-ocr-api.md) — **Edge Function** 章节。
