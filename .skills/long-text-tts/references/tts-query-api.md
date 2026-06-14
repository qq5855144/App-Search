# TTS Query API — 查询长文本语音合成任务结果

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `6c2d8399-c9ba-40d4-9f5f-96dfc9b71a68` |
| API ID | `api-Q9KWZ2jy8W09` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Q9KWZ2jy8W09-gateway.appmiaoda.com/rpc/2.0/tts/v1/query` |
| 生成期 URL | `https://app-cblk1rqa5fk1-api-Q9KWZ2jy8W09-gateway.appmiaoda.com/rpc/2.0/tts/v1/query` |
| Auth 模式 | `platform_managed`（traefik: true） |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| Third-party domain | `app-cblk1rqa5fk1-api-Q9KWZ2jy8W09-gateway.appmiaoda.com` |
| 计费 | 不计费 |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `task_ids` | `array` | 是 | 任务 ID 数组，单次最多可查询 200 个 |

---

## 响应字段表

### 成功响应（200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `log_id` | `number` | 日志 ID |
| `tasks_info` | `array` | 任务信息数组 |
| `tasks_info[].task_id` | `string` | 任务 ID |
| `tasks_info[].task_status` | `string` | 任务状态：`Success` / `Running` / `Failure` / `Created` |
| `tasks_info[].task_result.speech_url` | `string?` | 音频下载链接（仅 `Success` 时存在，http 协议，有效期 72 小时） |
| `tasks_info[].task_result.speech_timestamp.sentences` | `array?` | 字幕时间戳数组（仅 `Success` 时存在） |
| `tasks_info[].task_result.speech_timestamp.sentences[].paragraph_index` | `number` | 段落索引 |
| `tasks_info[].task_result.speech_timestamp.sentences[].sentence_texts` | `string` | 句子文本 |
| `tasks_info[].task_result.speech_timestamp.sentences[].begin_time` | `number` | 句子开始时间（ms） |
| `tasks_info[].task_result.speech_timestamp.sentences[].end_time` | `number` | 句子结束时间（ms） |
| `tasks_info[].task_result.speech_timestamp.sentences[].characters[].character_text` | `string` | 字符文本 |
| `tasks_info[].task_result.speech_timestamp.sentences[].characters[].begin_time` | `number` | 字符开始时间（ms） |
| `tasks_info[].task_result.speech_timestamp.sentences[].characters[].end_time` | `number` | 字符结束时间（ms） |

### 失败响应

| 字段 | 类型 | 说明 |
|------|------|------|
| `error_code` | `number` | 错误码（18 = QPS 超限） |
| `error_msg` | `string` | 错误描述 |
| `error_info` | `array?` | 错误或不存在的任务 ID 数组 |

**任务状态说明：**
- `Success`：任务完成，可获取音频链接
- `Running`：任务执行中，需等待后再次查询
- `Created`：任务已提交，尚未开始处理（视同 Running，继续轮询）
- `Failure`：任务失败

---

## 生成期代码（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

/**
 * 查询长文本语音合成任务状态。
 * @param taskId - 由 createTTSTask 返回的任务 ID
 * @returns 任务状态和音频链接（成功时）
 */
async function queryTTSTask(taskId: string): Promise<{
  task_status: "Success" | "Running" | "Failure" | "Created";
  speech_url?: string;
}> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Q9KWZ2jy8W09-gateway.appmiaoda.com/rpc/2.0/tts/v1/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_ids: [taskId] }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();

  // QPS 超限（error_code: 18）：不抛出异常，由上层退避重试
  if (json.error_code === 18) {
    console.warn("QPS 超限，需退避重试");
    return { task_status: "Running" };
  }

  const taskInfo = json.tasks_info?.[0];
  if (!taskInfo) throw new Error("No task info returned");

  return {
    task_status: taskInfo.task_status,
    speech_url: taskInfo.task_result?.speech_url,
  };
}
```

---

## Edge Function 代码

### Web 版本（返回 Supabase Storage 公开 URL）

```typescript
// edge-functions/tts-query.ts（Web 版：将 speech_url 转存至 Supabase Storage）
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远端音频 URL 转存至 Supabase Storage，返回永久公开链接。
 * @param audioUrl - 百度 TTS 返回的临时音频 URL
 * @returns Supabase Storage 公开 URL
 */
