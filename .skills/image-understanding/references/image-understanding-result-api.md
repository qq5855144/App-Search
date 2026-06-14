# 图像内容理解 — 查询结果接口

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `b335d1cb-8d7e-44ab-b419-752d3d363680` |
| API ID | `api-zYkZz8qoKDdL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-zYkZz8qoKDdL-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/get-result` |
| 生成期 URL（含 API ID） | `https://app-cblk1rqa5fk1-api-zYkZz8qoKDdL-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/get-result` |
| Content-Type | `application/json` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| 认证模式 | `platform_managed` |
| third_part_domain | `app-cblk1rqa5fk1-api-zYkZz8qoKDdL-gateway.appmiaoda.com` |
| 计费 | 不启用（查询接口免费） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id` | string | 是 | 调用提交请求接口时返回的任务 ID |

---

## 响应字段表

**成功响应（HTTP 200）：**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | string | 请求日志 ID |
| `result.task_id` | string | 任务 ID |
| `result.ret_code` | number | 任务状态码：`0` 处理成功，`1` 处理中 |
| `result.ret_msg` | string | 状态描述，成功时为 `"success"` |
| `result.description` | string | 图片内容的自然语言描述（`ret_code === 0` 时有效） |

**ret_code 说明：**

| ret_code | 含义 | 处理方式 |
|----------|------|----------|
| `0` | 处理成功，可获取 `description` | 取 `result.description` |
| `1` | 处理中 | 等待后重新查询 |

**响应示例（成功）：**

```json
{
  "log_id": "1826091451221753557",
  "result": {
    "task_id": "1826091287582742824",
    "ret_code": 0,
    "ret_msg": "success",
    "description": "这张图片展示的是位于中国西藏自治区拉萨市区西北玛布日山上的布达拉宫，
      它是藏传佛教的宗教圣地，同时也是中国的世界文化遗产之一，以其宏伟的建筑风格和深厚
      的文化底蕴吸引着无数游客前来参观。"
  }
}
```

**响应示例（处理中）：**

```json
{
  "log_id": "1826091451221753558",
  "result": {
    "task_id": "1826091287582742824",
    "ret_code": 1,
    "ret_msg": "processing"
  }
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 查询图像内容理解任务的执行结果。
 * @param taskId - 提交请求时返回的任务 ID
 * @returns 任务状态及描述
 */
async function getImageUnderstandingResult(
  taskId: string
): Promise<{ retCode: number; description: string }> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-zYkZz8qoKDdL-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/get-result",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  const retCode = json.result?.ret_code;
  const description = json.result?.description ?? "";

  return { retCode, description };
}

/**
 * 完整异步流程：提交图像理解请求并轮询直至获取结果。
 * @param question - 提问信息，不超过 100 个字符
 * @param imageBase64 - 图片 Base64（与 imageUrl 二选一，优先）
 * @param imageUrl - 图片 URL（与 imageBase64 二选一）
 * @returns 图片内容的自然语言描述
 */
async function imageUnderstandingAndWait(
  question: string,
  imageBase64?: string,
  imageUrl?: string
): Promise<string> {
  // 依赖 references/image-understanding-request-api.md 中的 submitImageUnderstanding
  const { taskId } = await submitImageUnderstanding(question, imageBase64, imageUrl);

  const POLL_INTERVAL_MS = 3000; // 每 3 秒轮询一次
  const TIMEOUT_MS = 3 * 60 * 1000; // 超时 3 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await getImageUnderstandingResult(taskId);
    if (result.retCode === 0) return result.description;
    if (result.retCode !== 1) throw new Error(`Task failed with ret_code: ${result.retCode}`);
    // ret_code === 1: 处理中，继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 3 minutes`);
}
```

---

## Edge Function 代码

```typescript
// edge-functions/image-understanding-result.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-zYkZz8qoKDdL-gateway.appmiaoda.com/rest/2.0/image-classify/v1/image-understanding/get-result",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    }
  );

  // 直接透传配额/余额错误
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

### Web、MiniProgram 与 App 三端通用

查询接口仅传 `task_id`、返回普通 JSON，三端调用逻辑完全相同。App 端为保持方案统一，**须从 `expo/fetch` 导入 `fetch`**，均可直接使用 `supabase.functions.invoke`。前端需自行实现轮询循环：

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 查询图像理解任务结果，ret_code === 0 时返回描述文字。
 * @param taskId - 任务 ID
 * @returns 任务状态及描述
 */
async function getImageUnderstandingResult(
  taskId: string
): Promise<{ retCode: number; description: string }> {
  const { data, error } = await supabase.functions.invoke("image-understanding-result", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  return {
    retCode: data?.result?.ret_code ?? -1,
    description: data?.result?.description ?? "",
  };
}

/**
 * 完整轮询流程：提交后持续查询直至获取描述或超时。
 * @param taskId - 提交接口返回的任务 ID
 * @returns 图片内容描述
 */
async function pollUntilDone(taskId: string): Promise<string> {
  const POLL_INTERVAL_MS = 3000;
  const TIMEOUT_MS = 3 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await getImageUnderstandingResult(taskId);
    if (result.retCode === 0) return result.description;
    if (result.retCode !== 1) throw new Error(`任务失败，ret_code: ${result.retCode}`);
  }
  throw new Error("查询超时（3 分钟），请重试");
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function getImageUnderstandingResult(
  taskId: string
): Promise<{ retCode: number; description: string }> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-understanding-result`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
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
  return {
    retCode: json?.result?.ret_code ?? -1,
    description: json?.result?.description ?? "",
  };
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **查询接口免费**：本接口不计费，可根据业务需要适当缩短轮询间隔。
- **轮询策略**：建议间隔 3 秒，超时时间设为 3 分钟，避免长时间占用资源。
- **ret_code 判断**：`0` 表示成功取结果；`1` 表示处理中继续等待；其他值视为异常需抛出错误。
- **提交接口计费提醒**：提交请求（`image-understanding-request`）按次计费，避免因前端 Bug 重复提交。
