# 用户信息查询接口（user-get）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `faf0f771-1a33-47a4-a111-c128e647a25e` |
| API ID | `api-GaDwZ0j38X6Y` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-GaDwZ0j38X6Y-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/get` |
| Auth 模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-GaDwZ0j38X6Y-gateway.appmiaoda.com` |
| 计费 | 否 |

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `user_id` | string | 是 | 用户 ID（由数字、字母、下划线组成），长度限制 48B |

## 响应字段表

### 成功响应（error_code: 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `result.user_list` | array | 用户所在组列表 |
| `result.user_list[].user_info` | string | 用户资料信息 |
| `result.user_list[].group_id` | string | 用户所在组 ID |
| `log_id` | number | 请求唯一标识码 |
| `error_code` | number | 错误码，0 表示成功 |
| `error_msg` | string | 错误描述，成功时为 "SUCCESS" |
| `cached` | number | 是否命中缓存（0：未命中，1：命中） |
| `timestamp` | number | 响应时间戳 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 非 0 的错误码 |
| `error_msg` | string | 错误描述信息 |
| `log_id` | number | 请求唯一标识码 |

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 查询人脸库中指定用户的信息，包括用户资料和所属组列表。
 * @param userId - 用户 ID，由数字、字母、下划线组成，长度限制 48B
 * @returns 包含用户所在各组信息的列表
 */
async function getFaceUser(userId: string): Promise<{
  user_list: Array<{ user_info: string; group_id: string }>;
}> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-GaDwZ0j38X6Y-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/get",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ user_id: userId }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.error_code !== 0) throw new Error(`API error ${json.error_code}: ${json.error_msg}`);

  return json.result;
}
```

## Edge Function 代码

```typescript
// edge-functions/face-user-get.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let user_id: string;
  try {
    const body = await req.json();
    user_id = body.user_id;
    if (!user_id) throw new Error("Missing user_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-GaDwZ0j38X6Y-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/get",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ user_id }),
    }
  );

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

### Web / MiniProgram（通用）

```typescript
/**
 * 调用用户信息查询 Edge Function，获取指定用户的人脸库信息。
 * @param userId - 用户 ID
 * @returns 用户所在各组的信息列表
 */
async function getFaceUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("face-user-get", {
    body: { user_id: userId },
  });
  if (error) throw error;
  if (data.error_code !== 0) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data.result;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：本接口不计费，可正常频率调用。
- **用户 ID 格式**：仅允许数字、字母、下划线组成，长度不超过 48B。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误。