async function transferAudioToStorage(audioUrl: string): Promise<string> {
  // 将 http 升级为 https，防止被 CORS 或安全策略拦截
  const safeUrl = audioUrl.replace("http://", "https://");
  const response = await fetch(safeUrl);
  if (!response.ok) throw new Error(`Fetch audio failed: ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp3";
  const filePath = `tts/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("generated-media")
    .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from("generated-media").getPublicUrl(filePath);
  return urlData.publicUrl;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let taskIds: string[];
  try {
    const body = await req.json();
    taskIds = body.task_ids;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new Error("Missing task_ids");
    }
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
    "https://app-cblk1rqa5fk1-api-Q9KWZ2jy8W09-gateway.appmiaoda.com/rpc/2.0/tts/v1/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_ids: taskIds }),
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

  // QPS 超限：直接透传，让前端退避重试
  if (data.error_code === 18) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 将已完成任务的 speech_url 转存至 Supabase Storage
  if (data.tasks_info) {
    for (const taskInfo of data.tasks_info) {
      if (
        taskInfo.task_status === "Success" &&
        taskInfo.task_result?.speech_url
      ) {
        try {
          const publicUrl = await transferAudioToStorage(
            taskInfo.task_result.speech_url
          );
          taskInfo.task_result.speech_url = publicUrl; // 替换为永久 URL
        } catch (err) {
          console.error("Audio transfer failed:", err);
          // 转存失败时退回原始 https URL
          taskInfo.task_result.speech_url =
            taskInfo.task_result.speech_url.replace("http://", "https://");
        }
      }
    }
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### MiniProgram 版本（返回 https URL，不做 Storage 转存）

MiniProgram 可直接使用升级后的 https URL 播放，无需转存。如需永久保存可复用 Web 版的 Storage 逻辑。

```typescript
// edge-functions/tts-query-mp.ts（MiniProgram 版：返回 https URL）
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let taskIds: string[];
  try {
    const body = await req.json();
    taskIds = body.task_ids;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new Error("Missing task_ids");
    }
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
    "https://app-cblk1rqa5fk1-api-Q9KWZ2jy8W09-gateway.appmiaoda.com/rpc/2.0/tts/v1/query",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ task_ids: taskIds }),
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

  // 将 speech_url 从 http 升级为 https（微信小程序要求 https）
  if (data.tasks_info) {
    for (const taskInfo of data.tasks_info) {
      if (taskInfo.task_result?.speech_url) {
        taskInfo.task_result.speech_url =
          taskInfo.task_result.speech_url.replace("http://", "https://");
      }
    }
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 前端（React/Vue + supabase client）

```typescript
import { useRef, useState, useCallback } from "react";

/**
 * 查询 TTS 任务状态并在完成后返回音频 URL。
 * CRITICAL：使用 useRef 管理重试计数器，避免 useState 导致的双重轮询链。
 */
function useTTSQuery() {
  const [speechUrl, setSpeechUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const retryCountRef = useRef(0);
  const externalTaskIdRef = useRef(""); // 百度 TTS task_id（非 Supabase UUID）

  const queryTaskStatus = useCallback(async (delayMs = 0) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const { data, error: invokeError } = await supabase.functions.invoke(
      "tts-query",
      { body: { task_ids: [externalTaskIdRef.current] } }
    );

    if (invokeError) {
      setError(`查询失败: ${invokeError.message}`);
      setIsPolling(false);
      return;
    }

    // QPS 超限：退避 10 秒后重试
    if (data?.error_code === 18 || data?.error_msg?.includes("qps")) {
      console.warn("QPS 超限，10 秒后重试");
      queryTaskStatus(10000);
      return;
    }

    const taskInfo = data?.tasks_info?.[0];
    const taskStatus = taskInfo?.task_status;

    if (taskStatus === "Success") {
      setSpeechUrl(taskInfo.task_result.speech_url);
      setIsPolling(false);
    } else if (taskStatus === "Failure") {
      setError("语音合成失败，请重试");
      setIsPolling(false);
    } else if (taskStatus === "Running" || taskStatus === "Created") {
      // Created 状态视同 Running，继续轮询
      retryCountRef.current += 1;
      if (retryCountRef.current < 200) {
        queryTaskStatus(5000); // 每 5 秒轮询，最多 200 次（≈17 分钟）
      } else {
        setError("生成超时，请返回重试");
        setIsPolling(false);
      }
    } else {
      setError(`任务状态异常: ${taskStatus}`);
      setIsPolling(false);
    }
  }, []); // 空依赖，避免函数引用变化触发 useEffect 重新执行

  const startPolling = useCallback(
    (externalTaskId: string) => {
      // 使用前先检查 Supabase DB 缓存
      externalTaskIdRef.current = externalTaskId;
      retryCountRef.current = 0;
      setIsPolling(true);
      setError(null);
      queryTaskStatus(2000); // 首次查询延迟 2 秒
    },
    [queryTaskStatus]
  );

  return { speechUrl, error, isPolling, startPolling };
}

// 使用示例（组件内）
function TTSPlayer({ articleId }: { articleId: string }) {
  const { speechUrl, error, isPolling, startPolling } = useTTSQuery();

  // 页面加载时优先读取 DB 缓存
  useEffect(() => {
    async function loadData() {
      // 1. 查询 DB 是否已有完成的任务
      const existingTasks = await getTTSTasksByArticleId(articleId);
      const completedTask = existingTasks.find(
        (t) => t.status === "Success" && t.speech_url
      );

      if (completedTask) {
        // 已有缓存：直接使用，跳过轮询
        setSpeechUrl(completedTask.speech_url);
        return;
      }

      // 2. 无缓存：获取 task_id 开始轮询
      const pendingTask = existingTasks.find((t) => t.status !== "Failure");
      if (pendingTask?.task_id) {
        startPolling(pendingTask.task_id); // 使用百度 TTS task_id，非 Supabase UUID
      }
    }
    loadData();
  }, [articleId]);

  return (
    <div>
      {isPolling && <p>正在生成语音...</p>}
      {error && <p>{error}</p>}
      {speechUrl && <audio controls src={speechUrl} />}
    </div>
  );
}
```

### MiniProgram 前端（Taro）

```typescript
import { useRef, useState, useCallback } from "react";
import Taro from "@tarojs/taro";

/**
 * MiniProgram TTS 播放器 Hook。
 * CRITICAL：
 * 1. 用 useRef 管理重试计数器，防止双重轮询链。
 * 2. speech_url 使用 https（已在 Edge Function 侧升级），不使用 http。
 * 3. 必须两步 UI（生成 + 播放），不可在 await 后自动调用 play()。
 */
function useTTSQueryMP() {
  const [speechUrl, setSpeechUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const retryCountRef = useRef(0);
  const externalTaskIdRef = useRef("");

  const queryTaskStatus = useCallback(async (delayMs = 0) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const { data, error: invokeError } = await supabase.functions.invoke(
      "tts-query-mp",
      { body: { task_ids: [externalTaskIdRef.current] } }
    );

    if (invokeError) {
      setError(`查询失败: ${invokeError.message}`);
      setIsPolling(false);
      return;
    }

    // QPS 超限退避
    if (data?.error_code === 18 || data?.error_msg?.includes("qps")) {
      console.warn("QPS 超限，10 秒后重试");
      queryTaskStatus(10000);
      return;
    }

    const taskInfo = data?.tasks_info?.[0];
    const taskStatus = taskInfo?.task_status;

    if (taskStatus === "Success") {
      // Edge Function 已将 http 升级为 https
      setSpeechUrl(taskInfo.task_result.speech_url);
      setIsPolling(false);
    } else if (taskStatus === "Failure") {
      setError("语音合成失败，请重试");
      setIsPolling(false);
    } else if (taskStatus === "Running" || taskStatus === "Created") {
      retryCountRef.current += 1;
      if (retryCountRef.current < 200) {
        queryTaskStatus(5000);
      } else {
        setError("生成超时，请返回重试");
        setIsPolling(false);
      }
    }
  }, []);

  const startPolling = useCallback(
    (externalTaskId: string) => {
      externalTaskIdRef.current = externalTaskId;
      retryCountRef.current = 0;
      setIsPolling(true);
      setError(null);
      queryTaskStatus(2000);
    },
    [queryTaskStatus]
  );

  return { speechUrl, error, isPolling, startPolling };
}

// 播放组件：必须两步 UI，不可在 await 后自动 play()
function TTSPlayerMP({ articleId }: { articleId: string }) {
  const { speechUrl, error, isPolling, startPolling } = useTTSQueryMP();

  // 步骤 2：点"播放"按钮（必须在独立的用户手势中调用 play()）
  const handlePlay = () => {
    if (!speechUrl) return;
    const audio = Taro.createInnerAudioContext();

    if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
      // H5 环境：直接使用 https URL
      audio.src = speechUrl;
      audio.play();
    } else {
      // weapp 真机：https URL 可直接使用（已在 Edge Function 升级）
      // 注意：不要使用 data: URI，真机 InnerAudioContext 会返回 INNERERRCODE:-1100
      audio.src = speechUrl;
      audio.play();
    }
  };

  return (
    <view>
      {isPolling && <text>正在生成语音...</text>}
      {error && <text>{error}</text>}
      {speechUrl && (
        <button onClick={handlePlay}>播放语音</button>
      )}
    </view>
  );
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅在 Edge Function 服务端读取，严禁暴露到前端
- **计费**：`tts-query` 本身不计费，但需配合 `tts-create`（¥11.25/千次）使用
- **轮询实现 CRITICAL**：
  - 必须使用 `useRef` 而非 `useState` 管理重试计数器
  - 使用 `useState` 会导致每次状态更新重建函数引用，触发 `useEffect` 重复执行，产生指数级增长的并发轮询链
  - `queryTaskStatus` 的 `useCallback` 依赖数组必须为空 `[]`
- **Baidu `task_id` 与 Supabase `id` 区分**：
  - Supabase DB 的行 ID（UUID）用于路由参数和 DB 查询
  - 百度 TTS 返回的 `task_id` 才是传给 `tts-query` 的参数
  - 两者绝不可混用，否则返回 `{"error":"invalid param: task_ids"}`
- **`Created` 状态处理**：新提交的任务可能先进入 `Created` 状态（排队中），需与 `Running` 同等对待继续轮询；否则会显示"任务状态异常"
- **QPS 超限（error_code: 18）**：不要抛出异常停止轮询，应退避 10 秒后继续重试
- **DB 缓存优先**：每次页面加载先查 Supabase DB；若已有成功的 `speech_url`，直接使用，无需重新轮询（百度任务链接 72 小时后失效，但 Supabase Storage URL 永久有效）
- **http → https 升级**：百度返回的 `speech_url` 为 http 协议，微信小程序会拦截非 https 资源；Web 版在 Edge Function 中转存至 Supabase Storage（天然 https），MiniProgram 版在 Edge Function 中直接替换协议前缀
- **音频链接有效期**：原始 `speech_url` 仅保留 72 小时；建议 Edge Function 在任务成功后立即转存至 Supabase Storage 以获取永久链接
