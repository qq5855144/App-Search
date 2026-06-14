---
name: object-scene-recognition
description: 识别图片中的通用物体和场景，返回最多5个标签（含置信度和百科信息），适用于图片内容分析、智能相册、内容审核等场景。
license: MIT
---

## 能力概述

调用百度 AI 图像理解接口，对输入图片识别出多个物体及场景标签，可识别超过 10 万类常见物体和场景。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-zYm4zKQoePjL-gateway.appmiaoda.com/rest/2.0/image-classify/v2/advanced_general`
- **Content-Type**：`application/x-www-form-urlencoded`
- **认证模式**：`platform_managed`，密钥由平台注入（`INTEGRATIONS_API_KEY`）
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。
- **支持平台**：Web、MiniProgram
- **返回格式**：JSON，包含识别结果数组（keyword、score、root、baike_info）

| 能力维度 | 说明 |
|---------|------|
| 识别类目 | 超过 10 万类，含人物、动物、植物、建筑、食物、场景等 |
| 最大结果数 | 5 个标签 |
| 图片输入方式 | Base64 编码 或 公开 URL |
| 百科信息 | 可选返回（由 `baike_num` 参数控制） |
| 图片格式 | jpg、jpeg、png、bmp |
| 图片大小限制 | 不超过 8M；最短边 ≥ 15px，最长边 ≤ 8192px |

典型响应示例：

```json
{
  "log_id": 327863200205075661,
  "result_num": 5,
  "result": [
    {
      "keyword": "新垣结衣",
      "score": 0.967622,
      "root": "公众人物",
      "baike_info": {
        "baike_url": "http://baike.baidu.com/item/...",
        "image_url": "http://imgsrc.baidu.com/...",
        "description": "新垣结衣(Aragaki Yui)，1988年6月11日出生于冲绳县那霸市..."
      }
    },
    {
      "keyword": "头发",
      "score": 0.716067,
      "root": "人物-人物特写"
    }
  ]
}
```

---

## 生成期用法（Agent 直接调用）

直接在脚本中调用上游 API，适用于生成阶段的批处理或数据分析场景。

详见 [references/advanced-general-api.md](references/advanced-general-api.md) — 生成期代码章节。

---

## 生成后用法（应用内通过 Edge Function 调用）

Web 和 MiniProgram 均通过 Supabase Edge Function 代理调用，保护 `INTEGRATIONS_API_KEY` 不暴露到前端。两个平台的 Edge Function 逻辑相同（均返回 JSON），前端调用方式一致，可共用同一个 Edge Function。

详见 [references/advanced-general-api.md](references/advanced-general-api.md) — Edge Function 及前端调用代码章节。
