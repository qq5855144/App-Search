# 企业专利列表查询 API

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `44da466e-06ce-4108-9d8d-cb377240179c` |
| API ID | `api-79jKP8yo70AL` |
| Endpoint | `https://app-cblk1rqa5fk1-api-79jKP8yo70AL-gateway.appmiaoda.com/enterprise/patent/list` |
| HTTP Method | POST |
| Content-Type | `application/json;charset=UTF-8` |
| Auth 模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| third_part_domain | `app-cblk1rqa5fk1-api-79jKP8yo70AL-gateway.appmiaoda.com` |
| 计费 | 启用，折后价 ¥4.00 / 原价 ¥4.80（每次调用计费） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `keyword` | string | 是 | — | 公司名、注册号或社会统一信用代码 |
| `pageNo` | string | 否 | `"1"` | 页码，从 1 开始 |
| `pageSize` | string | 否 | `"10"` | 每页记录数，最大 10 |

---

## 响应字段表

### 成功响应（code=200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 返回消息 |
| `taskNo` | string | 本次请求号 |
| `data.page.pageNo` | number | 当前页号，从 1 开始 |
| `data.page.pageSize` | number | 每页记录数 |
| `data.page.recordCount` | number | 记录总数 |
| `data.items[].Id` | number | 专利 ID |
| `data.items[].Title` | string | 专利标题 |
| `data.items[].AssigneestringList` | string | 申请企业 |
| `data.items[].InventorStringList` | string | 发明人（多个用 `;` 分隔） |
| `data.items[].ApplicationNumber` | string | 申请号 |
| `data.items[].ApplicationDate` | string | 申请日期 |
| `data.items[].PublicationNumber` | string | 公开（公告）号 |
| `data.items[].PublicationDate` | string | 公开（公告）日 |
| `data.items[].IPCList` | string | 国际专利分类号 |
| `data.items[].IPCDesc` | string | 国际专利分类详情 |
| `data.items[].LegalStatusDesc` | string | 法律状态（如"授权"、"公布"） |
| `data.items[].KindCodeDesc` | string | 类型名称（发明、实用新型、外观设计等） |
| `data.items[].Agency` | string | 专利代理机构 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码（见下表） |
| `msg` | string | 错误描述 |

| code | message | 描述 |
|------|---------|------|
| 400 | 参数错误 | 参数错误（如 keyword 为空） |
| 500 | 服务商维护，请稍候再试 | 服务商维护 |
| 501 | 官方数据源维护，请稍候再试 | 官方数据源维护 |
| 701 | 查询无结果 | 查询无结果 |
| 999 | 其他，以实际返回为准 | 其他错误 |

---

## 生成期代码

Agent 在生成应用代码时，可直接在 Deno 脚本中调用以下代码进行数据查询：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface PatentListItem {
  Id: number;
  Title: string;
  AssigneestringList: string;
  InventorStringList: string;
  ApplicationNumber: string;
  ApplicationDate: string;
  PublicationNumber: string;
  PublicationDate: string;
  IPCList: string;
  IPCDesc: string;
  LegalStatusDesc: string;
  KindCodeDesc: string;
  Agency: string;
}

interface PatentListResponse {
  page: { pageNo: number; pageSize: number; recordCount: number };
  items: PatentListItem[];
}

/**
 * 查询企业专利申请列表。
 * @param keyword - 公司名、注册号或社会统一信用代码（必填）
 * @param pageNo - 页码，从 1 开始，默认 "1"
 * @param pageSize - 每页记录数，默认 "10"，最大 10
 * @returns 分页专利列表数据
 */
async function fetchPatentList(
  keyword: string,
  pageNo = "1",
  pageSize = "10",
): Promise<PatentListResponse> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-79jKP8yo70AL-gateway.appmiaoda.com/enterprise/patent/list",
  );
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("pageNo", pageNo);
  url.searchParams.set("pageSize", pageSize);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as PatentListResponse;
}
```

---

## Edge Function 代码

部署到 Supabase Edge Functions（文件名：`enterprise-patent-list.ts`）：

```typescript
// edge-functions/enterprise-patent-list.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let keyword: string;
  let pageNo: string;
  let pageSize: string;
  try {
    const body = await req.json();
    keyword = body.keyword;
    if (!keyword) throw new Error("Missing keyword");
    pageNo = body.pageNo ?? "1";
    pageSize = body.pageSize ?? "10";
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

  // --- 调用上游 API ---
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-79jKP8yo70AL-gateway.appmiaoda.com/enterprise/patent/list",
  );
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("pageNo", pageNo);
  url.searchParams.set("pageSize", pageSize);

  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  // 透传配额/余额错误
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

### 推荐方式（supabase client 可用时）

```typescript
interface PatentListParams {
  keyword: string;
  pageNo?: string;
  pageSize?: string;
}

/**
 * 通过 Edge Function 查询企业专利列表。
 * @param params - 查询参数，keyword 为必填
 * @returns 专利列表分页数据
 */
async function fetchPatentList(params: PatentListParams) {
  const { data, error } = await supabase.functions.invoke("enterprise-patent-list", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

### 备用方式（无法使用 supabase client 时）

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 查询企业专利列表。
 * @param params - 查询参数，keyword 为必填
 * @returns 专利列表分页数据
 */
async function fetchPatentList(params: PatentListParams) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enterprise-patent-list`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.data;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端或写入客户端代码。
- **计费**：此接口启用计费，折后价 ¥4.00 / 次（原价 ¥4.80），请避免不必要的重复调用。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），并将错误信息透明传递给用户。
- **分页**：`pageSize` 最大为 10，若需遍历全量数据请循环翻页，注意控制调用次数以节约费用。
- **keyword 为空**：上游会返回 `code: 400, msg: "关键字不能为空"`，需在前端提前校验。
