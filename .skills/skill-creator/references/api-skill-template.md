# API Gateway Skill Template

Use this reference whenever the user provides a `gateway_apis` JSON definition and wants to generate
an API skill. It defines the fixed frontmatter schema and the boilerplate sections that are identical
across all gateway API skills so you don't need to ask the user for them.

---

## Step 0 — Choose: Single File vs File Tree

Decide the output structure before writing anything.

**Use a single `SKILL.md` file when ALL of the following are true:**
- Only one endpoint
- Synchronous response (no polling / callbacks)
- Request body is simple (flat params, no nested objects or binary data)
- Does not return media URLs (images / video / audio)
- Does not stream its response

**Use a file tree when ANY of the following is true:**
- Two or more endpoints (e.g. submit + query)
- Async / polling workflow (submit → poll until SUCCESS/FAILED)
- Complex request body (nested arrays, Base64 image data, multiple modes)
- Returns image / video / audio URLs (requires Supabase Storage transfer)
- Streams its response (SSE / chunked)
- Total content would exceed ~300 lines in a single file

**File tree layout for multi-endpoint or async APIs:**

```
<skill-name>/
├── SKILL.md                   # frontmatter + 能力摘要 + workflow overview
└── references/
    ├── <endpoint-a>-api.md    # full spec + generation-time + post-generation code for endpoint A
    └── <endpoint-b>-api.md    # full spec + generation-time + post-generation code for endpoint B
```

Rules for the file tree variant:
- `SKILL.md` contains: frontmatter, 能力概述 (brief), the end-to-end workflow (e.g. submit→poll loop),
  and explicit pointers like `> Read references/submit-api.md for the full submit spec.`
- Each `references/<endpoint>-api.md` contains: full parameter table, response shape, generation-time
  code, AND its own Edge Function boilerplate (each endpoint needs its own Edge Function).
- The polling loop (if async) goes in `SKILL.md` as the authoritative workflow description, with
  a code example showing the full submit → poll → timeout pattern.
- **SKILL.md must have BOTH `## 生成期用法（Agent 直接调用）` AND `## 生成后用法（应用内通过 Edge Function 调用）`
  as proper section headers** — even in file-tree form where the full code lives in `references/`.
  For the file-tree variant, each section may be a brief summary + explicit pointer to the relevant
  reference file, but the headers MUST exist. **Leaving 生成后用法 as only a blockquote footnote
  (`>`) is not acceptable** — a coding agent will treat the inline 生成期 code as the complete
  solution and never open the references/ directory to find the Edge Function pattern.

**Async polling pattern (include in SKILL.md when the API is async):**

```typescript
// Full async workflow: submit → poll → result
async function generateAndWait(submitFn: () => Promise<{ taskId: string }>) {
  const { taskId } = await submitFn();

  const POLL_INTERVAL_MS = 7000;   // 5–10 s recommended
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryTask(taskId);
    if (result.status === "SUCCESS") return result;
    if (result.status === "FAILED")  throw new Error(`Task failed: ${JSON.stringify(result.error)}`);
    // PENDING / PROCESSING → keep polling
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

---

## Frontmatter Schema

```yaml
---
name: <kebab-case, matches the skill directory name exactly>
description: <≤120 chars; must express BOTH "what it does" AND "when to use it">
license: MIT
---
```

**Rules:**
- `name`: kebab-case, matches the skill directory name exactly.
- `description`: the primary triggering mechanism — include both what the skill does AND when to use it. Keep under 120 chars.

---

## Section 1 — 能力概述

Neutral, environment-agnostic description. Extract from the `context` / `description` fields in
`gateway_apis`. Include:
- Endpoint URL + HTTP method（URL 必须使用 `api_id@` 格式，例如 `POST https://api-abc123@foo.api.com/v1/bar`）
- Core request parameters (name, type, required, description)
- Response shape (top-level fields, key nested fields)
- Capability limits (e.g., "single source currency per request", "non-tick-level latency")
- A realistic response example (copy or adapt from `gateway_apis[].context`)

---

## Section 2 — 生成期用法（Agent 直接调用）

Auth pattern depends on the API's authentication type:

**`key_type: platform_managed`** — key injected by platform, read from env var:
- Key source: `process.env["INTEGRATIONS_API_KEY"]!`
- Auth header: `"X-Gateway-Authorization": \`Bearer ${apiKey}\``

