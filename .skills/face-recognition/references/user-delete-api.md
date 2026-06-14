# 删除用户接口（user-delete）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `faf0f771-1a33-47a4-a111-c128e647a25e` |
| API ID | `api-ELbWz8OmewKY` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-ELbWz8OmewKY-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/delete` |
| Auth 模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-ELbWz8OmewKY-gateway.appmiaoda.com` |
| 计费 | 否 |

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `user_id` | string | 是 | 用户 ID（由数字、字母、下划线组成），长度限制 48B |

## 响应字段表

### 成功响应（error_code: 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 错误码，0 表示成功 |
| `error_msg` | string | 错误描述信息，成功时为空字符串 |
| `log_id` | number | 请求唯一标识码 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 非 0 的错误码，例如 223103 表示用户不存在 |
| `error_msg` | string | 错误描述信息，例如 "user is not exist" |
| `log_id` | number | 请求唯一标识码 |

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 将指定用户从人脸库中删除。
 * @param userId - 用户 ID，由数字、字母、下划线组成，长度限制 48B
 * @returns 操作结果，含 error_code 和 log_id
 */
async function deleteFaceUser(userId: string): Promise<{ error_code: number; error_msg: string; log_id: number }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ELbWz8OmewKY-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/delete",
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

  return json;
}
```

## Edge Function 代码

```typescript
// edge-functions/face-user-delete.ts
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
    "https://app-cblk1rqa5fk1-api-ELbWz8OmewKY-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/delete",
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
 * 调用删除用户 Edge Function，将指定用户从人脸库中删除。
 * @param userId - 用户 ID
 * @returns 操作结果
 */
async function deleteFaceUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("face-user-delete", {
    body: { user_id: userId },
  });
  if (error) throw error;
  if (data.error_code !== 0) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：本接口不计费，可正常频率调用。
- **不可逆操作**：删除用户后，该用户的所有人脸数据将从库中移除，操作不可撤销，请谨慎调用。
- **用户不存在**：当 `user_id` 不存在时，返回 `error_code: 223103`，`error_msg: "user is not exist"`。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误。
