# 快递公司列表获取 API

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `b955023f-4f9c-4f2b-b137-6f7b630a2ee4` |
| API ID | `api-V9gDz8wo0V5L` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-V9gDz8wo0V5L-gateway.appmiaoda.com/getExpressList` |
| Auth 模式 | `platform_managed`（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-V9gDz8wo0V5L-gateway.appmiaoda.com` |
| 计费 | 启用，原价 ¥0.30/次，折扣价 ¥0.24/次 |

---

## 请求参数表

### Query Parameters

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| type | string | 否 | `ALL`、`ZTO`、`SF` | 筛选条件：填写具体快递简码（如 `ZTO`）返回对应快递公司信息；填写 `ALL` 或不填返回所有快递公司列表 |

### 请求头

| Header | 值 | 必填 |
|--------|----|------|
| Content-Type | `application/json` | 是 |

---

## 响应字段表

### 成功响应（status: "200"）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | string | 响应状态码，`"200"` 表示请求成功 |
| `msg` | string | 响应消息，成功时固定为 `"success"` |
| `result` | object | 快递公司列表对象，key 为快递简码（大写字母），value 为快递公司名称 |

**响应示例：**

```json
{
  "status": "200",
  "msg": "success",
  "result": {
    "ZTO": "中通快递",
    "SF": "顺丰速运",
    "YD": "韵达快递",
    "JITU": "极兔速递"
  }
}
```

### 异常响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | string | 非 `"200"` 的错误状态码 |
| `msg` | string | 错误描述 |
| `result` | object | 空对象 `{}` |

**异常响应示例：**

```json
{
  "status": "400",
  "msg": "Invalid AppCode or request format",
  "result": {}
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
/**
 * 获取快递公司列表。
 * @param type - 可选。快递公司简码（如 "ZTO"）或 "ALL"；不填则返回所有快递公司。
 * @returns 快递公司列表对象，key 为简码，value 为公司名称。
 */
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

async function getExpressList(type?: string): Promise<Record<string, string>> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-V9gDz8wo0V5L-gateway.appmiaoda.com/getExpressList"
  );
  if (type) {
    url.searchParams.set("type", type);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== "200") {
    throw new Error(`API error ${json.status}: ${json.msg}`);
  }

  return json.result as Record<string, string>;
}

// 使用示例：获取所有快递公司
const allCouriers = await getExpressList("ALL");
console.log(allCouriers);

// 使用示例：查询单个快递公司
const zto = await getExpressList("ZTO");
console.log(zto);
```

---

## Edge Function 代码

两个平台（Web / MiniProgram）的 Edge Function 实现相同，因为响应为 JSON 数据，无二进制流。

```typescript
// edge-functions/get-express-list.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * 快递公司列表获取 Edge Function。
   * 接收客户端请求，注入平台密钥，转发到上游 API，返回快递公司列表。
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let type: string | undefined;
  try {
    const body = await req.json();
    type = body.type; // 可选参数
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（绝不暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-V9gDz8wo0V5L-gateway.appmiaoda.com/getExpressList"
  );
  if (type) {
    url.searchParams.set("type", type);
  }

  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

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

### Web 平台（推荐方式）

```typescript
/**
 * 调用快递公司列表 Edge Function。
 * @param type - 可选。快递简码（如 "ZTO"）或 "ALL"；不填返回全部。
 * @returns 快递公司列表对象，key 为简码，value 为公司名称。
 */
async function fetchExpressList(type?: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("get-express-list", {
    body: { type },
  });
  if (error) throw error;
  if (data.status !== "200") {
    throw new Error(`API 错误 ${data.status}：${data.msg}`);
  }
  return data.result as Record<string, string>;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 调用快递公司列表 Edge Function（MiniProgram 平台）。
 * @param type - 可选。快递简码（如 "ZTO"）或 "ALL"；不填返回全部。
 * @returns 快递公司列表对象，key 为简码，value 为公司名称。
 */
async function fetchExpressList(type?: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("get-express-list", {
    body: { type },
  });
  if (error) throw error;
  if (data.status !== "200") {
    throw new Error(`API 错误 ${data.status}：${data.msg}`);
  }
  return data.result as Record<string, string>;
}
```

### 备用方式（无法使用 supabase client 时）

```typescript
/**
 * 直接 fetch 调用快递公司列表 Edge Function（备用）。
 * @param type - 可选。快递简码或 "ALL"。
 * @returns 快递公司列表对象。
 */
async function fetchExpressList(type?: string): Promise<Record<string, string>> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-express-list`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
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
  if (json.status !== "200") {
    throw new Error(`API 错误 ${json.status}：${json.msg}`);
  }
  return json.result as Record<string, string>;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：此接口启用计费，原价 ¥0.30/次，折扣价 ¥0.24/次。建议缓存快递公司列表（该数据变动频率低），避免不必要的重复调用。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）响应。
- **参数说明**：`type` 参数不填或填 `ALL` 均可获取完整列表；若只需验证某家快递是否支持，传入对应简码即可。
