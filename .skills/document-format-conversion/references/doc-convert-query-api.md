# 文档格式转换 — 获取结果接口

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `0cf63ee3-d579-4191-a267-fe7ec70a10d5` |
| API ID | `api-oYA6ZGjReooa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-oYA6ZGjReooa-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/get_request_result` |
| Content-Type | `application/x-www-form-urlencoded` |
| Auth 模式 | `platform_managed`（`traefik: true`） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| third_part_domain | `app-cblk1rqa5fk1-api-oYA6ZGjReooa-gateway.appmiaoda.com` |
| 计费 | **不计费**，按需轮询 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_id` | string | 是 | 调用提交请求接口时返回的任务 ID |

---

## 响应字段表

### 成功响应（任务查询成功，`success: true`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | boolean | `true` 表示请求成功 |
| `log_id` | number | 唯一 log id，用于问题定位 |
| `result.task_id` | string | 该文件对应请求的 task_id |
| `result.ret_code` | number | 识别状态：`1` 任务未开始，`2` 进行中，`3` 已完成 |
| `result.ret_msg` | string | 识别状态信息（如"任务未开始"/"进行中"/"已完成"） |
| `result.percent` | number | 文档转换进度（百分比，0～100） |
| `result.result_data.word` | string | Word 文件下载链接（有效期 30 天；失败时返回 `""`） |
| `result.result_data.excel` | string | Excel 文件下载链接（有效期 30 天；无表格或失败时返回 `""`） |
| `result.create_time` | string | 任务创建时间（datetime 格式） |
| `result.start_time` | string | 任务开始时间（datetime 格式） |
| `result.end_time` | string | 任务结束时间（datetime 格式） |
| `code` | number | 成功状态码（如 `1001`） |
| `message` | string | 详情（如 `"Query task successfully!"`） |

> 若查询的 `task_id` 不存在，返回 `result` 为 `{}`。

### 任务状态说明（`ret_code`）

| ret_code | 含义 | 轮询操作 |
|----------|------|---------|
| `1` | 任务未开始 | **必须继续轮询**，等待 5～10 秒后重试 |
| `2` | 进行中 | **必须继续轮询**，等待 5 秒后重试 |
| `3` | 已完成 | **停止轮询**，读取下载链接 |

> **重要**：`ret_code = 1` 是正常的初始状态，**不代表失败**，不可停止轮询。

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 查询文档格式转换任务状态。
 * @param taskId - 提交时返回的 task_id
 * @returns 查询结果对象，含 ret_code、percent、result_data 等
 */
async function queryDocConvert(taskId: string): Promise<{
  ret_code: number;
  ret_msg?: string;
  percent: number;
  result_data?: { word: string; excel: string };
  create_time?: string;
  start_time?: string;
  end_time?: string;
}> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-oYA6ZGjReooa-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/get_request_result",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ task_id: taskId }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (!json.success) {
    throw new Error(`查询失败: ${json.message} (code: ${json.code})`);
  }
  return json.result;
}

/**
 * 轮询等待任务完成，返回 Word/Excel 下载链接。
 * @param taskId - 提交时返回的 task_id
 * @returns Word 和 Excel 文件下载链接
 */
async function waitForDocConvert(taskId: string): Promise<{ word: string; excel: string }> {
  const POLL_INTERVAL_MS = 7000;           // 建议 5～10 秒
  const TIMEOUT_MS = 10 * 60 * 1000;      // 最长等待 10 分钟
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryDocConvert(taskId);

    if (result.ret_code === 3) {
      // 已完成，返回下载链接
      return result.result_data ?? { word: "", excel: "" };
    }
    // ret_code = 1（未开始）或 2（进行中）：继续轮询，不可停止
    // 注意：ret_code = 1 是正常初始状态，不代表失败
  }
  throw new Error(`任务 ${taskId} 在 10 分钟内未完成，已超时`);
}
```

---

## Edge Function 代码

```typescript
// edge-functions/doc-convert-query.ts
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
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Invalid request body" }), {
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

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-oYA6ZGjReooa-gateway.appmiaoda.com/rest/2.0/ocr/v1/doc_convert/get_request_result",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ task_id: taskId }).toString(),
    }
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

## 前端调用代码（含轮询循环）

### 推荐方式（supabase client 可用时）

```typescript
/**
 * 查询单次任务状态。
 * @param taskId - 任务 ID
 * @returns 查询结果
 */
async function queryDocConvert(taskId: string) {
  const { data, error } = await supabase.functions.invoke("doc-convert-query", {
    body: { task_id: taskId },
  });
  if (error) throw error;
  if (!data.success) throw new Error(`查询失败: ${data.message} (code: ${data.code})`);
  return data.result;
}

/**
 * 完整前端流程：提交任务并轮询等待结果。
 * @param submitFn - 调用提交接口的函数，返回 task_id
 * @returns Word 和 Excel 文件下载链接
 */
async function convertAndWait(
  submitFn: () => Promise<string>
): Promise<{ word: string; excel: string }> {
  const taskId = await submitFn();

  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryDocConvert(taskId);

    if (result.ret_code === 3) {
      // 已完成，返回下载链接
      return result.result_data ?? { word: "", excel: "" };
    }
    // ret_code = 1 或 2：继续等待，不可停止
  }
  throw new Error(`转换任务超时（task_id: ${taskId}）`);
}
```

### 备用方式（无 supabase client）

```typescript
/**
 * 查询单次任务状态（原生 fetch）。
 * @param taskId - 任务 ID
 * @returns 查询结果
 */
async function queryDocConvert(taskId: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/doc-convert-query`,
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
  if (!json.success) throw new Error(`查询失败: ${json.message} (code: ${json.code})`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：获取结果接口**不计费**，可放心高频轮询（注意 QPS 上限 10）。
- **轮询策略**：
  - `ret_code = 1`（未开始）：**必须继续轮询**，这是正常初始状态，不代表失败
  - `ret_code = 2`（进行中）：继续轮询，建议等待 5 秒
  - `ret_code = 3`（已完成）：**立即停止轮询**，读取 `result_data.word` / `result_data.excel`
- **常见错误**：前端在收到 `ret_code = 1` 时停止轮询，导致任务无法完成。
- **下载链接有效期**：30 天，请及时使用或转存。
- **task_id 不存在**：返回 `result: {}`，需做空值防护。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）。
- **QPS 限制**：查询接口 QPS 上限为 10，前端轮询间隔建议 ≥ 5 秒。
