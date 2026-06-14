# 百度搜索接口 API

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `4652710b-8d55-409c-ab21-90c1888ee2b0` |
| API ID | `api-rY7JZ6jqr6dL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-rY7JZ6jqr6dL-gateway.appmiaoda.com/v2/ai_search/chat/completions` |
| Content-Type | `application/json` |
| 认证模式 | `platform_managed`（`X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>`） |
| third_part_domain | `app-cblk1rqa5fk1-api-rY7JZ6jqr6dL-gateway.appmiaoda.com` |
| 计费 | 计费信息以平台实际配置为准 |

---

## 请求参数表

### 顶层参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `messages` | array | 是 | 搜索输入，以 user 角色开始和结束，不能为空 |
| `resource_type_filter` | array | 否 | 搜索资源类型配置，指定返回 web 或 video 结果 |
| `search_recency_filter` | string | 否 | 时间筛选，可选值：`week` / `month` / `semiyear` / `year` |

### `messages[]` 子字段

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `role` | string | 是 | `user` 或 `assistant` |
| `content` | string | 是 | 对话内容，不能为空 |

### `resource_type_filter[]` 子字段

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `type` | string | 是 | 资源类型：`web` 或 `video` |
| `top_k` | integer | 否 | 最大返回数量（web 最大 50，video 最大 10） |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `references` | array | 搜索结果引用列表 |
| `references[].id` | number | 引用编号 |
| `references[].title` | string | 网页/视频标题 |
| `references[].type` | string | 资源类型：`web` 或 `video` |
| `references[].url` | string | 来源 URL |
| `references[].content` | string | 网站内容摘要 |
| `references[].date` | string | 发布或抓取时间，格式 `YYYY-MM-DD HH:mm:ss` |
| `references[].web_anchor` | string | 锚文本（可选） |

### 错误响应

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误（如 messages 为空） |
| 402 | 账户余额不足 |
| 429 | 调用配额超限 |
| 500 | 上游服务内部错误 |

---

## 生成期代码

在 Deno / TypeScript 脚本中直接调用，适合 Agent 在生成期获取搜索结果。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface SearchMessage {
  role: "user" | "assistant";
  content: string;
}

interface ResourceTypeFilter {
  type: "web" | "video";
  top_k?: number;
}

interface SearchReference {
  id: number;
  title: string;
  type: "web" | "video";
  url: string;
  content: string;
  date: string;
  web_anchor?: string;
}

interface SearchResult {
  references: SearchReference[];
}

/**
 * 调用百度千帆 AI 搜索接口，检索全网实时信息。
 * @param messages - 对话消息列表，以 user 角色开始和结束
 * @param resourceTypeFilter - 可选，搜索资源类型配置
 * @param searchRecencyFilter - 可选，时间筛选（week/month/semiyear/year）
 * @returns 搜索引用列表
 */
async function callBaiduSearch(
  messages: SearchMessage[],
  resourceTypeFilter?: ResourceTypeFilter[],
  searchRecencyFilter?: "week" | "month" | "semiyear" | "year",
): Promise<SearchResult> {
  const requestBody: Record<string, unknown> = { messages };
  if (resourceTypeFilter && resourceTypeFilter.length > 0) {
    requestBody.resource_type_filter = resourceTypeFilter;
  }
  if (searchRecencyFilter) {
    requestBody.search_recency_filter = searchRecencyFilter;
  }

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-rY7JZ6jqr6dL-gateway.appmiaoda.com/v2/ai_search/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = await response.json();
  return json as SearchResult;
}

// 使用示例：查询实时天气信息
const result = await callBaiduSearch([
  { role: "user", content: "河北各个城市最近的天气" },
]);
console.log(JSON.stringify(result.references, null, 2));

// 使用示例：仅搜索网页，限制最近一周
const webResult = await callBaiduSearch(
  [{ role: "user", content: "最新 AI 新闻" }],
  [{ type: "web", top_k: 10 }],
  "week",
);
console.log(webResult.references.map((r) => r.title));
```

---

## Edge Function 代码

Web 和 MiniProgram 共用同一套 Edge Function，响应均为 JSON，无二进制流处理差异。

```typescript
// edge-functions/baidu-search.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let messages: Array<{ role: string; content: string }>;
  let resourceTypeFilter: Array<{ type: string; top_k?: number }> | undefined;
  let searchRecencyFilter: string | undefined;

  try {
    const body = await req.json();
    messages = body.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Missing or invalid messages");
    }
    resourceTypeFilter = body.resource_type_filter;
    searchRecencyFilter = body.search_recency_filter;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构造上游请求体 ---
  const upstreamBody: Record<string, unknown> = { messages };
  if (resourceTypeFilter && resourceTypeFilter.length > 0) {
    upstreamBody.resource_type_filter = resourceTypeFilter;
  }
  if (searchRecencyFilter) {
    upstreamBody.search_recency_filter = searchRecencyFilter;
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-rY7JZ6jqr6dL-gateway.appmiaoda.com/v2/ai_search/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    },
  );

  // 原样转发配额超限和余额不足错误
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
      { status: 502, headers: { "Content-Type": "application/json" } },
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

