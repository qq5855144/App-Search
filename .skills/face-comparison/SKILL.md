---
name: face-comparison
description: 对比两张图片中人脸的相似度，返回相似度分数和人脸 token，适用于身份验证、人脸登录等场景
license: MIT
---

## 能力概述

百度人脸识别 1:1 对比接口，通过上传两张包含人脸的图片，计算两张图中人脸的相似度分数。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-5YrZz81oerkY-gateway.appmiaoda.com/rest/2.0/face/v3/match`
- **认证方式**: platform_managed（密钥由平台注入，读取 `INTEGRATIONS_API_KEY`）
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。
- **Content-Type**: `application/json`
- **请求体**: 包含两个人脸对象的数组，每个对象含图像数据、图像类型、人脸类型、质量控制等级、活体检测等级
- **响应格式**: JSON，含相似度分数（0–100）和每张图片的 face_token

### 典型响应示例

```json
{
  "result": {
    "score": 99.896,
    "face_list": [
      { "face_token": "8a2fbbdb8ceed302d4e77848c6cf7ad8" },
      { "face_token": "307c8a33b1a4dc1cd78fcfe9954488cd" }
    ]
  },
  "log_id": 2178892325,
  "error_code": 0,
  "error_msg": "SUCCESS"
}
```

| 平台 | Edge Function 实现 | 前端调用方式 |
|------|--------------------|--------------|
| Web | 返回 JSON，`upstream.json()` | `supabase.functions.invoke` |
| MiniProgram | 返回 JSON，`upstream.json()` | `supabase.functions.invoke` |

> Web 和 MiniProgram 的实现相同（均为 JSON 响应），可共用同一个 Edge Function。

## 生成期用法（Agent 直接调用）

在生成期直接调用上游 API，无需 Edge Function 中转。

详见 `references/face-comparison-api.md` — **生成期代码** 章节。

## 生成后用法（应用内通过 Edge Function 调用）

应用中通过部署在 Supabase 的 Edge Function 调用，保护 `INTEGRATIONS_API_KEY` 不暴露到前端。

- Web 和 MiniProgram 共用同一个 Edge Function `face-comparison`
- 客户端传入两个人脸对象数组，Edge Function 注入平台密钥后转发到上游

详见 `references/face-comparison-api.md` — **Edge Function 代码** 及 **前端调用代码** 章节。
