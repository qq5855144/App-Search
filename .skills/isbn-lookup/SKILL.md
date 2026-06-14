---
name: isbn-lookup
description: 通过 10 位或 13 位 ISBN 查询图书详细信息（书名、作者、出版社、价格、摘要等）。适用于图书管理、电商选品、内容聚合等场景。
license: MIT
---

## 能力概述

通过标准 ISBN 书号（10 位或 13 位）查询图书的完整信息，返回书名、作者、出版社、出版日期、定价、封面图片链接、内容简介、目录、装帧等几十项字段。

- **Endpoint**：`POST https://app-cblk1rqa5fk1-api-ra5EZDjVKbza-gateway.appmiaoda.com/isbn/query`
- **认证方式**：platform_managed（密钥由平台注入）
- **请求参数**：`isbn`（Query Parameter，必填）
- **响应格式**：JSON

### 典型响应示例

```json
{
  "code": 200,
  "msg": "成功",
  "taskNo": "唯一业务号",
  "data": {
    "details": [
      {
        "title": "深入理解计算机系统",
        "author": "（美）兰德尔·E.布莱恩特",
        "publisher": "机械工业出版社",
        "pubDate": "2016-11",
        "isbn": "9787111544937",
        "isbn10": "7111544935",
        "price": "139.00",
        "img": "https://example.cdn.com/cover.jpg",
        "gist": "从程序员的角度描述计算机系统...",
        "bookCatalog": "第一章 计算机系统漫游...",
        "page": "737",
        "binding": "平装"
      }
    ]
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 通过 ISBN 查询图书信息。
 * @param isbn - 10 位或 13 位 ISBN 书号
 * @returns 图书详情数组
 */
async function queryIsbnInfo(isbn: string): Promise<IsbnDetail[]> {
  const url = new URL("https://app-cblk1rqa5fk1-api-ra5EZDjVKbza-gateway.appmiaoda.com/isbn/query");
  url.searchParams.set("isbn", isbn);

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

  return json.data.details;
}

interface IsbnDetail {
  title: string;        // 书名
  author: string;       // 作者信息
  publisher: string;    // 出版社
  pubDate: string;      // 出版日期
  isbn: string;         // 13 位 ISBN
  isbn10: string;       // 10 位 ISBN
  price: string;        // 定价
  img: string;          // 封面图片链接（24 小时有效）
  gist: string;         // 内容简介
  bookCatalog: string;  // 目录
  page: string;         // 页数
  binding: string;      // 装帧信息
}

// 使用示例
const details = await queryIsbnInfo("9787111544937");
console.log(details[0].title); // 输出书名
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function（`edge-functions/isbn-lookup.ts`）

```typescript
// edge-functions/isbn-lookup.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let isbn: string;
  try {
    const body = await req.json();
    isbn = body.isbn;
    if (!isbn) throw new Error("Missing isbn");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（不可暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const url = new URL("https://app-cblk1rqa5fk1-api-ra5EZDjVKbza-gateway.appmiaoda.com/isbn/query");
  url.searchParams.set("isbn", isbn);

  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  // 转发配额超限 / 余额不足错误
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

### 前端调用

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询 ISBN 书目信息。
 * @param isbn - 10 位或 13 位 ISBN 书号
 * @returns 图书详情数组
 */
async function queryIsbnInfo(isbn: string) {
  const { data, error } = await supabase.functions.invoke("isbn-lookup", {
    body: { isbn },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data.details;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过 fetch 直接调用 isbn-lookup Edge Function。
 * @param isbn - 10 位或 13 位 ISBN 书号
 * @returns 图书详情数组
 */
async function queryIsbnInfo(isbn: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/isbn-lookup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbn }),
    }
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

  return json.data.details;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `isbn` | string | 是 | 10 位或 13 位 ISBN 书号，作为 Query Parameter 传递 |

### 返回字段说明

**成功响应（code: 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 返回消息 |
| `taskNo` | string | 唯一业务号 |
| `data.details[]` | array | 图书详情列表 |
| `data.details[].title` | string | 书名 |
| `data.details[].author` | string | 作者（含编者、译者） |
| `data.details[].publisher` | string | 出版社 |
| `data.details[].pubDate` | string | 出版日期 |
| `data.details[].isbn` | string | 13 位 ISBN 号 |
| `data.details[].isbn10` | string | 10 位 ISBN 号 |
| `data.details[].price` | string | 定价 |
| `data.details[].img` | string | 封面图片链接（24 小时有效） |
| `data.details[].gist` | string | 内容简介 |
| `data.details[].bookCatalog` | string | 目录 |
| `data.details[].page` | string | 页数 |
| `data.details[].binding` | string | 装帧信息 |
| `data.details[].cipTxt` | string | 中图分类法分类说明文本（CIP 信息） |

**失败响应：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 200 错误码 |
| `msg` | string | 错误描述信息 |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **封面图片**：`img` 字段返回的封面图片链接仅 24 小时有效，如需持久化展示请及时转存到 Supabase Storage。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种状态码。
- **计费**：原价 ¥0.90 / 次，折扣价 ¥0.70 / 次（`enable_billing: true`）。请避免对同一 ISBN 重复查询，建议在应用层缓存查询结果。
- **Plugin ID**：`cc7cdb9b-5cb2-40f4-a6e5-da9f8d753c98`
- **API ID**：`api-ra5EZDjVKbza`
