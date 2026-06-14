---
name: baidu-encyclopedia
description: 查询百度百科词条内容，支持按词条名或词条ID检索摘要、信息卡及关联知识；适用于问答、搜索、学习等需要权威中文百科内容的场景。
license: MIT
---

## 能力概述

**百度百科查询**接口，通过词条名称或词条 ID 检索百科条目详情，返回摘要、信息卡（人物/事件/概念等结构化属性）、概述图、关联词条及视频信息。

| 项目 | 值 |
|------|----|
| Endpoint | `GET https://app-cblk1rqa5fk1-api-wLNdo2j5eQWa-gateway.appmiaoda.com/v2/baike/lemma/get_content` |
| 认证模式 | `platform_managed`（密钥由平台注入，无需用户配置） |
| 响应格式 | JSON |
| 计费 | 0.50 元 / 次（原价 0.60 元） |

**支持平台：** Web、MiniProgram

### 平台差异说明

| 平台 | 关键差异 |
|------|---------|
| Web | 使用 `supabase.functions.invoke` 调用 Edge Function，无特殊限制 |
| MiniProgram | URL 参数必须经过 `encodeURIComponent` 编码后传入，接收端用 `decodeURIComponent` 解码，否则后端无法识别 |

详细说明见 [references/baike-lemma-api.md](references/baike-lemma-api.md)。

---

## 生成期用法（Agent 直接调用）

在 Deno 脚本中直接调用上游接口，密钥从平台环境变量注入。

简要示例（完整参数表见 [references/baike-lemma-api.md](references/baike-lemma-api.md)）：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function getBaikeLemma(searchType: "lemmaTitle" | "lemmaId", searchKey: string) {
  const params = new URLSearchParams({ search_type: searchType, search_key: searchKey });
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-wLNdo2j5eQWa-gateway.appmiaoda.com/v2/baike/lemma/get_content?${params}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  return json.result;
}
```

完整参数表、响应结构和代码示例见 [references/baike-lemma-api.md](references/baike-lemma-api.md)。

---

## 生成后用法（应用内通过 Edge Function 调用）

客户端调用 Supabase Edge Function，Edge Function 注入 `INTEGRATIONS_API_KEY` 后转发至上游，原始 API Key 不暴露给前端。

**各平台前端调用方式：**

| 平台 | 调用方式 | 注意事项 |
|------|---------|---------|
| Web | `supabase.functions.invoke("baike-lemma", { body: { search_type, search_key } })` | 无特殊限制 |
| MiniProgram | 同上，但传入 `search_key` 前需 `decodeURIComponent` 解码（若来自路由参数） | 路由参数未解码直接传入会导致后端识别失败 |

Edge Function 完整代码、前端代码（含 MiniProgram URL 编解码规范）见 [references/baike-lemma-api.md](references/baike-lemma-api.md)。
