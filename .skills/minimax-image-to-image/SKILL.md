---
name: minimax-image-to-image
description: 调用 MiniMax 图像生成 API，根据文本描述和可选的人物参考图生成图片；适用于图像风格转换、人物场景拓展、创意设计迭代、素材二次创作等场景
license: MIT
---

## 能力概述

基于 MiniMax `image-01` 和 `image-01-live` 模型的图像生成能力，支持纯文本生图和图生图（人物主体参考）两种模式。`image-01-live` 模型在 `image-01` 的基础上额外支持画风设置（漫画、元气、中世纪、水彩等风格），适合需要特定艺术风格的图像生成场景。

| 项目 | 详情 |
|------|------|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-6LeBzWJjy3QY-gateway.appmiaoda.com/v1/image_generation` |
| 认证方式 | `platform_managed`，密钥由平台注入 |
| Content-Type | `application/json` |
| 返回格式 | 图片 URL 数组（有效期 24 小时），需转存至 Supabase Storage |
| 最大批量 | 单次最多生成 9 张图片 |
| 文本描述长度 | 最长 1500 字符 |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。


**平台差异：**

| 平台 | Edge Function 特点 | 前端调用方式 |
|------|--------------------|--------------|
| Web | 转存媒体 URL 后返回永久链接 | `supabase.functions.invoke` |
| MiniProgram | 同 Web，接口一致 | `supabase.functions.invoke` |

> 完整参数表、响应结构、生成期代码及各平台 Edge Function 详见
> `references/image-generation-api.md`

---

## 生成期用法（Agent 直接调用）

使用平台注入的 `INTEGRATIONS_API_KEY` 直接调用上游接口，适合在脚本或 Agent 工作流中使用。

详见 `references/image-generation-api.md` → **生成期代码** 小节。

**生成期文件下载（必须执行）：**

生成接口返回的 URL 是 CDN 临时链接（有效期 24 小时），在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

```bash
curl -L -o <本地路径> "<生成的文件 URL>"
```

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取文件 URL
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。

---

## 生成后用法（应用内通过 Edge Function 调用）

在应用中部署 Edge Function，由 Edge Function 负责持有密钥、调用上游、将返回的临时图片 URL 转存至 Supabase Storage，最终向前端返回永久可访问的公开链接。

- Web 与 MiniProgram 共用同一个 Edge Function，前端均使用 `supabase.functions.invoke` 调用。
- 图片 URL 有效期 24 小时，**必须经过 Supabase Storage 转存**，否则链接在生成后很快失效。

详见 `references/image-generation-api.md` → **Edge Function 代码** 和 **前端调用代码** 小节。
