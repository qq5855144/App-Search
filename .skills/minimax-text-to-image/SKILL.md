---
name: minimax-text-to-image
description: 调用 MiniMax 文生图接口，根据文本描述生成图片并转存至 Supabase Storage，适用于创意设计、海报生成、游戏场景绘制等场景。
license: MIT
---

## 能力概述

通过 MiniMax 文生图 API 将文本描述转换为图片，支持 `image-01` 和 `image-01-live` 两种模型，以及多种宽高比与批量生成。

- `image-01`：通用文生图模型，支持自定义宽高（512–2048 px）、`21:9` 超宽比例及 URL/base64 两种返回格式。
- `image-01-live`：真实感增强模型，适合人物写实风格，支持通过 `style` 参数指定画风（`漫画`/`元气`/`中世纪`/`水彩`），不支持自定义宽高和 `21:9` 比例。

| 项目 | 值 |
|------|-----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO7vB8pQba-gateway.appmiaoda.com/v1/image_generation` |
| 认证模式 | `platform_managed`（密钥由平台注入，无需用户配置） |
| Content-Type | `application/json` |
| 支持平台 | Web、MiniProgram |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。


**核心能力：**
- 文本 prompt 最长 1500 字符，支持 prompt 自动优化
- 宽高比：`1:1`（默认）/ `16:9` / `4:3` / `3:2` / `2:3` / `3:4` / `9:16` / `21:9`
- 自定义宽高（512–2048 px，需为 8 的倍数，仅 `image-01`）
- 单次最多生成 9 张，返回格式支持 url / base64
- API 返回的图片 URL 有效期 24 小时，**Edge Function 需将其转存至 Supabase Storage**

**响应示例：**
```json
{
  "id": "03ff3cd0820949eb8a410056b5f21d38",
  "data": {
    "image_urls": ["https://...storage_public_url..."]
  },
  "metadata": { "success_count": 3, "failed_count": 0 },
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```

## 生成期用法（Agent 直接调用）

在脚本中直接调用 MiniMax 文生图接口，生成图片并获取 URL 列表。

详见 [references/image-generation-api.md](references/image-generation-api.md) — 生成期代码一节。

**生成期文件下载（必须执行）：**

生成接口返回的 URL 是 CDN 临时链接（有效期 24 小时），在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<生成的文件 URL>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取文件 URL（可能为多个，逐一下载）
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。

## 生成后用法（应用内通过 Edge Function 调用）

应用内通过 Supabase Edge Function 代理调用，平台密钥由服务端注入，不暴露给客户端。

Edge Function 在拿到上游 `image_urls` 后，调用 `streamMediaToStorage` 将图片转存至 Supabase Storage，返回持久化的公开 URL。

Web 和 MiniProgram 均使用 `supabase.functions.invoke` 调用，返回结构相同。

详见 [references/image-generation-api.md](references/image-generation-api.md) — Edge Function 及前端代码一节。
