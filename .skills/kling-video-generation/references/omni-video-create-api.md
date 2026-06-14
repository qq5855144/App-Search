# Omni-Video 创建任务 API

## API 基本信息

| 属性 | 值 |
|------|----|
| Plugin ID | `339870a2-4a8b-4633-a8c5-fed34600f5bf` |
| API ID | `api-oLpZb03wbNBa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-oLpZb03wbNBa-gateway.appmiaoda.com/v1/videos/omni-video` |
| Auth 模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-oLpZb03wbNBa-gateway.appmiaoda.com` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model_name` | string | 否 | `kling-video-o1` | 模型名称。可选值：`kling-video-o1`、`kling-v3-omni` |
| `multi_shot` | boolean | 否 | `false` | 是否生成多镜头视频。`true` 时 `prompt` 参数无效，且不支持首尾帧模式 |
| `shot_type` | string | 否 | — | 分镜方式。`multi_shot=true` 时必填。可选值：`customize`、`intelligence` |
| `prompt` | string | 条件必填 | — | 文本提示词，最多 2500 字符。`multi_shot=false` 或 `multi_shot=true` 且 `shot_type=intelligence` 时不得为空。支持 `<<<element_1>>>`、`<<<image_1>>>`、`<<<video_1>>>` 格式引用主体/图片/视频 |
| `multi_prompt` | array | 条件必填 | — | 各分镜信息。`multi_shot=true` 且 `shot_type=customize` 时不得为空。最多 6 个分镜。格式见下方说明 |
| `multi_prompt[].index` | integer | 是（在 multi_prompt 中） | — | 分镜序号 |
| `multi_prompt[].prompt` | string | 是（在 multi_prompt 中） | — | 分镜提示词，最多 512 字符 |
| `multi_prompt[].duration` | string | 是（在 multi_prompt 中） | — | 分镜时长（秒），不超过总时长，不小于 1；所有分镜时长之和等于总时长 |
| `image_list` | array | 否 | — | 参考图列表。支持 Base64 或 URL，格式 jpg/jpeg/png，≤10MB，宽高均≥300px，宽高比 1:2.5~2.5:1 |
| `image_list[].image_url` | string | 是（在 image_list 中） | — | 图片 URL 或 Base64 编码 |
| `image_list[].type` | string | 否 | — | 帧类型：`first_frame`（首帧）、`end_frame`（尾帧）。非首尾帧时不配置 |
| `element_list` | array | 否 | — | 主体参考列表，基于主体库中主体 ID 配置 |
| `element_list[].element_id` | long | 是（在 element_list 中） | — | 主体库中的主体 ID |
| `video_list` | array | 否 | — | 参考视频列表，格式 MP4/MOV，≤200MB，时长≥3秒，分辨率 720~2160px，帧率 24~60fps，至多 1 段 |
| `video_list[].video_url` | string | 是（在 video_list 中） | — | 视频 URL |
| `video_list[].refer_type` | string | 否 | `base` | 参考类型：`feature`（特征参考/视频参考）、`base`（待编辑视频/指令转换） |
| `video_list[].keep_original_sound` | string | 否 | — | 是否保留原声：`yes` 保留，`no` 不保留 |
| `sound` | string | 否 | `off` | 是否同时生成声音：`on`、`off`。有参考视频时只能为 `off` |
| `mode` | string | 否 | `pro` | 生成模式：`std`（标准）、`pro`（高品质） |
| `aspect_ratio` | string | 条件必填 | — | 画面纵横比：`16:9`、`9:16`、`1:1`。未使用首帧参考或视频编辑时必填 |
| `duration` | string | 否 | `5` | 视频时长（秒）：`3`~`15`。视频编辑（`refer_type=base`）时无效，跟随输入视频时长 |
| `watermark_info` | object | 否 | — | 水印配置 |
| `watermark_info.enabled` | boolean | 否 | — | `true` 生成含水印版本，`false` 不生成 |
| `callback_url` | string | 否 | — | 任务结果回调通知地址，任务状态变更时主动通知 |
| `external_task_id` | string | 否 | — | 自定义任务 ID，单用户下需保证唯一性 |

---

