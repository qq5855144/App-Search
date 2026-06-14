# 企业专利详情查询 API

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `44da466e-06ce-4108-9d8d-cb377240179c` |
| API ID | `api-eLMlJ2jB4oj9` |
| Endpoint | `https://app-cblk1rqa5fk1-api-eLMlJ2jB4oj9-gateway.appmiaoda.com/enterprise/patent/detail` |
| HTTP Method | POST |
| Content-Type | `application/json;charset=UTF-8` |
| Auth 模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| third_part_domain | `app-cblk1rqa5fk1-api-eLMlJ2jB4oj9-gateway.appmiaoda.com` |
| 计费 | 未启用（免费接口） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | string | 是 | — | 专利 ID，可从列表接口的 `items[].Id` 获取 |

---

## 响应字段表

### 成功响应（code=200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 返回消息 |
| `taskNo` | string | 本次请求号 |
| `data.Title` | string | 专利标题 |
| `data.AssigneestringList` | string | 申请企业 |
| `data.InventorStringList` | string | 发明人 |
| `data.ApplicationNumber` | string | 申请号 |
| `data.ApplicationDate` | string | 申请日期 |
| `data.PublicationNumber` | string | 公开（公告）号 |
| `data.PublicationDate` | string | 公开（公告）日 |
| `data.LegalStatusDesc` | string | 法律状态 |
| `data.LegalStatusDate` | string | 法律状态日期 |
| `data.Agency` | string | 专利代理机构 |
| `data.Agent` | string | 代理人 |
| `data.IPCList` | string | 国际专利分类号 |
| `data.IPCDesc` | string | 国际专利分类详情 |
| `data.KindCodeDesc` | string | 类型名称（发明、实用新型、外观设计等） |
| `data.Abstract` | string | 摘要介绍 |
| `data.PatentImage` | string | 专利图片 URL |
| `data.PatentLegalHistory[]` | array | 法律状态历史记录 |
| `data.PatentLegalHistory[].LegalStatusDate` | string | 状态日期 |
| `data.PatentLegalHistory[].LegalStatus` | string | 法律状态 |
| `data.PatentLegalHistory[].Desc` | string | 描述 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码 |
| `msg` | string | 错误描述 |

---

## 生成期代码

Agent 在生成应用代码时，可直接在 Deno 脚本中调用以下代码进行数据查询：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface PatentLegalHistoryItem {
  LegalStatusDate: string;
  LegalStatus: string;
  Desc: string;
}

interface PatentDetail {
  Title: string;
  AssigneestringList: string;
  InventorStringList: string;
  ApplicationNumber: string;
  ApplicationDate: string;
  PublicationNumber: string;
  PublicationDate: string;
  LegalStatusDesc: string;
  LegalStatusDate: string;
  Agency: string;
  Agent: string;
  IPCList: string;
  IPCDesc: string;
  KindCodeDesc: string;
  Abstract: string;
  PatentImage: string;
  PatentLegalHistory: PatentLegalHistoryItem[];
}

/**
 * 查询企业专利详情。
 * @param id - 专利 ID（必填），可从列表接口 items[].Id 获取
 * @returns 专利详情数据
 */
async function fetchPatentDetail(id: string): Promise<PatentDetail> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-eLMlJ2jB4oj9-gateway.appmiaoda.com/enterprise/patent/detail",
  );
  url.searchParams.set("id", id);

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

  return json.data as PatentDetail;
}
```

---

## Edge Function 代码

部署到 Supabase Edge Functions（文件名：`enterprise-patent-detail.ts`）：

```typescript
// edge-functions/enterprise-patent-detail.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * 将远程图片 URL 转存至 Supabase Storage，返回持久化公开 URL。
 * @param mediaUrl - 第三方图片 URL
 * @param bucketName - 目标 Storage bucket 名称
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl);
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const isAllowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream";
    if (!isAllowed) throw new Error(`Unsupported content type: ${contentType}`);
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, path: data.path, publicUrl: urlData.publicUrl, contentType };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let id: string;
  try {
    const body = await req.json();
    id = body.id;
    if (!id) throw new Error("Missing id");
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
    "https://app-cblk1rqa5fk1-api-eLMlJ2jB4oj9-gateway.appmiaoda.com/enterprise/patent/detail",
  );
  url.searchParams.set("id", id);

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

  // 将 PatentImage 第三方图片 URL 转存至 Supabase Storage
  if (data?.data?.PatentImage) {
    const stored = await streamMediaToStorage(data.data.PatentImage, "patent-images");
    if (stored.success) {
      data.data.PatentImage = stored.publicUrl;
    }
    // 转存失败时保留原始 URL
  }

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
/**
 * 通过 Edge Function 查询企业专利详情。
 * @param id - 专利 ID（必填）
 * @returns 专利详情数据
 */
async function fetchPatentDetail(id: string) {
  const { data, error } = await supabase.functions.invoke("enterprise-patent-detail", {
    body: { id },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

### 备用方式（无法使用 supabase client 时）

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 查询企业专利详情。
 * @param id - 专利 ID（必填）
 * @returns 专利详情数据
 */
async function fetchPatentDetail(id: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enterprise-patent-detail`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
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
- **计费**：此接口未启用计费（免费），可按需调用，但仍建议做好缓存避免重复请求相同专利。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），并将错误信息透明传递给用户。
- **PatentImage**：响应中包含专利图片 URL，Edge Function 会自动将其转存至 Supabase Storage（bucket: `patent-images`）并替换为持久化 URL；如转存失败，则保留原始第三方链接。
- **典型用法**：先调用列表接口获取专利 ID，再调用本接口获取摘要、法律状态历史等完整信息。