**`key_type: user_managed`** — user provides their own API key, use `gateway_schema.authValue` directly:
- Key source: `gateway_schema.authValue` as a hardcoded constant (or from env if configured)
- Auth header: `"X-Gateway-Authorization": AUTH_VALUE` (always use `X-Gateway-Authorization`, regardless of `gateway_schema.authKey` value)

**`key_type: no_key`** — no auth header needed.

Content-Type: determined by `gateway_schema.contentType`:
- `"form"` → `application/x-www-form-urlencoded`
- `"json"` → `application/json`

### Standard TypeScript pattern — `platform_managed`

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed skill 密钥由平台注入

async function call<API_NAME>(/* extracted params */): Promise</* return type */> {
  const response = await fetch("https://<api_id>@<gateway_schema.url host+path>", {
    method: "<gateway_schema.method.toUpperCase()>",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded", // adjust if json
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: new URLSearchParams({ /* params */ }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}
```

### Standard TypeScript pattern — `user_managed`

```typescript
const AUTH_VALUE = "<gateway_schema.authValue>"; // replace with actual value from gateway_schema

async function call<API_NAME>(/* extracted params */): Promise</* return type */> {
  const response = await fetch("https://<api_id>@<gateway_schema.url host+path>", {
    method: "<gateway_schema.method.toUpperCase()>",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded", // adjust if json
      "X-Gateway-Authorization": AUTH_VALUE,
    },
    body: new URLSearchParams({ /* params */ }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}
```

Fill in the function name, parameters, and return type from the actual API definition.

---

## Section 3 — 生成后用法（应用内通过 Edge Function 调用）

**This section is FIXED for all gateway APIs.** Use the boilerplate below verbatim,
substituting only the parameter names and upstream URL.

The security contract is:
- Client sends JSON to the Edge Function.
- Edge Function reads `INTEGRATIONS_API_KEY` from Deno env and adds it as
  `X-Gateway-Authorization: Bearer ${apiKey}`.
- The raw AppCode is never exposed to the browser.
- 429 (quota exceeded) and 402 (insufficient balance) error bodies are forwarded as-is.

### Edge Function boilerplate

```typescript
// edge-functions/<api-name>.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Parse client request ---
  let <param>: string;   // repeat for each required parameter
  try {
    const body = await req.json();
    <param> = body.<param>;
    if (!<param>) throw new Error("Missing <param>");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Inject platform key (never expose to client) ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Call upstream ---
  const upstream = await fetch("https://<api_id>@<gateway_schema.url host+path>", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: new URLSearchParams({ <param> }).toString(),
  });

  // Forward quota/balance errors verbatim
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

### Frontend → Edge Function boilerplate

**推荐方式（supabase client 可用时）：**

```typescript
async function fetch<ApiName>(<param>: string) {
  const { data, error } = await supabase.functions.invoke("<api-name>", {
    body: { <param> },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetch<ApiName>(<param>: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/<api-name>`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ <param> }),
  });

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
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);

  return json.data;
}
```

---

## Section 4 — 参数说明

Two tables:

**请求参数** — derived from `gateway_apis[].context` (the `### Parameters` block):

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ...    | ...  | ...  | ...  |

**返回字段说明** — derived from the `### Response` example in `context`. Include every
field a caller would realistically use. Mark optional fields with `?`.

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code`   | `number` | 状态码（见返回码说明） |
| ...      | ...  | ... |

---

## Section 5 — 注意事项

Always include at minimum:
- **密钥安全**: `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）。
- **计费**: 从 `plugin_billing_configs` 提取单价，提醒用户避免不必要的重复调用。

Add API-specific notes as needed (rate limits, precision caveats, data freshness, etc.).

---

## Extraction Cheatsheet

