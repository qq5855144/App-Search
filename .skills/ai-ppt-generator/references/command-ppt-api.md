# AI 生成 PPT 接口（command-ppt）

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `104b3752-acf1-49dd-813b-b207b360d977` |
| API ID | `api-l9nZz8ro3my9` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-l9nZz8ro3my9-gateway.appmiaoda.com/v2/tools/ai_command_ppt/command_ppt` |
| 认证模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer <INTEGRATIONS_API_KEY>` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-l9nZz8ro3my9-gateway.appmiaoda.com` |
| 响应形式 | 流式（chunked JSON 行） |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `query` | string | 是 | 输入要生成 PPT 的主题内容，例如"帮我写一篇关于大模型的 ppt" |

可选 Header：

| Header | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `X-Appbuilder-Request-Id` | string | 否 | 建议填写 UUID 格式，方便后续链路问题排查 |

---

## 响应字段表

上游为流式返回，每行是一个独立的 JSON 字符串。

### 构建阶段（`result_type=1`）

每行外层 JSON 字段：

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `errno` | number | 错误码，0 表示成功 |
| `errMsg` | string | 错误描述 |
| `type` | number | 消息类型 |
| `data.result` | string | JSON 字符串，含 `title`（当前累积标题）和 `result`（当前累积大纲/outline） |
| `data.result_type` | number | 1 = 构建中 |
| `data.need_clear_history` | bool | 风控标志，正常为 false |
| `data.flag` | number | 风控标志，正常为 0 |
| `data.thought_type` | string | 生成阶段标识，大纲阶段值为 `tt_genppt_outline` |
| `requestId` | string | 请求 ID |

`data.result` 解析后字段（构建阶段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 当前累积的 PPT 标题（summary） |
| `result` | string | 当前累积的 PPT 大纲内容（outline），以 `\n` 分隔的纯文本 |

### 完成阶段（`result_type=0`）

`data.result` 解析后字段（完成阶段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 空字符串（最终标题从构建阶段最后一条消息获取） |
| `result` | string | 空字符串（完整大纲/outline 从构建阶段最后一条消息获取） |
| `cover_urls` | string[] | 封面图片 URL 列表（cover），通常为 3 张，URL 含有效期签名 |
| `ppt_url` | string | PPT 下载链接（slides 文件），有效期 45 天；URL 中 `\u0026` 需替换为 `&` |

> **字段对应关系**：客户端侧常用字段名与 API 原始字段名的映射：
> - `outline`（大纲）→ 构建阶段 `data.result.result`（最后一条 result_type=1 消息）
> - `summary` / `title`（标题）→ 构建阶段 `data.result.title`（最后一条 result_type=1 消息）
> - `cover` / `coverUrls`（封面）→ 完成阶段 `data.result.cover_urls`
> - `slides` / `pptUrl`（PPT 文件）→ 完成阶段 `data.result.ppt_url`

### 异常响应

上游异常时，响应体中 `errno` 不为 0，或 HTTP 状态码为 4xx/5xx：

| 字段 | 类型 | 说明 |
|------|------|------|
| `errno` | number | 错误码，非 0 表示异常 |
| `errMsg` | string | 错误描述 |
| `requestId` / `requestID` | string | 请求 ID |
| `code` | string | 部分异常响应中返回，0 表示成功，其他为异常 |
| `message` | string | 错误消息 |
| `detail` | any? | 异常详情信息 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface PptBuildChunk {
  title: string;
  result: string;
}

interface PptFinalResult {
  title: string;
  outline: string;
  coverUrls: string[];
  pptUrl: string;
}

/**
 * 根据主题生成 PPT，消费完整流式响应后返回最终结果。
 *
 * @param query - PPT 主题内容
 * @returns PPT 标题、大纲、封面 URL 列表和下载链接
 */
async function generatePpt(query: string): Promise<PptFinalResult> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-l9nZz8ro3my9-gateway.appmiaoda.com/v2/tools/ai_command_ppt/command_ppt",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  if (!response.body) throw new Error("Empty response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let lastBuildChunk: PptBuildChunk = { title: "", result: "" };
  let finalCoverUrls: string[] = [];
  let finalPptUrl = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // 保留最后一段不完整行

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let outer: Record<string, unknown>;
      try {
        outer = JSON.parse(trimmed);
      } catch {
        continue; // 非 JSON 行跳过
      }

      const data = outer["data"] as Record<string, unknown> | undefined;
      if (!data) continue;

      const resultStr = data["result"] as string | undefined;
      const resultType = data["result_type"] as number | undefined;
      if (!resultStr) continue;

      let inner: Record<string, unknown>;
      try {
        inner = JSON.parse(resultStr);
      } catch {
        continue;
      }

      if (resultType === 1) {
        // 构建阶段：保存最新累积的标题和大纲
        lastBuildChunk = {
          title: (inner["title"] as string) ?? lastBuildChunk.title,
          result: (inner["result"] as string) ?? lastBuildChunk.result,
        };
      } else if (resultType === 0) {
        // 完成阶段：取封面和下载链接
        finalCoverUrls = (inner["cover_urls"] as string[]) ?? [];
        // ppt_url 中 \u0026 已被 JSON.parse 还原为 &，无需额外替换
        finalPptUrl = (inner["ppt_url"] as string) ?? "";
      }
    }
  }

  if (!finalPptUrl) throw new Error("未获取到 PPT 下载链接，生成可能失败");

  return {
    title: lastBuildChunk.title,
    outline: lastBuildChunk.result,
    coverUrls: finalCoverUrls,
    pptUrl: finalPptUrl,
  };
}

// 示例调用
const result = await generatePpt("帮我写一篇关于大模型的 ppt");
console.log("标题：", result.title);
console.log("大纲：", result.outline);
console.log("封面：", result.coverUrls);
console.log("下载链接：", result.pptUrl);
```

