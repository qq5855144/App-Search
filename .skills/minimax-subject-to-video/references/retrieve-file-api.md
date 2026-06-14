# 获取视频文件下载链接 API — 主体参考视频生成（MiniMax）

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `17196c7a-fca2-41ec-85f3-1e303e1a3ee1` |
| API ID | `api-VaOw5V2Pbqoa` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-VaOw5V2Pbqoa-gateway.appmiaoda.com/v1/files/retrieve` |
| Auth | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| Content-Type | 无请求体 |
| third_part_domain | `app-cblk1rqa5fk1-api-VaOw5V2Pbqoa-gateway.appmiaoda.com` |
| 计费 | 否（`enable_billing: false`） |

---

## 请求参数表

### 查询参数（Query String）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `file_id` | integer (int64) | 是 | 文件的唯一标识符，来自查询任务状态接口返回的 `file_id` |

---

## 响应字段表

### 成功响应（200）

```json
{
  "file": {
    "file_id": "176844028768320",
    "bytes": 0,
    "created_at": 1700469398,
    "filename": "output_aigc.mp4",
    "purpose": "video_generation",
    "download_url": "www.downloadurl.com"
  },
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `file.file_id` | integer | 文件的唯一标识符 |
| `file.bytes` | integer | 文件大小（字节） |
| `file.created_at` | integer | 创建文件的 Unix 时间戳（秒） |
| `file.filename` | string | 文件名称 |
| `file.purpose` | string | 文件使用目的（如 `video_generation`） |
| `file.download_url` | string | 文件下载 URL，**有效期 1 小时** |
| `base_resp.status_code` | integer | 状态码（见下表） |
| `base_resp.status_msg` | string | 状态详情；成功时为 `success` |

### 状态码说明

| status_code | 含义 |
|-------------|------|
| 0 | 请求成功 |
| 1000 | 未知错误 |
| 1001 | 超时 |
| 1002 | 触发 RPM 限流 |
| 1004 | 鉴权失败 |
| 1008 | 余额不足 |
| 1013 | 服务内部错误 |
| 1026 | 输入内容错误 |
| 1027 | 输出内容错误 |
| 1039 | 触发 TPM 限流 |
| 2013 | 输入格式信息不正常 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface FileObject {
  file_id: number;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  download_url: string;
}

interface RetrieveFileResponse {
  file: FileObject;
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * 获取视频文件的详细信息和下载链接。
 *
 * @param fileId - 文件 ID（由查询任务状态接口成功后返回）
 * @returns 文件信息，含 download_url（有效期 1 小时）
 */
async function retrieveVideoFile(fileId: string): Promise<FileObject> {
  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-VaOw5V2Pbqoa-gateway.appmiaoda.com/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json: RetrieveFileResponse = await response.json();
  if (json.base_resp.status_code !== 0) {
    throw new Error(`API error ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }
  return json.file;
}

// 使用示例
const file = await retrieveVideoFile("176844028768320");
console.log("download_url:", file.download_url); // 有效期 1 小时
console.log("filename:", file.filename);
```

---

## Edge Function 代码

### Web 平台

```typescript
// edge-functions/minimax-retrieve-video-file.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let fileId: string;
  try {
    const body = await req.json();
    fileId = body.fileId;
    if (!fileId) throw new Error("Missing fileId");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-VaOw5V2Pbqoa-gateway.appmiaoda.com/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    {
      method: "GET",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

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
  if (data.base_resp?.status_code !== 0) {
    return new Response(
      JSON.stringify({
        error: `API error ${data.base_resp?.status_code}: ${data.base_resp?.status_msg}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 注意：download_url 有效期仅 1 小时，建议应用层转存到 Supabase Storage
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### MiniProgram 平台

MiniProgram 与 Web 的 Edge Function 实现相同，无需分开部署。

---

## 前端调用代码

### Web 平台（推荐 supabase client）

```typescript
interface FileInfo {
  file_id: number;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  download_url: string;
}

/**
 * 获取视频文件下载链接。
 *
 * @param fileId - 文件 ID（来自查询任务成功后的 file_id）
 * @returns 文件信息，含 download_url（有效期 1 小时）
 */
async function retrieveVideoFile(fileId: string): Promise<FileInfo> {
  const { data, error } = await supabase.functions.invoke("minimax-retrieve-video-file", {
    body: { fileId },
  });
  if (error) throw error;
  return (data as { file: FileInfo; base_resp: unknown }).file;
}

// 在 React 组件中使用下载链接播放视频
// const fileInfo = await retrieveVideoFile(fileId);
// <video src={fileInfo.download_url} controls />
```

### MiniProgram 平台（Taro + supabase client）

```typescript
/**
 * MiniProgram 获取视频文件下载链接，与 Web 调用方式相同。
 *
 * @param fileId - 文件 ID
 * @returns 文件信息，含 download_url（有效期 1 小时）
 */
async function retrieveVideoFile(
  fileId: string,
): Promise<{ download_url: string; filename: string }> {
  const { data, error } = await supabase.functions.invoke("minimax-retrieve-video-file", {
    body: { fileId },
  });
  if (error) throw error;
  return data.file;
}

// 在 Taro 组件中使用下载链接播放视频
// const fileInfo = await retrieveVideoFile(fileId);
// <Video src={fileInfo.download_url} controls />
```

---

## 注意事项

- **计费**：此接口不计费（`enable_billing: false`），可放心调用。
- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端。
- **下载链接有效期**：`download_url` 有效期仅 **1 小时**，应用获取后应立即使用或转存到 Supabase Storage（参见 api-skill-template.md Appendix A）。
- **错误处理**：务必处理 429（配额超限）、402（余额不足）和 `base_resp.status_code` 非 0 的业务错误。
- **转存建议**：若需要长期保存生成的视频，建议在 Edge Function 中调用 `streamMediaToStorage` 将 `download_url` 转存至 Supabase Storage，返回持久化的 `publicUrl`。
