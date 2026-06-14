# 人脸搜索接口（face-search）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `faf0f771-1a33-47a4-a111-c128e647a25e` |
| API ID | `api-e94GZ5j0PwVa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-e94GZ5j0PwVa-gateway.appmiaoda.com/rest/2.0/face/v3/search` |
| Auth 模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-e94GZ5j0PwVa-gateway.appmiaoda.com` |
| 计费 | 是，原价 ¥0.20/次，折扣价 ¥0.15/次 |

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 是 | 图片信息，base64 编码内容或 FACE_TOKEN |
| `image_type` | string | 是 | 图片类型：`BASE64` 或 `FACE_TOKEN` |
| `group_id_list` | string | 是 | 人脸库 ID 列表，多个用逗号分隔，如 `"group1,group2"` |
| `quality_control` | string | 否 | 图片质量控制：`NONE` / `LOW` / `NORMAL` / `HIGH` |
| `liveness_control` | string | 否 | 活体检测控制：`NONE` / `LOW` / `NORMAL` / `HIGH` |
| `user_id` | string | 否 | 指定用户 ID 进行比对 |
| `max_user_num` | integer | 否 | 返回用户数量，默认 1，最多 50 |
| `match_threshold` | integer | 否 | 匹配阈值，推荐 80 分 |

## 响应字段表

### 成功响应（error_code: 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `result.face_token` | string | 被搜索人脸的唯一标识 |
| `result.user_list` | array | 匹配用户列表 |
| `result.user_list[].group_id` | string | 用户所在组 ID |
| `result.user_list[].user_id` | string | 匹配到的用户 ID |
| `result.user_list[].user_info` | string | 用户资料信息 |
| `result.user_list[].score` | number | 相似度得分（0–100） |
| `log_id` | number | 请求唯一标识码 |
| `error_code` | number | 错误码，0 表示成功 |
| `error_msg` | string | 错误描述，成功时为 "SUCCESS" |

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
 * 在人脸库中搜索与目标图片最相似的人脸。
 * @param image - 图片信息（BASE64 编码内容或 FACE_TOKEN）
 * @param imageType - 图片类型，"BASE64" 或 "FACE_TOKEN"
 * @param options - 可选参数
 * @returns 包含 face_token 和匹配用户列表的对象
 */
async function searchFace(
  image: string,
  imageType: "BASE64" | "FACE_TOKEN",
  options?: {
    qualityControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    livenessControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    userId?: string;
    maxUserNum?: number;
    matchThreshold?: number;
  }
): Promise<{
  face_token: string;
  user_list: Array<{ group_id: string; user_id: string; user_info: string; score: number }>;
}> {
  const body: Record<string, string | number> = {
    image,
    image_type: imageType,
  };
  if (options?.qualityControl) body.quality_control = options.qualityControl;
  if (options?.livenessControl) body.liveness_control = options.livenessControl;
  if (options?.userId) body.user_id = options.userId;
  if (options?.maxUserNum !== undefined) body.max_user_num = options.maxUserNum;
  if (options?.matchThreshold !== undefined) body.match_threshold = options.matchThreshold;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-e94GZ5j0PwVa-gateway.appmiaoda.com/rest/2.0/face/v3/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
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
// edge-functions/face-search.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let image: string;
  let image_type: string;
  let quality_control: string | undefined;
  let liveness_control: string | undefined;
  let user_id: string | undefined;
  let max_user_num: number | undefined;
  let match_threshold: number | undefined;

  try {
    const body = await req.json();
    image = body.image;
    image_type = body.image_type;
    if (!image) throw new Error("Missing image");
    if (!image_type) throw new Error("Missing image_type");
    quality_control = body.quality_control;
    liveness_control = body.liveness_control;
    user_id = body.user_id;
    max_user_num = body.max_user_num;
    match_threshold = body.match_threshold;
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

  const requestBody: Record<string, string | number> = { image, image_type };
  if (quality_control) requestBody.quality_control = quality_control;
  if (liveness_control) requestBody.liveness_control = liveness_control;
  if (user_id) requestBody.user_id = user_id;
  if (max_user_num !== undefined) requestBody.max_user_num = max_user_num;
  if (match_threshold !== undefined) requestBody.match_threshold = match_threshold;

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-e94GZ5j0PwVa-gateway.appmiaoda.com/rest/2.0/face/v3/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
 * 调用人脸搜索 Edge Function，在人脸库中查找最相似的人脸。
 * @param image - 图片信息（BASE64 内容或 FACE_TOKEN）
 * @param imageType - 图片类型
 * @param options - 可选参数
 * @returns 搜索结果，含 face_token 和匹配用户列表
 */
async function searchFace(
  image: string,
  imageType: "BASE64" | "FACE_TOKEN",
  options?: {
    qualityControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    livenessControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    userId?: string;
    maxUserNum?: number;
    matchThreshold?: number;
  }
) {
  const { data, error } = await supabase.functions.invoke("face-search", {
    body: {
      image,
      image_type: imageType,
      ...(options?.qualityControl ? { quality_control: options.qualityControl } : {}),
      ...(options?.livenessControl ? { liveness_control: options.livenessControl } : {}),
      ...(options?.userId ? { user_id: options.userId } : {}),
      ...(options?.maxUserNum !== undefined ? { max_user_num: options.maxUserNum } : {}),
      ...(options?.matchThreshold !== undefined ? { match_threshold: options.matchThreshold } : {}),
    },
  });
  if (error) throw error;
  if (data.error_code !== 0) throw new Error(`API 错误 ${data.error_code}：${data.error_msg}`);
  return data.result;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：本接口启用计费，原价 ¥0.20/次，折扣价 ¥0.15/次，请避免不必要的重复调用。
- **图片限制**：base64 编码后不超过 2M，分辨率小于 1920×1080。
- **匹配阈值**：推荐设置为 80 分，低于此分数视为不匹配。
- **FACE_TOKEN 有效期**：face_token 有效期为 60 分钟。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误。