---

## Edge Function 代码

本 API 为流式响应，Edge Function 负责：
1. 消费上游所有流式 JSON 行
2. 将 `cover_urls` 中的封面图转存到 Supabase Storage（封面 URL 含有效期签名，需持久化）
3. `ppt_url` 直接透传（有效期 45 天，无需转存）
4. 以标准 JSON 一次性返回给前端

### Web 平台 Edge Function

```typescript
// edge-functions/ai-ppt-generator.ts（Web 平台）
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 将远端媒体 URL 转存到 Supabase Storage，返回持久化公开 URL。
 *
 * @param mediaUrl - 原始媒体 URL（含临时签名）
 * @param bucketName - Supabase Storage bucket 名称
 * @returns 成功时返回 publicUrl；失败时返回错误信息
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    new URL(mediaUrl);
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let query: string;
  try {
    const body = await req.json();
    query = body.query;
    if (!query || typeof query !== "string") throw new Error("Missing query");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给客户端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游（流式） ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-l9nZz8ro3my9-gateway.appmiaoda.com/v2/tools/ai_command_ppt/command_ppt",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query }),
    }
  );

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 消费流式响应 ---
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let lastTitle = "";
  let lastOutline = "";
  let rawCoverUrls: string[] = [];
  let rawPptUrl = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let outer: Record<string, unknown>;
      try {
        outer = JSON.parse(trimmed);
      } catch {
        continue;
      }

      const data = outer["data"] as Record<string, unknown> | undefined;
      if (!data) continue;

      const resultStr = data["result"] as string | undefined;
      const resultType = data["result_type"] as number | undefined;
      if (!resultStr) continue;

      let inner: Record<string, unknown>;
      try {
        inner = JSON.parse(resultStr);
      } catch {
        continue;
      }

      if (resultType === 1) {
        if (inner["title"]) lastTitle = inner["title"] as string;
        if (inner["result"]) lastOutline = inner["result"] as string;
      } else if (resultType === 0) {
        rawCoverUrls = (inner["cover_urls"] as string[]) ?? [];
        rawPptUrl = (inner["ppt_url"] as string) ?? "";
      }
    }
  }

  if (!rawPptUrl) {
    return new Response(
      JSON.stringify({ error: "PPT 生成失败，未收到下载链接" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 转存封面图到 Supabase Storage ---
  const coverPublicUrls: string[] = [];
  for (const coverUrl of rawCoverUrls) {
    const transfer = await streamMediaToStorage(coverUrl, "generated-media");
    if (transfer.success) {
      coverPublicUrls.push(transfer.publicUrl);
    } else {
      // 转存失败时退回原 URL（有时效限制），并记录警告
      console.warn(`封面图转存失败：${transfer.error}`);
      coverPublicUrls.push(coverUrl);
    }
  }

  return new Response(
    JSON.stringify({
      title: lastTitle,
      outline: lastOutline,
      coverUrls: coverPublicUrls,
      pptUrl: rawPptUrl,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

### MiniProgram 平台 Edge Function

MiniProgram 平台与 Web 平台的 Edge Function 实现完全相同（均返回 JSON，不涉及二进制流），
可以共用同一个 Edge Function 部署。

---

## 前端调用代码

### Web 平台（React / TypeScript）

```typescript
interface PptResult {
  title: string;
  outline: string;
  coverUrls: string[];
  pptUrl: string;
}

/**
 * 调用 Edge Function 生成 PPT，返回标题、大纲、封面 URL 列表和下载链接。
 *
 * @param query - PPT 主题内容
 * @returns PptResult
 */
