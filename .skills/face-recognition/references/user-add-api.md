# 人脸注册接口（user-add）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `faf0f771-1a33-47a4-a111-c128e647a25e` |
| API ID | `api-l9nZz8ro7Bl9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-l9nZz8ro7Bl9-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/add` |
| Auth 模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-l9nZz8ro7Bl9-gateway.appmiaoda.com` |
| 计费 | 是，原价 ¥0.20/次，折扣价 ¥0.15/次 |

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | string | 是 | 图片信息，总数据大小应小于 10M |
| `image_type` | string | 是 | 图片类型：`BASE64` 或 `FACE_TOKEN` |
| `user_id` | string | 是 | 用户 ID，长度限制 48B |
| `user_info` | string | 否 | 用户资料，长度限制 256B |
| `quality_control` | string | 否 | 图片质量控制：`NONE` / `LOW` / `NORMAL` / `HIGH` |
| `liveness_control` | string | 否 | 活体检测控制：`NONE` / `LOW` / `NORMAL` / `HIGH` |
| `action_type` | string | 否 | 操作方式：`APPEND`（追加）/ `REPLACE`（替换） |

## 响应字段表

### 成功响应（error_code: 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `result.face_token` | string | 人脸图片的唯一标识 |
| `result.location.top` | number | 人脸区域顶部坐标 |
| `result.location.left` | number | 人脸区域左侧坐标 |
| `result.location.rotation` | number | 人脸旋转角度 |
| `result.location.width` | number | 人脸区域宽度 |
| `result.location.height` | number | 人脸区域高度 |
| `log_id` | number | 请求唯一标识码 |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `error_code` | number | 错误码，非 0 表示失败 |
| `error_msg` | string | 错误描述信息 |
| `log_id` | number | 请求唯一标识码 |

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 注册用户人脸信息到指定用户组。
 * @param image - 图片信息（BASE64 编码内容或 FACE_TOKEN）
 * @param imageType - 图片类型，"BASE64" 或 "FACE_TOKEN"
 * @param userId - 用户 ID，长度限制 48B
 * @param options - 可选参数
 * @returns 包含 face_token 和人脸位置信息的对象
 */
async function registerFace(
  image: string,
  imageType: "BASE64" | "FACE_TOKEN",
  userId: string,
  options?: {
    userInfo?: string;
    qualityControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    livenessControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    actionType?: "APPEND" | "REPLACE";
  }
): Promise<{
  face_token: string;
  location: { top: number; left: number; rotation: number; width: number; height: number };
}> {
  const body: Record<string, string> = {
    image,
    image_type: imageType,
    user_id: userId,
  };
  if (options?.userInfo) body.user_info = options.userInfo;
  if (options?.qualityControl) body.quality_control = options.qualityControl;
  if (options?.livenessControl) body.liveness_control = options.livenessControl;
  if (options?.actionType) body.action_type = options.actionType;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-l9nZz8ro7Bl9-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/add",
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
// edge-functions/face-user-add.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let image: string;
  let image_type: string;
  let user_id: string;
  let user_info: string | undefined;
  let quality_control: string | undefined;
  let liveness_control: string | undefined;
  let action_type: string | undefined;

  try {
    const body = await req.json();
    image = body.image;
    image_type = body.image_type;
    user_id = body.user_id;
    if (!image) throw new Error("Missing image");
    if (!image_type) throw new Error("Missing image_type");
    if (!user_id) throw new Error("Missing user_id");
    user_info = body.user_info;
    quality_control = body.quality_control;
    liveness_control = body.liveness_control;
    action_type = body.action_type;
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

  const requestBody: Record<string, string> = { image, image_type, user_id };
  if (user_info) requestBody.user_info = user_info;
  if (quality_control) requestBody.quality_control = quality_control;
  if (liveness_control) requestBody.liveness_control = liveness_control;
  if (action_type) requestBody.action_type = action_type;

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-l9nZz8ro7Bl9-gateway.appmiaoda.com/rest/2.0/face/v3/faceset/user/add",
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
 * 调用人脸注册 Edge Function。
 * @param image - 图片信息（BASE64 内容或 FACE_TOKEN）
 * @param imageType - 图片类型
 * @param userId - 用户 ID
 * @param options - 可选参数
 * @returns 注册结果，含 face_token 和位置信息
 */
async function registerFace(
  image: string,
  imageType: "BASE64" | "FACE_TOKEN",
  userId: string,
  options?: {
    userInfo?: string;
    qualityControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    livenessControl?: "NONE" | "LOW" | "NORMAL" | "HIGH";
    actionType?: "APPEND" | "REPLACE";
  }
) {
  const { data, error } = await supabase.functions.invoke("face-user-add", {
    body: {
      image,
      image_type: imageType,
      user_id: userId,
      ...(options?.userInfo ? { user_info: options.userInfo } : {}),
      ...(options?.qualityControl ? { quality_control: options.qualityControl } : {}),
      ...(options?.livenessControl ? { liveness_control: options.livenessControl } : {}),
      ...(options?.actionType ? { action_type: options.actionType } : {}),
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
- **图片大小**：总数据大小应小于 10M；BASE64 图片分辨率建议不超过 1920×1080。
- **FACE_TOKEN 有效期**：face_token 有效期为 60 分钟，过期需重新获取。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误。
