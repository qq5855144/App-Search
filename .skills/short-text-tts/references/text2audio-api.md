# text2audio API — 百度短文本在线合成

## API 基本信息

| 字段 | 值 |
|------|-----|
| Plugin ID | `37acada7-121e-4016-a1e5-d3cbbf53d6b2` |
| API ID | `api-e94GZ5j0ljja` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio` |
| 认证模式 | `platform_managed` |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-party Domain | `app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com` |
| 响应格式 | 二进制音频流（`application/octet-stream`） |
| 支持平台 | Web、MiniProgram、App |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `tex` | string | 是 | — | 合成的文本内容，需 URL encode，长度不超过 500 个汉字 |
| `cuid` | string | 是 | — | 用户唯一标识，建议使用设备 MAC 地址或 IMEI |
| `ctp` | string | 是 | — | 客户端类型，web 端固定值为 `"1"` |
| `aue` | integer | 是 | — | 音频格式：`3` = MP3，`6` = WAV |
| `per` | integer | 否 | `0` | 发音人：`0`=度小美，`1`=度小宇，`3`=度逍遥，`4`=度丫丫 |
| `spd` | integer | 否 | `5` | 语速，取值 0–15 |
| `pit` | integer | 否 | `5` | 音调，取值 0–15 |
| `vol` | integer | 否 | `5` | 音量：基础音库 0–9，精品音库 0–15 |
| `audio_ctrl` | string | 否 | — | 音频控制参数，如采样率控制 |

---

## 响应结构

### 成功响应（200）

| 字段 | 类型 | 说明 |
|------|------|------|
| （响应体） | `ArrayBuffer` | 二进制音频流 |
| `Content-Type` | — | `application/octet-stream`（aue=3 或 aue=6 均如此） |

成功时响应体为纯二进制流，无 JSON 结构。

### 错误响应（非 200 或业务错误）

| 字段 | 类型 | 说明 |
|------|------|------|
| `sn` | string | 请求 ID，用于问题排查 |
| `err_no` | integer | 错误码，如 `501`=参数错误 |
| `err_msg` | string | 错误描述 |
| `idx` | integer | 错误位置索引 |

```json
{
  "sn": "abcdefgh12345678",
  "err_no": 501,
  "err_msg": "parameter error",
  "idx": 1
}
```

---

## 生成期代码

直接在 Deno 脚本中调用上游 API，获取音频并保存为文件：

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

/**
 * 调用百度短文本在线合成接口，返回音频二进制数据。
 * @param text - 要合成的文本，长度不超过 500 个汉字
 * @param options - 可选参数：发音人、语速、音调、音量、音频格式
 * @returns 音频 ArrayBuffer
 */
async function callTextToAudio(
  text: string,
  options: {
    per?: number;
    spd?: number;
    pit?: number;
    vol?: number;
    aue?: number;
  } = {}
): Promise<ArrayBuffer> {
  const params = new URLSearchParams({
    tex: encodeURIComponent(text),
    cuid: "app",
    ctp: "1",
    aue: String(options.aue ?? 3),
    per: String(options.per ?? 0),
    spd: String(options.spd ?? 5),
    pit: String(options.pit ?? 5),
    vol: String(options.vol ?? 5),
  });

  const response = await fetch("https://app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    // 业务错误时返回 JSON
    const err = await response.json();
    throw new Error(`API error ${err.err_no}: ${err.err_msg}`);
  }

  return await response.arrayBuffer();
}

// 使用示例
const audioBuffer = await callTextToAudio("百度你好", { per: 0, spd: 5 });
await Deno.writeFile("output.mp3", new Uint8Array(audioBuffer));
console.log("音频已保存到 output.mp3");
```

---

## Edge Function（Web 平台）

Web 平台的 Edge Function **直接返回二进制流**，前端必须用原生 `fetch + resp.blob()`。

> **CRITICAL**：`supabase.functions.invoke` 会把二进制响应误解析为 JSON，产生损坏音频，Web 端严禁使用。

