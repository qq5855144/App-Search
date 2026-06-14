# 短语音识别标准版 API

## API 基本信息

| 属性 | 值 |
|------|-----|
| Plugin ID | `4ce92d6c-eb93-4c59-be9c-7f265903e2c8` |
| API ID | `api-Aa2PZnjEw5NL` |
| Endpoint | `https://app-cblk1rqa5fk1-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api` |
| 网关 URL（含 API ID 前缀） | `https://app-cblk1rqa5fk1-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api` |
| Method | POST |
| Content-Type | application/json |
| third_part_domain | `app-cblk1rqa5fk1-api-Aa2PZnjEw5NL-gateway.appmiaoda.com` |
| 认证模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| 密钥来源 | `Deno.env.get("INTEGRATIONS_API_KEY")!` |

---

## 请求参数表

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `format` | string | 是 | 语音文件格式，支持 `wav` / `m4a` |
| `rate` | integer | 是 | 采样率，支持 `16000` 或 `8000`（8000 仅支持普通话模型） |
| `cuid` | string | 是 | 用户唯一标识，建议使用 MAC 地址或 IMEI 码，长度 60 字符以内 |
| `speech` | string | 是 | 语音文件的 base64 编码数据 |
| `len` | integer | 是 | 语音文件字节数（编码前的原始字节数） |

---

## 响应字段表

### 成功响应（err_no = 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `corpus_no` | string | 语料编号，可用于反馈纠错 |
| `err_no` | integer | 错误码，`0` 表示成功 |
| `err_msg` | string | 错误描述，成功时为 `"success."` |
| `sn` | string | 请求序列号（用于日志追踪） |
| `result` | string[] | 识别结果数组，取 `result[0]` 作为最终文本 |

### 失败响应（err_no ≠ 0）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `err_no` | integer | 错误码（非 0） |
| `err_msg` | string | 错误描述 |
| `sn` | string | 请求序列号 |
| `result` | string[] | 识别结果（失败时通常为空数组） |

常见错误码：`3300`（输入参数不正确）、`3301`（音频质量过差）、`3302`（鉴权失败）、`3305`（pid 不存在）、`3307`（后台引擎服务忙，请重试）、`3308`（音频过长）。

---

## 生成期代码

在 Agent 生成阶段直接调用上游 API，密钥从平台环境变量读取。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface SpeechRecognitionResult {
  corpus_no: string;
  err_no: number;
  err_msg: string;
  sn: string;
  result: string[];
}

/**
 * 调用百度短语音识别标准版 API，将 base64 编码的语音数据识别为文字。
 *
 * @param speechBase64 - 语音文件的 base64 编码字符串
 * @param len - 语音文件的原始字节数（编码前）
 * @param format - 语音格式，"wav" 或 "m4a"，默认 "wav"
 * @param rate - 采样率，16000 或 8000，默认 16000
 * @param cuid - 用户唯一标识，默认使用固定占位符
 * @returns 识别结果对象
 */
async function callShortSpeechRecognition(
  speechBase64: string,
  len: number,
  format: "wav" | "m4a" = "wav",
  rate: 16000 | 8000 = 16000,
  cuid: string = "miaoda-agent-cuid"
): Promise<SpeechRecognitionResult> {
  const response = await fetch("https://app-cblk1rqa5fk1-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      format,
      rate,
      cuid,
      speech: speechBase64,
      len,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json: SpeechRecognitionResult = await response.json();
  if (json.err_no !== 0) {
    throw new Error(`API error ${json.err_no}: ${json.err_msg}`);
  }

  return json;
}

// 使用示例（Agent 生成阶段）：
// const result = await callShortSpeechRecognition(speechBase64, byteLength, "wav", 16000, "my-device-cuid");
// console.log("识别结果：", result.result[0]);
```

---

## Edge Function 代码

Edge Function 负责注入平台密钥并转发请求，前端不直接接触 `INTEGRATIONS_API_KEY`。

Web、MiniProgram 和 App 均可使用同一个 Edge Function，因为响应为标准 JSON（非二进制流）。

```typescript
// edge-functions/short-speech-recognition.ts
import { serve } from "https://deno.land/std/http/server.ts";

/**
 * Edge Function：短语音识别
 * 接收前端传来的 base64 编码语音数据，注入平台密钥后调用上游 API，
 * 并将识别结果 JSON 返回给前端。
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析请求体 ---
  let speech: string;
  let len: number;
  let format: string;
  let rate: number;
  let cuid: string;

  try {
    const body = await req.json();
    speech = body.speech;
    len = body.len;
    format = body.format ?? "wav";
    rate = body.rate ?? 16000;
    cuid = body.cuid ?? "miaoda-edge-cuid";

    if (!speech) throw new Error("Missing speech");
    if (typeof len !== "number" || len <= 0) throw new Error("Missing or invalid len");
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
  const upstream = await fetch("https://app-cblk1rqa5fk1-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ format, rate, cuid, speech, len }),
  });

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

## 前端调用代码

### Web 平台

Web 端录音时 MediaRecorder 默认产出 `audio/webm`，需先转换为 `audio/wav`（采样率 16000）再进行 base64 编码。

```typescript
/**
 * 将 Blob 转换为 base64 字符串。
 *
 * @param blob - 待转换的 Blob 对象
 * @returns base64 编码字符串（不含 data URL 前缀）
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]); // 去掉 data:audio/wav;base64, 前缀
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 调用 Edge Function 进行短语音识别（Web 端）。
 * 注意：录音格式需为 wav，采样率 16000，否则识别率会下降。
 *
 * @param wavBlob - 转换后的 wav 格式音频 Blob
 * @returns 识别出的文字
 */
async function recognizeSpeechWeb(wavBlob: Blob): Promise<string> {
  const speechBase64 = await blobToBase64(wavBlob);
  const len = wavBlob.size;

  const { data, error } = await supabase.functions.invoke("short-speech-recognition", {
    body: {
      speech: speechBase64,
      len,
      format: "wav",
      rate: 16000,
      cuid: "web-user-cuid",
    },
  });

  if (error) throw error;
  if (data.err_no !== 0) throw new Error(`识别失败 ${data.err_no}: ${data.err_msg}`);
  return data.result[0] ?? "";
}
```

### App 平台

App 端使用 `expo-audio` 录音，产出 `audio/m4a` 格式，录音时指定 16000Hz 单声道，无需额外格式转换。

**录音参数：**

```typescript
import { useAudioRecorder, setAudioModeAsync, requestRecordingPermissionsAsync, IOSOutputFormat, AudioQuality } from 'expo-audio';
import type { RecordingOptions } from 'expo-audio';

const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};
```

**录音 → 识别：**

```typescript
// 开始
await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
await recorder.prepareToRecordAsync();
recorder.record();