### Web 平台（React / TypeScript）

**推荐方式（supabase client 可用时）：**

```typescript
interface SearchMessage {
  role: "user" | "assistant";
  content: string;
}

interface ResourceTypeFilter {
  type: "web" | "video";
  top_k?: number;
}

interface SearchReference {
  id: number;
  title: string;
  type: "web" | "video";
  url: string;
  content: string;
  date: string;
  web_anchor?: string;
}

/**
 * 通过 Edge Function 调用百度搜索接口。
 * @param messages - 对话消息列表
 * @param resourceTypeFilter - 可选，搜索资源类型配置
 * @param searchRecencyFilter - 可选，时间筛选
 * @returns 搜索引用列表
 */
async function fetchBaiduSearch(
  messages: SearchMessage[],
  resourceTypeFilter?: ResourceTypeFilter[],
  searchRecencyFilter?: "week" | "month" | "semiyear" | "year",
): Promise<SearchReference[]> {
  const { data, error } = await supabase.functions.invoke("baidu-search", {
    body: {
      messages,
      ...(resourceTypeFilter ? { resource_type_filter: resourceTypeFilter } : {}),
      ...(searchRecencyFilter ? { search_recency_filter: searchRecencyFilter } : {}),
    },
  });
  if (error) throw error;
  return (data as { references: SearchReference[] }).references;
}

// 使用示例
const references = await fetchBaiduSearch([
  { role: "user", content: "最新 AI 新闻" },
]);
console.log(references);
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchBaiduSearch(
  messages: SearchMessage[],
  resourceTypeFilter?: ResourceTypeFilter[],
  searchRecencyFilter?: "week" | "month" | "semiyear" | "year",
): Promise<SearchReference[]> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        ...(resourceTypeFilter ? { resource_type_filter: resourceTypeFilter } : {}),
        ...(searchRecencyFilter ? { search_recency_filter: searchRecencyFilter } : {}),
      }),
    },
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
  return (json as { references: SearchReference[] }).references;
}
```

### MiniProgram 平台（Taro / React）

MiniProgram 使用 `supabase.functions.invoke` 方式，调用接口与 Web 相同：

```typescript
/**
 * 在 MiniProgram 中通过 Edge Function 调用百度搜索接口。
 * @param messages - 对话消息列表
 * @param resourceTypeFilter - 可选，搜索资源类型配置
 * @param searchRecencyFilter - 可选，时间筛选
 * @returns 搜索引用列表
 */
async function fetchBaiduSearch(
  messages: SearchMessage[],
  resourceTypeFilter?: ResourceTypeFilter[],
  searchRecencyFilter?: "week" | "month" | "semiyear" | "year",
): Promise<SearchReference[]> {
  const { data, error } = await supabase.functions.invoke("baidu-search", {
    body: {
      messages,
      ...(resourceTypeFilter ? { resource_type_filter: resourceTypeFilter } : {}),
      ...(searchRecencyFilter ? { search_recency_filter: searchRecencyFilter } : {}),
    },
  });
  if (error) throw error;
  return (data as { references: SearchReference[] }).references;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误，并向用户展示明确提示。
- **计费**：计费信息以平台实际配置为准，避免在循环或轮询逻辑中触发不必要的重复调用。
- **messages 约束**：`messages` 数组必须以 `user` 角色开始和结束，`content` 不可为空字符串。
- **resource_type_filter 上限**：`web` 类型 `top_k` 最大 50，`video` 类型 `top_k` 最大 10，超出将被服务端截断。
- **search_recency_filter**：仅支持 `week`、`month`、`semiyear`、`year` 四个固定值，传入其他值将导致参数错误。
- **数据时效性**：响应结果为实时抓取，`date` 字段可辅助判断内容新鲜度，但不保证毫秒级精度。