| Skill field | Source in gateway_apis JSON |
|-------------|----------------------------|
| Endpoint URL | 在 `gateway_schema.url` 的 `https://` 后、hostname 前插入 `{api_id}@`，`api_id` 取 `gateway_apis[].id` 的真实值。例：`gateway_schema.url` 为 `https://foo.api.com/v1/bar`，`id` 为 `api-abc123`，则 URL 写成 `https://api-abc123@foo.api.com/v1/bar`。**此格式适用于所有出现 gateway API URL 的位置，包括文档表格（能力概述的 Endpoint 行）和代码中的 fetch 调用。** |
| HTTP method | `gateway_schema.method` |
| Auth header name | Always `X-Gateway-Authorization` (regardless of `gateway_schema.authKey` value, including query param `ak`) |
| Auth header value | `gateway_schema.authValue` — used directly for `user_managed`; `platform_managed` reads from `INTEGRATIONS_API_KEY` env var |
| Content-Type | `gateway_schema.contentType` (`"form"` or `"json"`) |
| Parameters | `context` → `### Parameters` block |
| Response shape | `context` → `### Response` block |
| Return codes | `context` → 返回码说明 block |
| Billing price | `plugin_billing_configs.original_price` / `discount_price` |

---

## Appendix A — Media Resource Transfer to Supabase Storage

**When to apply:** The API returns image / video / audio URLs (e.g. an image generation task that
returns `imageUrl`, a TTS API that returns an audio file URL, a video synthesis API). These
third-party URLs are ephemeral and must be transferred to Supabase Storage for persistence.

**Where to put this code:** In the Edge Function, after receiving the upstream response and
before returning to the client. Call `streamMediaToStorage` with the URL and return the
`publicUrl` instead of the raw third-party URL.

