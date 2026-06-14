# 彩票分类 API

## 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `126915de-23d7-454c-accf-b88797feb9e5` |
| API ID | `api-BYdwQyx58E6L` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-BYdwQyx58E6L-gateway.appmiaoda.com/caipiao/class` |
| Auth | `platform_managed`，`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party Domain | `app-cblk1rqa5fk1-api-BYdwQyx58E6L-gateway.appmiaoda.com` |

## 请求参数

无需参数。

## 响应字段

### 成功响应（status=0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 状态码，0 表示成功 |
| `msg` | string | 返回消息，成功时为 "ok" |
| `result[]` | array | 彩票分类列表（树形结构，通过 parentid 关联） |
| `result[].caipiaoid` | string | 彩票ID，作为其他接口的 `caipiaoid` 参数使用 |
| `result[].name` | string | 彩票名称 |
| `result[].parentid` | string | 父级分类ID，顶层分类为 "0" |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | number | 非 0 时表示错误 |
| `msg` | string | 错误描述信息 |

## 响应示例

```json
{
  "status": 0,
  "msg": "ok",
  "result": [
    { "caipiaoid": "1", "name": "福利彩票", "parentid": "0" },
    { "caipiaoid": "2", "name": "体育彩票", "parentid": "0" },
    { "caipiaoid": "11", "name": "双色球", "parentid": "1" },
    { "caipiaoid": "12", "name": "福彩3D", "parentid": "1" },
    { "caipiaoid": "13", "name": "七乐彩", "parentid": "1" }
  ]
}
```

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface CaipiaoClassItem {
  caipiaoid: string;
  name: string;
  parentid: string;
}

/**
 * 获取所有彩票分类信息，返回含父级关系的树形结构列表。
 * @returns 彩票分类列表
 */
async function queryCaipiaoClass(): Promise<CaipiaoClassItem[]> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-BYdwQyx58E6L-gateway.appmiaoda.com/caipiao/class",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.msg}`);

  return json.result;
}

// 使用示例：获取所有彩票分类，并打印顶层分类名称
const classes = await queryCaipiaoClass();
const topLevel = classes.filter((item) => item.parentid === "0");
console.log("顶层彩票分类：", topLevel.map((item) => item.name));
// 输出示例：顶层彩票分类：["福利彩票", "体育彩票"]
```

## Edge Function 代码

```typescript
// edge-functions/caipiao-class.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 注入平台密钥（不可暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API（无需请求参数）---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-BYdwQyx58E6L-gateway.appmiaoda.com/caipiao/class",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  // 原样转发配额/余额错误
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

## 前端调用代码

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 获取所有彩票分类。
 * @returns 彩票分类列表
 */
async function queryCaipiaoClass() {
  const { data, error } = await supabase.functions.invoke("caipiao-class", {
    body: {},
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过 Edge Function 获取所有彩票分类（备用方式）。
 * @returns 彩票分类列表
 */
async function queryCaipiaoClass() {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/caipiao-class`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}：${json.msg}`);
  return json.result;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：每次调用折扣价 ¥0.09（原价 ¥0.20）。分类数据变化频率低，建议前端缓存结果，避免重复调用。
- **树形结构**：`parentid` 为 `"0"` 的是顶层分类（如福利彩票、体育彩票），其他条目通过 `parentid` 关联到父级。`caipiaoid` 可直接用作彩票开奖、历史开奖等接口的 `caipiaoid` 参数。
