# 百度百科查询接口 — 完整规格

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `88ae3607-924e-4dc9-9fb0-2581767dd978` |
| API ID | `api-wLNdo2j5eQWa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-wLNdo2j5eQWa-gateway.appmiaoda.com/v2/baike/lemma/get_content` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Accept | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-wLNdo2j5eQWa-gateway.appmiaoda.com` |
| 计费单价 | 0.50 元 / 次（原价 0.60 元，`enable_billing: true`） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `search_type` | `string` | 是 | 检索类型，可选值：`lemmaTitle`（按词条名）、`lemmaId`（按词条 ID） |
| `search_key` | `string` | 是 | 检索关键字，与 `search_type` 对应的检索条件 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `request_id` | `string` | 请求唯一标识 |
| `result.lemma_id` | `number` | 词条 ID |
| `result.lemma_title` | `string` | 词条名称 |
| `result.lemma_desc` | `string` | 义项描述 |
| `result.url` | `string` | 词条页 URL |
| `result.summary` | `string` | 词条摘要（不超过 400 字节） |
| `result.pic_url` | `string` | 概述图片 URL |
| `result.videos` | `array` | 视频列表（可能为空） |
| `result.videos[].cover_pic_url` | `string` | 视频封面 URL |
| `result.videos[].page_url` | `string` | 视频页面 URL |
| `result.videos[].second_id` | `number` | 视频 ID |
| `result.videos[].second_title` | `string` | 视频标题 |
| `result.relations` | `array` | 关联词条列表（可能为空） |
| `result.relations[].lemma_id` | `number` | 关联词条 ID |
| `result.relations[].lemma_title` | `string` | 关联词条名 |
| `result.relations[].relation_name` | `string` | 关系名称 |
| `result.relations[].square_pic_url` | `string` | 关联词条图片 URL |

### 失败响应

上游返回非 200 状态码时，Edge Function 返回对应错误信息：

| HTTP 状态 | 含义 |
|-----------|------|
| 400 | 请求参数错误（缺少必填字段或格式不合法） |
| 402 | 余额不足 |
| 429 | 配额超限 |
| 502 | 上游服务异常 |

---

## 生成期代码（TypeScript）

```typescript
/**
 * 查询百度百科词条内容。
 * @param searchType - 检索类型："lemmaTitle"（按词条名）或 "lemmaId"（按词条 ID）
 * @param searchKey - 检索关键字（词条名称或词条 ID 字符串）
 * @returns 词条详情 result 对象
 */
async function getBaikeLemma(
  searchType: "lemmaTitle" | "lemmaId",
  searchKey: string,
): Promise<{
  lemma_id: number;
  lemma_title: string;
  lemma_desc: string;
  url: string;
  summary: string;
  pic_url: string;
  videos: Array<{
    cover_pic_url: string;
    page_url: string;
    second_id: number;
    second_title: string;
  }>;
  relations: Array<{
    lemma_id: number;
    lemma_title: string;
    relation_name: string;
    square_pic_url: string;
  }>;
}> {
  const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入
  const params = new URLSearchParams({
    search_type: searchType,
    search_key: searchKey,
  });
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

// 使用示例
const result = await getBaikeLemma("lemmaTitle", "人工智能");
console.log(result.lemma_title, result.summary);
```

---

## Edge Function 代码

本接口为纯 JSON 查询接口，Web 和 MiniProgram 平台的 Edge Function 实现相同；
平台差异仅在前端调用层（URL 参数的编解码处理）。

```typescript
// edge-functions/baike-lemma.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let search_type: string;
  let search_key: string;
  try {
    const body = await req.json();
    search_type = body.search_type;
    search_key = body.search_key;
    if (!search_type) throw new Error("Missing search_type");
    if (!search_key) throw new Error("Missing search_key");
    if (search_type !== "lemmaTitle" && search_type !== "lemmaId") {
      throw new Error("search_type must be 'lemmaTitle' or 'lemmaId'");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露给客户端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const params = new URLSearchParams({ search_type, search_key });
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-wLNdo2j5eQWa-gateway.appmiaoda.com/v2/baike/lemma/get_content?${params}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // 转发配额/余额错误
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

### Web 平台

```typescript
/**
 * 通过 Edge Function 查询百度百科词条内容。
 * @param searchType - 检索类型："lemmaTitle" 或 "lemmaId"
 * @param searchKey - 检索关键字
 * @returns 词条详情 result 对象
 */
async function fetchBaikeLemma(
  searchType: "lemmaTitle" | "lemmaId",
  searchKey: string,
) {
  const { data, error } = await supabase.functions.invoke("baike-lemma", {
    body: { search_type: searchType, search_key: searchKey },
  });
  if (error) throw error;
  return data.result;
}

// 使用示例
const lemma = await fetchBaikeLemma("lemmaTitle", "人工智能");
console.log(lemma.summary);
```

### MiniProgram 平台

> **重要：URL 参数编解码规范（来自 examples 实测约束）**
>
> 从路由 URL 获取的参数未经解码，必须在传入 API 前先 `decodeURIComponent`，
> 否则后端无法识别。
>
> ```typescript
> // 正确：
> // 发送（页面跳转时编码）
> navigateTo(`/page?keyword=${encodeURIComponent(userInput)}`);
> // 接收（传入 API 前解码）
> const keyword = decodeURIComponent(params.keyword);
>
> // 错误：
> // 发送（直接拼接，未编码）
> navigateTo(`/page?keyword=${userInput}`);
> // 接收（直接使用，未解码）
> const keyword = params.keyword;
> ```

```typescript
/**
 * MiniProgram 平台：通过 Edge Function 查询百度百科词条内容。
 * @param searchType - 检索类型："lemmaTitle" 或 "lemmaId"
 * @param searchKey - 检索关键字（若来自路由参数，需先 decodeURIComponent）
 * @returns 词条详情 result 对象
 */
async function fetchBaikeLemma(
  searchType: "lemmaTitle" | "lemmaId",
  searchKey: string,
) {
  // 若 searchKey 来自路由参数（params.keyword），必须先解码：
  // const decodedKey = decodeURIComponent(rawSearchKey);
  const { data, error } = await supabase.functions.invoke("baike-lemma", {
    body: { search_type: searchType, search_key: searchKey },
  });
  if (error) throw error;
  return data.result;
}

// 使用示例（MiniProgram 页面组件中）
const handleSearch = async () => {
  // 从路由参数获取时：const keyword = decodeURIComponent(router.params.keyword);
  const keyword = searchInput; // 直接来自用户输入时无需解码
  const lemma = await fetchBaikeLemma("lemmaTitle", keyword);
  setLemmaData(lemma);
};
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露给前端或写入客户端代码。

2. **计费**：每次 API 调用计费 0.50 元（原价 0.60 元），请避免不必要的重复调用，建议在前端做防抖或结果缓存。

3. **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足），并向用户给出友好提示。

4. **MiniProgram URL 参数编解码**：页面路由传参时用 `encodeURIComponent` 编码，接收并传入 API 前用 `decodeURIComponent` 解码，否则中文词条名会被后端识别失败（来自 examples 实测验证）。

5. **摘要长度**：`summary` 字段不超过 400 字节，适合作为概要展示；完整内容需引导用户访问 `result.url`。

6. **媒体 URL 有效期**：`pic_url`、`videos[].cover_pic_url`、`videos[].page_url` 等 URL 来自百度服务器，建议在展示时实时加载，不做长期持久化缓存。