// 停止 → 转文字
await recorder.stop();
const transcript = await transcribeAudio(recorder.uri!);
```

**transcribeAudio 实现：**

```typescript
async function transcribeAudio(fileUri: string): Promise<string> {
  const fileResponse = await fetch(fileUri);
  const contentType = fileResponse.headers.get('content-type') ?? '';
  const rawBuffer = await fileResponse.arrayBuffer();

  const needsConversion = contentType.includes('webm') || fileUri.endsWith('.webm');
  const audioBuffer = needsConversion ? await convertToWav(rawBuffer) : rawBuffer;
  const format = needsConversion ? 'wav' : 'm4a';
  const len = audioBuffer.byteLength;
  const speech = arrayBufferToBase64(audioBuffer);

  const { data, error } = await supabase.functions.invoke('short-speech-recognition', {
    body: { speech, len, format, rate: 16000, cuid: 'app-user' },
  });

  if (error || data?.err_no !== 0) throw new Error(data?.err_msg || '语音识别失败');
  return data.result[0] ?? '';
}
```

**convertToWav（Web fallback 场景使用）：**

```typescript
async function convertToWav(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const pcm = audioBuffer.getChannelData(0);
  await audioCtx.close();

  const wav = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(wav);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return wav;
}
```

### MiniProgram 平台

MiniProgram 端原生录音产出 `audio/x-m4a` 格式，无需格式转换，直接读取文件内容并 base64 编码。

```typescript
/**
 * 调用 Edge Function 进行短语音识别（MiniProgram 端）。
 * 使用 Taro.getFileSystemManager 读取录音文件并转为 base64。
 *
 * @param m4aFilePath - 录音文件的临时路径（x-m4a 格式）
 * @returns 识别出的文字
 */
async function recognizeSpeechMiniProgram(m4aFilePath: string): Promise<string> {
  // 读取文件并获取 base64 和字节数
  const speechBase64: string = await new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath: m4aFilePath,
      encoding: "base64",
      success: (res) => resolve(res.data as string),
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });

  // 获取原始字节数（用于 len 参数）
  const fileInfo: Taro.getFileInfo.SuccessCallbackResult = await new Promise((resolve, reject) => {
    Taro.getFileSystemManager().getFileInfo({
      filePath: m4aFilePath,
      success: resolve,
      fail: (err) => reject(new Error(JSON.stringify(err))),
    });
  });

  const { data, error } = await supabase.functions.invoke("short-speech-recognition", {
    body: {
      speech: speechBase64,
      len: fileInfo.size,
      format: "m4a",
      rate: 16000,
      cuid: "miniprogram-user-cuid",
    },
  });

  if (error) throw error;
  if (data.err_no !== 0) throw new Error(`识别失败 ${data.err_no}: ${data.err_msg}`);
  return data.result[0] ?? "";
}
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端代码或客户端日志中。

2. **错误处理**：务必处理以下错误场景：
   - HTTP 429（配额超限）：提示用户稍后重试
   - HTTP 402（余额不足）：提示充值
   - `err_no !== 0`（业务错误）：根据错误码提示用户，常见原因包括音频质量差（3301）、格式不支持、时长超限

3. **计费**：
   - 计费信息以平台实际配置为准
   - 避免在循环或高频场景中重复调用，每次请求均计费

4. **录音格式转换（Web）**：
   - MediaRecorder 默认录制格式为 `audio/webm`，**必须**转换为 `audio/wav` 后才能传给此 API
   - 录音时需确保采样率设置为 16000 Hz
   - 推荐使用 `AudioContext` + `ScriptProcessorNode` 或第三方库（如 `lamejs`、`recordrtc`）完成格式转换

5. **len 参数**：传递的是语音文件**原始字节数**（即 `Blob.size`），不是 base64 字符串的长度。

6. **cuid 参数**：建议传入设备唯一标识（MAC 地址、设备 ID 等），用于问题排查和用量统计，长度不超过 60 字符。

7. **语音质量要求**：
   - 格式：wav（不压缩，PCM 编码）或 m4a
   - 位深：16bit，单声道
   - 时长：不超过 60 秒
   - 环境噪声过大会导致 `err_no: 3301`（音频质量过差）