## 响应字段表

### 成功响应（HTTP 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误码；0 表示成功 |
| `message` | string | 错误信息 |
| `request_id` | string | 请求 ID，系统生成，用于跟踪请求 |
| `data.task_id` | string | 任务 ID，系统生成 |
| `data.task_info.external_task_id` | string | 客户自定义任务 ID |
| `data.task_status` | string | 任务状态：`submitted`（已提交）、`processing`（处理中）、`succeed`（成功）、`failed`（失败） |
| `data.created_at` | number | 任务创建时间，Unix 时间戳（ms） |
| `data.updated_at` | number | 任务更新时间，Unix 时间戳（ms） |

### 失败响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 非 0 错误码 |
| `message` | string | 错误描述信息 |
| `request_id` | string | 请求 ID |

---

## 生成期代码（Agent 直接调用）

```typescript
/**
 * 创建 Omni-Video 视频生成任务。
 * @param params 视频生成参数
 * @returns 任务 ID 和初始状态
 */

const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface ImageItem {
  image_url: string;
  type?: "first_frame" | "end_frame";
}

interface ElementItem {
  element_id: number;
}

interface VideoItem {
  video_url: string;
  refer_type?: "feature" | "base";
  keep_original_sound?: "yes" | "no";
}

interface MultiPromptItem {
  index: number;
  prompt: string;
  duration: string;
}

interface CreateOmniVideoParams {
  model_name?: "kling-video-o1" | "kling-v3-omni";
  multi_shot?: boolean;
  shot_type?: "customize" | "intelligence";
  prompt?: string;
  multi_prompt?: MultiPromptItem[];
  image_list?: ImageItem[];
  element_list?: ElementItem[];
  video_list?: VideoItem[];
  sound?: "on" | "off";
  mode?: "std" | "pro";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  duration?: string;
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

interface CreateOmniVideoResult {
  taskId: string;
  taskStatus: string;
  externalTaskId?: string;
  createdAt: number;
  updatedAt: number;
}

async function createOmniVideoTask(
  params: CreateOmniVideoParams
): Promise<CreateOmniVideoResult> {
  /**
   * 创建可灵 Omni-Video 视频生成任务。
   * @param params 创建参数，至少提供 prompt（文生视频）或 image_list（图生视频）
   * @returns 任务 ID 及初始状态信息
   */
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-oLpZb03wbNBa-gateway.appmiaoda.com/v1/videos/omni-video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) throw new Error(`HTTP 错误：${response.status}`);

  const json = await response.json();
  if (json.code !== 0) throw new Error(`API 错误 ${json.code}：${json.message}`);

  const { task_id, task_status, task_info, created_at, updated_at } = json.data;
  return {
    taskId: task_id,
    taskStatus: task_status,
    externalTaskId: task_info?.external_task_id,
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

// 示例 1：文生视频
const textToVideoResult = await createOmniVideoTask({
  model_name: "kling-video-o1",
  prompt: "一只橘猫在草地上慵懒地打滚",
  mode: "pro",
  aspect_ratio: "16:9",
  duration: "5",
});
console.log("任务 ID：", textToVideoResult.taskId);

// 示例 2：图生视频（图片参考首帧）
const imageToVideoResult = await createOmniVideoTask({
  model_name: "kling-video-o1",
  prompt: "让<<<image_1>>>中的人物向镜头挥手",
  image_list: [{ image_url: "https://example.com/image.png" }],
  duration: "5",
  mode: "pro",
  aspect_ratio: "16:9",
});

// 示例 3：视频编辑（指令转换）
const videoEditResult = await createOmniVideoTask({
  model_name: "kling-video-o1",
  prompt: "给<<<video_1>>>中穿蓝衣服的女孩，戴上<<<image_1>>>中的王冠",
  image_list: [{ image_url: "https://example.com/crown.png" }],
  video_list: [{ video_url: "https://example.com/video.mp4", refer_type: "base", keep_original_sound: "yes" }],
  mode: "pro",
});

// 示例 4：多镜头视频（文生视频）
const multiShotResult = await createOmniVideoTask({
  model_name: "kling-v3-omni",
  multi_shot: true,
  shot_type: "customize",
  prompt: "",
  multi_prompt: [
    { index: 1, prompt: "Two friends talking under a streetlight at night.", duration: "3" },
    { index: 2, prompt: "A runner sprinting through a forest.", duration: "2" },
  ],
  sound: "on",
  mode: "pro",
  aspect_ratio: "16:9",
  duration: "5",
});
```