```typescript
// edge-functions/tts-short-web.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求体 ---
  let text: string;
  let per: number = 0;
  let spd: number = 5;
  let pit: number = 5;
  let vol: number = 5;
  let aue: number = 3;
  try {
    const body = await req.json();
    text = body.text;
    if (!text) throw new Error("Missing text");
    if (body.per !== undefined) per = Number(body.per);
    if (body.spd !== undefined) spd = Number(body.spd);
    if (body.pit !== undefined) pit = Number(body.pit);
    if (body.vol !== undefined) vol = Number(body.vol);
    if (body.aue !== undefined) aue = Number(body.aue);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const params = new URLSearchParams({
    tex: encodeURIComponent(text),
    cuid: "app",
    ctp: "1",
    aue: String(aue),
    per: String(per),
    spd: String(spd),
    pit: String(pit),
    vol: String(vol),
  });

  const upstream = await fetch("https://app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: params.toString(),
  });

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

  // 检查是否业务错误（返回 JSON）
  const contentType = upstream.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const err = await upstream.json();
    return new Response(JSON.stringify({ error: `API error ${err.err_no}: ${err.err_msg}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 直接返回二进制流给 Web 前端
  const audioBuffer = await upstream.arrayBuffer();
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
    },
  });
});
```

---

## Edge Function（MiniProgram 平台）

MiniProgram 的 Edge Function **将二进制转为 base64 JSON**，因为 `supabase.functions.invoke` 在 weapp 中不支持 `.blob()`。

> **CRITICAL**：禁止使用 `btoa(String.fromCharCode(...new Uint8Array(buffer)))` 展开写法——大数组会因为 call stack 过深抛 `RangeError`（音频 > ~64KB 即会触发）。必须使用分块循环。

```typescript
// edge-functions/tts-short-miniprogram.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求体 ---
  let text: string;
  let per: number = 0;
  let spd: number = 5;
  let pit: number = 5;
  let vol: number = 5;
  let aue: number = 3;
  try {
    const body = await req.json();
    text = body.text;
    if (!text) throw new Error("Missing text");
    if (body.per !== undefined) per = Number(body.per);
    if (body.spd !== undefined) spd = Number(body.spd);
    if (body.pit !== undefined) pit = Number(body.pit);
    if (body.vol !== undefined) vol = Number(body.vol);
    if (body.aue !== undefined) aue = Number(body.aue);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥 ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 ---
  const params = new URLSearchParams({
    tex: encodeURIComponent(text),
    cuid: "app",
    ctp: "1",
    aue: String(aue),
    per: String(per),
    spd: String(spd),
    pit: String(pit),
    vol: String(vol),
  });

  const upstream = await fetch("https://app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: params.toString(),
  });

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

  // 检查是否业务错误（返回 JSON）
  const contentType = upstream.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const err = await upstream.json();
    return new Response(JSON.stringify({ error: `API error ${err.err_no}: ${err.err_msg}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 分块 base64 编码（禁止展开写法，大数组会 RangeError）
  const audioBuffer = await upstream.arrayBuffer();
  const audioArray = new Uint8Array(audioBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < audioArray.length; i += chunkSize) {
    binary += String.fromCharCode(...audioArray.subarray(i, i + chunkSize));
  }
  const audioBase64 = btoa(binary);

  return new Response(JSON.stringify({ audioBase64 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## Edge Function（App 平台）

App 平台的 Edge Function **使用 GET 接口、query 参数传参、直接返回二进制流**，配合 `expo-audio` 的 `useAudioPlayer` 实现流式播放，无需 base64 转换。

> **依赖安装**：`npx expo install expo-audio`（或 `pnpm add expo-audio`）

```typescript
// edge-functions/tts-short-app.ts（Deno）
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const text = url.searchParams.get("text") ?? "";
  const per  = Number(url.searchParams.get("per")  ?? "0");

  const auth = `Bearer ${Deno.env.get("INTEGRATIONS_API_KEY")}`;

  return fetch("https://app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": auth,
    },
    body: new URLSearchParams({
      tex: encodeURIComponent(text),
      cuid: "app",
      ctp: "1",
      aue: "3",
      per: String(per),
      spd: "5",
      pit: "5",
      vol: "5",
    }),
  });
});
```

---

## 前端调用代码

### Web 前端

**必须用原生 `fetch + resp.blob()`**，禁止用 `supabase.functions.invoke`（SDK 会把二进制响应误解析为 JSON）：

```typescript
/**
 * 调用 TTS Edge Function（Web 平台），合成音频并自动播放。
 * @param text - 要合成的文本
 * @param options - 可选参数：发音人、语速等
 */