**Required env vars (already available in Edge Functions):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Stream a remote media resource (image / video / audio) directly into Supabase Storage.
 * Supports: image/*, video/*, audio/*, application/octet-stream
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
  upsert = false
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl); // validate format

    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const isAllowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream";

    if (!isAllowed) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Derive extension from content-type for cleaner filenames
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    return { success: true, path: data.path, publicUrl: urlData.publicUrl, contentType };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

**Usage in Edge Function (after getting the upstream result):**

```typescript
// Replace ephemeral third-party URL with persistent Supabase URL
const transfer = await streamMediaToStorage(
  upstreamData.imageUrl,   // or audioUrl / videoUrl
  "generated-media",       // your bucket name
);
if (!transfer.success) throw new Error(`Storage transfer failed: ${transfer.error}`);

return new Response(
  JSON.stringify({ ...upstreamData, imageUrl: transfer.publicUrl }),
  { status: 200, headers: { "Content-Type": "application/json" } }
);
```

---

## Appendix C — Generation-Time Media Download (生成期文件下载)

**When to apply:** The API returns image / video / audio URLs (or Base64 data) and the skill has
a **生成期用法（Agent 直接调用）** section. This appendix is the generation-time counterpart to
Appendix A — Appendix A handles the Edge Function side; this appendix handles the Agent side.

Include the following block verbatim at the end of the 生成期用法 section, after the generation
function code. Adjust the URL field name (`imageUrl` / `videoUrl` / `download_url` / etc.) and the
expiry note to match the actual API.

### Standard case — API returns a URL

```markdown
**生成期文件下载（必须执行）：**

生成接口返回的 URL 是 CDN 临时链接，在生成期（Agent 直接调用场景）获得 URL 后，**必须立即使用 Bash 工具将文件下载到本地**，以便用户查看结果。

\`\`\`bash
curl -L -o <本地路径> "<生成的文件 URL>"
\`\`\`

**完整生成期工作流（含下载步骤）：**

1. 调用生成函数获取文件 URL
2. 使用 Bash 工具执行 `curl -L -o <本地路径> "<url>"` 将文件下载到本地
3. 告知用户文件已保存到对应路径

> **注意**：上游 CDN 链接有时效性，应在获得 URL 后立即下载，不要延迟。
```

**Expiry customization** — replace the generic note with the actual expiry if known:
- 30 days → `上游 CDN 链接 30 天后失效`
- 24 hours → `上游 CDN 链接有效期 24 小时`
- 1 hour → `download_url 有效期仅 1 小时，必须在获得 URL 后立即下载`

### Special case — API returns Base64 (no URL)

When the API embeds the media directly in the response as Base64 (e.g. Gemini image editing),
use the `base64 -d` pattern instead:

```markdown
**生成期文件保存（必须执行）：**

本接口直接返回 **Base64 编码的媒体数据**（不含 URL），在生成期获得 Base64 数据后，**必须立即使用 Bash 工具将其解码并保存到本地**，以便用户查看结果。

\`\`\`bash
echo "<base64_data>" | base64 -d > <本地路径>.<ext>
\`\`\`

**完整生成期工作流（含保存步骤）：**

1. 从响应中提取 Base64 数据字段
2. 使用 Bash 工具将 Base64 解码并保存：`echo "<base64>" | base64 -d > <本地路径>.<ext>`
3. 告知用户文件已保存到对应路径

> **注意**：Base64 数据仅存在于当次响应中，必须及时保存，否则数据丢失。
```


**When to apply:** The upstream API streams its response (Server-Sent Events or chunked JSON).
Examples: LLM text generation, real-time transcription, live translation.

**Edge Function side:** Forward the upstream stream directly; do not buffer.

```typescript
// Edge Function: proxy a streaming upstream response
const upstream = await fetch("https://<api_id>@<gateway_schema.url host+path>", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Gateway-Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify(requestBody),
});

if (!upstream.ok || !upstream.body) {
  return new Response(JSON.stringify({ error: "Upstream error" }), { status: 502 });
}

// Stream through directly — do not await upstream.json()
return new Response(upstream.body, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  },
});
```

**Frontend dependencies:**

```bash
npm install ky@^1.2.3 eventsource-parser@^3.0.3
# optional markdown rendering for streamed text:
npm install streamdown@^1.4.0
```

**Core SSE utilities (put in `lib/sse.ts` or inline):**

```typescript
import ky, { type AfterResponseHook } from "ky";
import { createParser } from "eventsource-parser";

export interface SSEOptions {
  onData: (data: string) => void;
  onEvent?: (event: unknown) => void;
  onCompleted?: (error?: Error) => void;
  onAborted?: () => void;
}

export function createSSEHook(options: SSEOptions): AfterResponseHook {
  return async (request, _opts, response) => {
    if (!response.ok || !response.body) return;

    let done = false;
    const finish = (err?: Error) => { if (!done) { done = true; options.onCompleted?.(err); } };

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf8");
    const parser = createParser({
      onEvent: (event) => {
        if (!event.data) return;
        options.onEvent?.(event);
        for (const chunk of event.data.split("\n")) options.onData(chunk);
      },
    });

    const read = (): void => {
      reader.read().then(({ done: streamDone, value }) => {
        if (streamDone) { finish(); return; }
        parser.feed(decoder.decode(value, { stream: true }));
        read();
      }).catch((err) => {
        if (request.signal.aborted) { options.onAborted?.(); return; }
        finish(err as Error);
      });
    };
    read();
    return response;
  };
}

export interface StreamRequestOptions {
  functionUrl: string;
  requestBody: unknown;
  supabaseAnonKey: string;
  onData: (data: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export async function sendStreamRequest(options: StreamRequestOptions): Promise<void> {
  const { functionUrl, requestBody, supabaseAnonKey, onData, onComplete, onError, signal } = options;

  const sseHook = createSSEHook({
    onData,
    onCompleted: (err) => (err ? onError(err) : onComplete()),
    onAborted: () => console.log("Stream aborted"),
  });

  try {
    await ky.post(functionUrl, {
      json: requestBody,
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      signal,
      hooks: { afterResponse: [sseHook] },
    });
  } catch (err) {
    if (!signal?.aborted) onError(err as Error);
  }
}
```

**Frontend usage:**

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Accumulate streamed text (e.g. chat reply)
const [content, setContent] = useState("");
const abortRef = useRef<AbortController | null>(null);

abortRef.current = new AbortController();

await sendStreamRequest({
  functionUrl: `${supabaseUrl}/functions/v1/<your-function>`,
  requestBody: { /* API-specific params */ },
  supabaseAnonKey,
  onData: (data) => {
    try {
      const parsed = JSON.parse(data);
      // Adapt to actual response format:
      // { content: "..." }  →  parsed.content
      // { delta: "..." }    →  parsed.delta
      // { choices: [{ delta: { content: "..." } }] }  →  parsed.choices?.[0]?.delta?.content
      const chunk = parsed.content ?? parsed.delta ?? "";
      setContent((prev) => prev + chunk);
    } catch { /* incomplete chunk, skip */ }
  },
  onComplete: () => console.log("Stream complete"),
  onError: (err) => console.error("Stream error:", err),
  signal: abortRef.current.signal,
});

// Cancel mid-stream
abortRef.current?.abort();
```

**Optional: Markdown rendering for streamed text**

```typescript
import { Streamdown } from "streamdown";

<Streamdown parseIncompleteMarkdown isAnimating={!isStreamComplete}>
  {content}
</Streamdown>
```