async function generatePpt(query: string): Promise<PptResult> {
  const { data, error } = await supabase.functions.invoke("ai-ppt-generator", {
    body: { query },
  });
  if (error) throw error;
  if (!data?.pptUrl) throw new Error("未获取到 PPT 下载链接");
  return data as PptResult;
}

// React 组件示例
function PptGenerator() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PptResult | null>(null);

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await generatePpt(query);
      setResult(res);
    } catch (err) {
      console.error("PPT 生成失败：", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入 PPT 主题" />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "生成中..." : "生成 PPT"}
      </button>
      {result && (
        <div>
          <h3>{result.title}</h3>
          <pre>{result.outline}</pre>
          <div>
            {result.coverUrls.map((url, i) => (
              <img key={i} src={url} alt={`封面 ${i + 1}`} style={{ width: 200, marginRight: 8 }} />
            ))}
          </div>
          <a href={result.pptUrl} download>下载 PPT</a>
        </div>
      )}
    </div>
  );
}
```

### MiniProgram 平台（Taro / TypeScript）

```typescript
import Taro from "@tarojs/taro";

interface PptResult {
  title: string;
  outline: string;
  coverUrls: string[];
  pptUrl: string;
}

/**
 * 调用 Edge Function 生成 PPT（MiniProgram 平台）。
 *
 * @param query - PPT 主题内容
 * @returns PptResult
 */
async function generatePptMiniProgram(query: string): Promise<PptResult> {
  const { data, error } = await supabase.functions.invoke("ai-ppt-generator", {
    body: { query },
  });
  if (error) throw error;
  if (!data?.pptUrl) throw new Error("未获取到 PPT 下载链接");
  return data as PptResult;
}

// Taro 组件示例
function PptGeneratorPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PptResult | null>(null);

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await generatePptMiniProgram(query);
      setResult(res);
    } catch (err) {
      Taro.showToast({ title: "生成失败，请重试", icon: "none" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.pptUrl) return;
    // 小程序内通过 webview 或系统浏览器打开下载链接
    Taro.setClipboardData({ data: result.pptUrl }).then(() => {
      Taro.showToast({ title: "下载链接已复制", icon: "success" });
    });
  };

  return (
    <View>
      <Input value={query} onInput={(e) => setQuery(e.detail.value)} placeholder="输入 PPT 主题" />
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? "生成中..." : "生成 PPT"}
      </Button>
      {result && (
        <View>
          <Text>{result.title}</Text>
          <Text>{result.outline}</Text>
          <View>
            {result.coverUrls.map((url, i) => (
              <Image key={i} src={url} style="width: 200px; height: 150px; margin: 4px;" />
            ))}
          </View>
          <Button onClick={handleDownload}>复制 PPT 下载链接</Button>
        </View>
      )}
    </View>
  );
}
```

---

## 注意事项

### 密钥安全

- `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get("INTEGRATIONS_API_KEY")` 读取，严禁暴露到前端代码或客户端环境变量。

### 计费

- 原始单价：**150.00 元 / 千次**，优惠价：**125 元 / 千次**（`enable_billing: true`）。
- 每次调用生成一份 PPT，请避免因前端误操作触发重复调用，建议调用期间禁用生成按钮。

### 错误处理

- 务必处理 `429`（配额超限）和 `402`（余额不足），Edge Function 已将这两类错误原文转发给前端。
- 若 `ppt_url` 为空，表示上游生成失败，需向用户提示并允许重试。

### ppt_url 下载

- `ppt_url` 原始值中含 `\u0026`（转义的 `&`），经 `JSON.parse` 后会自动还原为 `&`，无需手动替换。
- 下载链接有效期 **45 天**，若需长期保存建议在服务端另行归档。

### 封面图持久化

- `cover_urls` 中的封面图 URL 含签名有效期，Edge Function 已通过 Supabase Storage 转存为持久化 URL。
- 转存失败时（网络抖动等），会退回原 URL 并打印警告，此时封面图可能在有效期后失效。

### 流式响应处理

- 上游为 chunked JSON 行（非 SSE），每行是一个独立 JSON 对象，需逐行解析。
- 关键数据：构建阶段（`result_type=1`）保存最后一条消息的 `title` 和 `result`；完成阶段（`result_type=0`）取 `cover_urls` 和 `ppt_url`。
- `data.result` 是嵌套的 JSON 字符串，需两次 `JSON.parse`。

### Supabase Storage

- 封面图转存需要 `generated-media` bucket 已创建且为 public（或按需设置访问策略）。
- Edge Function 使用 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`（平台自动注入，无需手动配置）。