---

## Edge Function 代码

```typescript
// edge-functions/kling-video-create.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  /**
   * Edge Function：提交可灵 Omni-Video 视频生成任务。
   * 客户端传入生成参数，服务端注入 API Key，返回 task_id。
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 至少需要 prompt 或 image_list 或 multi_prompt
  const hasContent =
    body.prompt ||
    (Array.isArray(body.image_list) && body.image_list.length > 0) ||
    (Array.isArray(body.multi_prompt) && body.multi_prompt.length > 0) ||
    (Array.isArray(body.video_list) && body.video_list.length > 0);

  if (!hasContent) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: prompt, image_list, or multi_prompt" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 注入平台密钥（禁止暴露到客户端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-oLpZb03wbNBa-gateway.appmiaoda.com/v1/videos/omni-video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

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

### Web 平台（React / Vite）

```typescript
interface CreateVideoParams {
  model_name?: string;
  prompt?: string;
  image_list?: Array<{ image_url: string; type?: string }>;
  video_list?: Array<{ video_url: string; refer_type?: string; keep_original_sound?: string }>;
  element_list?: Array<{ element_id: number }>;
  multi_shot?: boolean;
  shot_type?: string;
  multi_prompt?: Array<{ index: number; prompt: string; duration: string }>;
  sound?: string;
  mode?: string;
  aspect_ratio?: string;
  duration?: string;
  watermark_info?: { enabled: boolean };
  callback_url?: string;
  external_task_id?: string;
}

/**
 * 提交可灵 Omni-Video 视频生成任务。
 * @param params 视频生成参数
 * @returns 任务 ID
 */
async function submitVideoTask(params: CreateVideoParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("kling-video-create", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}

// 使用示例（React 组件中）
const handleCreateVideo = async () => {
  try {
    const taskId = await submitVideoTask({
      model_name: "kling-video-o1",
      prompt: "一只橘猫在草地上慵懒地打滚",
      mode: "pro",
      aspect_ratio: "16:9",
      duration: "5",
    });
    console.log("任务已提交，task_id：", taskId);
    // 继续用 task_id 调用 kling-video-query 轮询结果
  } catch (err) {
    console.error("提交失败：", err);
  }
};
```

### MiniProgram 平台（Taro）

```typescript
/**
 * MiniProgram：提交可灵 Omni-Video 视频生成任务。
 * @param params 视频生成参数
 * @returns 任务 ID
 */
async function submitVideoTask(params: CreateVideoParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke("kling-video-create", {
    body: params,
  });
  if (error) throw error;
  if (data.code !== 0) throw new Error(`API 错误 ${data.code}：${data.message}`);
  return data.data.task_id;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **计费**：折扣价 400 元 / 原价 480 元。避免重复提交相同任务。
- **视频时长**：使用视频编辑（`refer_type: "base"`）时 `duration` 参数无效，输出时长跟随输入视频。
- **宽高比**：指令转换（视频编辑）和图生视频（含首尾帧）时不支持设置 `aspect_ratio`。
- **多镜头**：`multi_shot=true` 时 `prompt` 参数无效，需改用 `multi_prompt`；不支持首尾帧模式。
- **参考图片数量限制**：
  - 无参考视频 + 仅多图主体：参考图片与多图主体数量之和 ≤ 7
  - 无参考视频 + 有视频主体：参考图片与多图主体数量之和 ≤ 4
  - 有参考视频 + 仅多图主体：参考图片与多图主体数量之和 ≤ 4
- **声音**：有参考视频时 `sound` 参数只能为 `off`。
- **视频格式**：`video_list` 仅支持 MP4/MOV，至多 1 段视频，≤200MB。
- **任务 ID 唯一性**：使用 `external_task_id` 时，单用户下需保证唯一性。