async function playTextToSpeech(
  text: string,
  options: { per?: number; spd?: number; pit?: number; vol?: number } = {}
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  // CRITICAL: 必须用原生 fetch + blob()，supabase.functions.invoke 会误解析二进制为 JSON
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-short-web`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ text, ...options }),
    }
  );

  if (resp.status === 429) {
    const err = await resp.json();
    throw new Error(`配额已用尽：${err.message ?? resp.statusText}`);
  }
  if (resp.status === 402) {
    const err = await resp.json();
    throw new Error(`余额不足：${err.message ?? resp.statusText}`);
  }
  if (!resp.ok) throw new Error(`请求失败：${resp.status}`);

  const blob = await resp.blob(); // 必须用 blob()，不可用 resp.json()
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  audio.onended = () => URL.revokeObjectURL(audioUrl);
  audio.play();
}
```

### MiniProgram 前端（Taro）

**必须使用两步 UI**：先生成存储 base64，再由用户点击"播放"触发。

> **CRITICAL**：`await` 后直接调用 `audio.play()` 会被 H5 自动播放策略静默拦截（无报错、无 toast），必须拆分为两次独立用户手势。

> **CRITICAL（weapp 真机）**：`InnerAudioContext` 在真机上不接受 `data:` URI，会抛 `INNERERRCODE:-1100`，必须先将 base64 写入临时文件，再用本地文件路径播放。

```typescript
import { useState } from "react";
import Taro from "@tarojs/taro";

// ---- 状态定义 ----
const [audioBase64, setAudioBase64] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);

/**
 * 步骤 1：点"生成"按钮，调用 Edge Function 获取 base64，不自动播放。
 * @param text - 要合成的文本
 */
const handleGenerate = async (text: string): Promise<void> => {
  setIsLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke("tts-short-miniprogram", {
      body: { text },
    });
    if (error) throw error;
    setAudioBase64(data.audioBase64); // 存储，不播放
  } finally {
    setIsLoading(false);
  }
};

/**
 * 步骤 2：点"播放"按钮（全新用户手势），根据平台选择播放方式。
 * - H5：data URI 可用
 * - weapp 真机：必须写临时文件，data URI 会抛 INNERERRCODE:-1100
 */
const handlePlay = async (): Promise<void> => {
  if (!audioBase64) return;

  const audio = Taro.createInnerAudioContext();

  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    // H5：data URI 可用
    audio.src = `data:audio/mp3;base64,${audioBase64}`;
  } else {
    // weapp 真机：必须写临时文件，data URI 无效
    const fs = Taro.getFileSystemManager();
    const tempFilePath = `${Taro.env.USER_DATA_PATH}/temp_audio_${Date.now()}.mp3`;
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath: tempFilePath,
        data: audioBase64,
        encoding: "base64",
        success: () => resolve(),
        fail: (err) => reject(new Error(JSON.stringify(err))),
      });
    });
    audio.src = tempFilePath;
  }

  audio.play();
};
```

### App 前端（Expo / React Native）

**使用 `expo-audio` 的 `useAudioPlayer`**，直接将 Edge Function URL 作为音频源，无需 base64，边请求边缓冲播放。

> **CRITICAL**：`player.replace({ uri })` 之前若正在播放，需先调用 `player.pause()` 再替换，否则可能出现双轨并播。

```typescript
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useState } from "react";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

// 在组件顶层创建播放器实例（无需初始 source）
const player = useAudioPlayerStatus(player);

// 订阅播放状态，驱动 UI（playing / duration / currentTime 等）
const playerStatus = useAudioPlayerStatus(player);

/**
 * 调用 TTS Edge Function（App 平台），合成音频并流式播放。
 * @param text - 要合成的文本
 * @param selectedVoice - 发音人 per 值（0/1/3/4）
 */
const handleConvert = async (text: string, selectedVoice: number = 0): Promise<void> => {
  // 若当前正在播放（如上一次转换结果），先暂停再替换
  if (playerStatus.playing) player.pause();

  // 替换音频源为新的 TTS 流式接口 URL
  // encodeURIComponent 确保中文等特殊字符正确编码
  player.replace({
    uri: `${supabaseUrl}/functions/v1/tts-short-app?text=${encodeURIComponent(text.trim())}&per=${selectedVoice}`,
  });

  // 立即开始播放，expo-audio 会边请求边缓冲，无需等待完整下载
  player.play();
};
```

### 密钥安全
- `INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端或客户端代码中。

### 计费
- 计费信息以平台实际配置为准
- 每次调用均计费，避免重复生成相同内容（建议客户端缓存已生成的音频）。

### 错误处理
- 务必处理 `429`（配额超限）和 `402`（余额不足），将友好提示展示给用户。
- 成功时响应体为纯二进制流；若 `Content-Type` 为 `application/json`，则说明发生了业务错误，需解析 `err_no` / `err_msg`。

### 平台差异（Web vs MiniProgram vs App）
- **Web**：Edge Function 返回二进制流，前端必须用原生 `fetch + resp.blob()`，**禁止** `supabase.functions.invoke`。
- **MiniProgram**：Edge Function 必须返回 base64 JSON；前端必须两步 UI；weapp 真机必须写临时文件后再播放。
- **App（Expo）**：Edge Function 使用 GET 接口、query 传参、直接返回二进制流；前端用 `expo-audio` 的 `useAudioPlayer`，`player.replace({ uri })` 直接传 URL，流式边请求边缓冲播放，无需 base64 转换。

### 编码
- `tex` 参数需 URL encode（使用 `encodeURIComponent`），Edge Function 中已处理，前端传原始字符串即可。

### 音色选项
| per 值 | 发音人 |
|--------|--------|
| `0` | 度小美（默认） |
| `1` | 度小宇 |
| `3` | 度逍遥 |
| `4` | 度丫丫 |
