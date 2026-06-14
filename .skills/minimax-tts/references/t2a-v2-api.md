# MiniMax 同步语音合成 API（T2A V2）

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `8d92b0a6-f201-4e7e-bc38-b7e65d0e28d5` |
| API ID | `api-DLEO7Bj0lORa` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO7Bj0lORa-gateway.appmiaoda.com/v1/t2a_v2` |
| 备用地址 | `https://api-DLEO7Bj0lORa@api-bj.minimaxi.com/v1/t2a_v2` |
| 认证方式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/json` |
| third_part_domain | `app-cblk1rqa5fk1-api-DLEO7Bj0lORa-gateway.appmiaoda.com` |
| 计费 | 原价 ¥3.60 / 次，优惠价 ¥2.50 / 次 |

---

## 请求参数表

### 顶层参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `model` | string | 是 | — | 模型版本：`speech-2.8-hd`, `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo`, `speech-02-hd`, `speech-02-turbo`, `speech-01-hd`, `speech-01-turbo` |
| `text` | string | 是 | — | 合成文本，长度 < 10000 字符；支持停顿标记 `<#x#>`（x 为秒数）；`speech-2.8` 系列支持语气词标签如 `(laughs)`, `(chuckle)` 等 |
| `stream` | boolean | 否 | false | 是否流式输出 |
| `stream_options` | object | 否 | — | 流式选项，见下表 |
| `voice_setting` | object | 否 | — | 音色设置，见下表 |
| `audio_setting` | object | 否 | — | 音频设置，见下表 |
| `pronunciation_dict` | object | 否 | — | 发音字典，见下表 |
| `timber_weights` | array | 否 | — | 混合音色权重配置，见下表 |
| `language_boost` | string | 否 | null | 语言识别增强：`Chinese`, `English`, `Japanese` 等，或 `auto` |
| `voice_modify` | object | 否 | — | 声音效果器，见下表 |
| `subtitle_enable` | boolean | 否 | false | 是否开启字幕（仅非流式有效，仅 speech-2.6/speech-02/speech-01 系列） |
| `output_format` | string | 否 | `hex` | 输出格式：`url`（CDN URL，有效期 24h）或 `hex`（hex 编码音频）；仅非流式生效 |
| `aigc_watermark` | boolean | 否 | false | 是否添加音频节奏标识（仅非流式生效） |
| `continuous_sound` | boolean | 否 | false | 子句衔接自然化（仅 `speech-2.8-hd` / `speech-2.8-turbo`） |

### `stream_options` 对象

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `exclude_aggregated_audio` | boolean | 否 | false | 最后一个 chunk 是否包含拼接后的完整音频 hex |

### `voice_setting` 对象

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `voice_id` | string | 是 | — | 音色 ID（系统音色示例：`male-qn-qingse`，中文：`Chinese (Mandarin)_Lyrical_Voice`，英文：`English_Graceful_Lady` 等） |
| `speed` | number | 否 | 1.0 | 语速，范围 [0.5, 2] |
| `vol` | number | 否 | 1.0 | 音量，范围 (0, 10] |
| `pitch` | integer | 否 | 0 | 语调，范围 [-12, 12] |
| `emotion` | string | 否 | — | 情绪：`happy`, `sad`, `angry`, `fearful`, `disgusted`, `surprised`, `calm`, `fluent`, `whisper`（仅 speech-2.6/speech-02/speech-01；`fluent`/`whisper` 仅 speech-2.6） |
| `text_normalization` | boolean | 否 | false | 是否启用文本规范化（提升数字场景，略增延迟） |
| `latex_read` | boolean | 否 | false | 是否朗读 LaTeX 公式（仅中文；开启后 `language_boost` 强制为 `Chinese`；公式需用 `$$` 包裹） |

### `audio_setting` 对象

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `sample_rate` | integer | 否 | 32000 | 采样率：8000, 16000, 22050, 24000, 32000, 44100 |
| `bitrate` | integer | 否 | 128000 | 比特率：32000, 64000, 128000, 256000（仅 mp3 格式） |
| `format` | string | 否 | `mp3` | 音频格式：`mp3`, `pcm`, `flac`, `wav`（`wav` 仅非流式） |
| `channel` | integer | 否 | 1 | 声道数：1（单声道）, 2（双声道） |
| `force_cbr` | boolean | 否 | false | 恒定比特率（仅流式 + mp3 格式生效） |

### `pronunciation_dict` 对象

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `tone` | array\<string\> | 否 | 特殊注音规则，示例：`["处理/(chu3)(li3)", "危险/dangerous", "燕少飞/(yan4)(shao3)(fei1)"]` |

### `timber_weights` 数组元素

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `voice_id` | string | 是 | 音色 ID |
| `weight` | integer | 是 | 权重，范围 [1, 100]；最多 4 种音色混合 |

### `voice_modify` 对象

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `pitch` | integer | 否 | 音高调整（低沉/明亮），范围 [-100, 100] |
| `intensity` | integer | 否 | 强度调整（力量感/柔和），范围 [-100, 100] |
| `timbre` | integer | 否 | 音色调整（磁性/清脆），范围 [-100, 100] |
| `sound_effects` | string | 否 | 音效：`spacious_echo`（空旷回音）, `auditorium_echo`（礼堂广播）, `lofi_telephone`（电话失真）, `robotic`（电音） |

---

## 响应字段表

### 成功响应（`base_resp.status_code = 0`）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `data.audio` | string | 音频数据（`output_format: "hex"` 时为 hex 编码；`output_format: "url"` 时为 CDN URL，有效期 24h） |
| `data.subtitle_file` | string? | 字幕下载链接（启用 `subtitle_enable` 时返回） |
| `data.status` | integer | 1 = 合成中，2 = 合成结束 |
| `extra_info.audio_length` | integer | 音频时长（毫秒） |
| `extra_info.audio_sample_rate` | integer | 采样率 |
| `extra_info.audio_size` | integer | 文件大小（字节） |
| `extra_info.bitrate` | integer | 比特率 |
| `extra_info.audio_format` | string | 音频格式（mp3 / pcm / flac） |
| `extra_info.audio_channel` | integer | 声道数 |
| `extra_info.invisible_character_ratio` | number | 非法字符占比（超过 10% 时报错） |
| `extra_info.usage_characters` | integer | 计费字符数 |
| `extra_info.word_count` | integer | 已发音字数（汉字、数字、字母，不含标点） |
| `trace_id` | string | 会话 ID，用于问题定位 |
| `base_resp.status_code` | integer | 状态码（见下表） |
| `base_resp.status_msg` | string | 状态详情 |

### 错误状态码

| status_code | 说明 |
|-------------|------|
| 0 | 成功 |
| 1000 | 未知错误 |
| 1001 | 超时 |
| 1002 | 触发限流 |
| 1004 | 鉴权失败 |
| 1039 | 触发 TPM 限流 |
| 1042 | 非法字符超过 10% |
| 2013 | 输入参数信息不正常 |

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface VoiceSetting {
  voice_id: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised" | "calm" | "fluent" | "whisper";
  text_normalization?: boolean;
  latex_read?: boolean;
}

interface AudioSetting {
  sample_rate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100;
  bitrate?: 32000 | 64000 | 128000 | 256000;
  format?: "mp3" | "pcm" | "flac" | "wav";
  channel?: 1 | 2;
  force_cbr?: boolean;
}

interface TTSResult {
  audioUrl: string;        // CDN URL（output_format: "url"）或 hex 字符串
  audioLength: number;     // 音频时长（毫秒）
  usageCharacters: number; // 计费字符数
  traceId: string;
}

async function callMinimaxTTS(
  text: string,
  options: {
    model?: string;
    outputFormat?: "url" | "hex";
    stream?: boolean;
    voiceSetting?: VoiceSetting;
    audioSetting?: AudioSetting;
    pronunciationDict?: { tone?: string[] };
    languageBoost?: string;
    continuousSound?: boolean;
    subtitleEnable?: boolean;
  } = {},
): Promise<TTSResult> {
  const {
    model = "speech-02-turbo",
    outputFormat = "url",
    stream = false,
    voiceSetting = { voice_id: "male-qn-qingse", speed: 1, vol: 1 },
    audioSetting = { format: "mp3" },
    pronunciationDict,
    languageBoost,
    continuousSound,
    subtitleEnable,
  } = options;

  const body: Record<string, unknown> = {
    model,
    text,
    stream,
    output_format: outputFormat,
    voice_setting: voiceSetting,
    audio_setting: audioSetting,
  };

  if (pronunciationDict) body.pronunciation_dict = pronunciationDict;
  if (languageBoost) body.language_boost = languageBoost;
  if (continuousSound !== undefined) body.continuous_sound = continuousSound;
  if (subtitleEnable !== undefined) body.subtitle_enable = subtitleEnable;

  const response = await fetch("https://app-cblk1rqa5fk1-api-DLEO7Bj0lORa-gateway.appmiaoda.com/v1/t2a_v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }

  return {
    audioUrl: json.data.audio,
    audioLength: json.extra_info?.audio_length ?? 0,
    usageCharacters: json.extra_info?.usage_characters ?? 0,
    traceId: json.trace_id,
  };
}

// 使用示例
const result = await callMinimaxTTS("今天是不是很开心呀(laughs)，当然了！", {
  model: "speech-2.8-hd",
  outputFormat: "url",
  voiceSetting: {
    voice_id: "male-qn-qingse",
    speed: 1,
    vol: 1,
    pitch: 0,
    emotion: "happy",
  },
  audioSetting: {
    sample_rate: 32000,
    bitrate: 128000,
    format: "mp3",
    channel: 1,
  },
});
console.log("Audio URL:", result.audioUrl);
console.log("Duration:", result.audioLength, "ms");
console.log("Billed characters:", result.usageCharacters);
```

---

## Edge Function 代码

> **关键实现约束（来自 examples[]）：**
> MiniMax TTS 默认返回 hex 编码音频，`btoa` 在 weapp 中不可用。
> 因此**无论 Web 还是 MiniProgram，Edge Function 均应设置 `output_format: "url"`**，
> 直接获取 CDN URL 返回给前端，前端将 URL 赋给 `audio.src` 即可播放，无需 base64 转换。

```typescript
// edge-functions/tts-minimax.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * 将远程音频 URL 转存至 Supabase Storage，返回持久化公开 URL。
 * @param mediaUrl - 临时 CDN 音频 URL
 * @param bucketName - 目标 Storage bucket 名称
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl);
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    const isAllowed =
      contentType.startsWith("audio/") ||
      contentType.startsWith("video/") ||
      contentType === "application/octet-stream";
    if (!isAllowed) throw new Error(`Unsupported content type: ${contentType}`);
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp3";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, path: data.path, publicUrl: urlData.publicUrl, contentType };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let text: string;
  let voiceId: string;
  let model: string;
  let speed: number | undefined;
  let vol: number | undefined;
  let pitch: number | undefined;
  let emotion: string | undefined;
  let audioFormat: string;

  try {
    const body = await req.json();
    text = body.text;
    if (!text) throw new Error("Missing text");
    voiceId = body.voice_id ?? "male-qn-qingse";
    model = body.model ?? "speech-02-turbo";
    speed = body.speed;
    vol = body.vol;
    pitch = body.pitch;
    emotion = body.emotion;
    audioFormat = body.audio_format ?? "mp3";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 构造请求体（output_format: "url" 返回 CDN URL，Web/weapp 均可直接播放）---
  const voiceSetting: Record<string, unknown> = { voice_id: voiceId };
  if (speed !== undefined) voiceSetting.speed = speed;
  if (vol !== undefined) voiceSetting.vol = vol;
  if (pitch !== undefined) voiceSetting.pitch = pitch;
  if (emotion !== undefined) voiceSetting.emotion = emotion;

  const requestBody = {
    model,
    text,
    stream: false,
    output_format: "url",       // 关键：返回 CDN URL 而非 hex，weapp 无需 btoa
    voice_setting: voiceSetting,
    audio_setting: { format: audioFormat },
  };

  // --- 调用上游 ---
  const upstream = await fetch("https://app-cblk1rqa5fk1-api-DLEO7Bj0lORa-gateway.appmiaoda.com/v1/t2a_v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const result = await upstream.json();

  if (result.base_resp?.status_code !== 0) {
    return new Response(
      JSON.stringify({
        error: `TTS error ${result.base_resp?.status_code}: ${result.base_resp?.status_msg}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // data.audio 是临时 CDN URL（output_format: "url" 时，24 小时内有效）
  const rawAudioUrl = result.data?.audio;
  const extraInfo = result.extra_info ?? {};

  // 转存至 Supabase Storage，获取持久化 URL
  let audioUrl = rawAudioUrl;
  if (rawAudioUrl) {
    const stored = await streamMediaToStorage(rawAudioUrl, "generated-audio");
    if (stored.success) {
      audioUrl = stored.publicUrl;
    }
    // 转存失败时 fallback 到原始 CDN URL（24h 内仍可用）
  }

  return new Response(
    JSON.stringify({
      audioUrl,
      audioLength: extraInfo.audio_length,
      usageCharacters: extraInfo.usage_characters,
      audioFormat: extraInfo.audio_format,
      traceId: result.trace_id,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
```

---

## 前端调用代码

### Web 平台（React / Next.js）

```typescript
// 推荐方式：使用 supabase client
async function generateSpeech(
  text: string,
  voiceId: string = "male-qn-qingse",
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("tts-minimax", {
    body: { text, voice_id: voiceId },
  });
  if (error) throw error;
  if (!data?.audioUrl) throw new Error("未返回音频 URL");
  return data.audioUrl;  // https://...aliyuncs.com/...
}

// 前端播放（Web）
const audioUrl = await generateSpeech("欢迎使用语音合成服务");
const audio = new Audio(audioUrl);
audio.play();
```

```typescript
// 备用方式：无 supabase client 时
async function generateSpeech(text: string, voiceId: string = "male-qn-qingse"): Promise<string> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-minimax`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id: voiceId }),
    },
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
  if (!json.audioUrl) throw new Error("未返回音频 URL");
  return json.audioUrl;
}
```

### MiniProgram 平台（Taro）

> **来自 examples[] 的关键约束：**
> MiniMax TTS 默认返回 hex 编码音频（`data.audio` 是 hex 字符串），`btoa` 在 weapp 中不可用。
> 务必在 Edge Function 中设置 `output_format: "url"`，使 API 返回 CDN `https://` URL，
> 然后直接将该 URL 赋给 `audio.src`，Web 端和 weapp 端均可播放，无需任何 base64 转换。

```typescript
import Taro from "@tarojs/taro";

// 步骤 1：点"生成"按钮，获取 CDN URL
const handleGenerate = async () => {
  try {
    const { data, error } = await supabase.functions.invoke("tts-minimax", {
      body: {
        text: inputText,
        voice_id: "male-qn-qingse",
        model: "speech-02-turbo",
      },
    });
    if (error) throw error;
    const audioUrl = data.audioUrl;  // https://...aliyuncs.com/...（CDN URL）
    setAudioUrl(audioUrl);
    console.log("音频 URL 已获取，点击播放按钮播放");
  } catch (err) {
    console.error("生成失败：", err);
  }
};

// 步骤 2：点"播放"按钮（需要全新用户手势，不可在 await 后自动调用 play()）
const handlePlay = () => {
  if (!audioUrl) return;
  const audio = Taro.createInnerAudioContext();
  // CDN URL 在 weapp 真机和 H5 均可直接使用，无需写临时文件
  audio.src = audioUrl;
  audio.onError((err) => console.error("播放失败：", err));
  audio.play();
};
```

### App 平台（Expo）

依赖安装：

```bash
npx expo install expo-audio
```

- `expo-audio`：Expo 官方音频库，`useAudioPlayer` 原生支持 URI 播放，三端（iOS / Android / Web）一致

```tsx
import { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '@/client/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function TTSApp() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 创建播放器实例（无需初始 source）
  const player = useAudioPlayer();
  // 订阅播放状态，驱动 UI（playing / duration / currentTime 等）
  const playerStatus = useAudioPlayerStatus(player);

  /** 方式一：通过 supabase.functions.invoke 获取 CDN URL 后播放 */
  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('tts-minimax', {
        body: { text: text.trim(), voice_id: 'male-qn-qingse', model: 'speech-02-turbo' },
      });
      if (error) throw error;
      if (!data?.audioUrl) throw new Error('未返回音频 URL');

      // 若当前正在播放，先暂停再替换
      if (playerStatus.playing) player.pause();
      player.replace({ uri: data.audioUrl });
      player.play();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '转换失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /** 方式二：直接用 Edge Function URL 流式播放（无需等完整下载） */
  const handleStreamPlay = () => {
    if (!text.trim()) return;
    setErrorMsg('');

    if (playerStatus.playing) player.pause();
    // expo-audio 会边请求边缓冲，无需等待完整下载
    player.replace({
      uri: `${supabaseUrl}/functions/v1/tts-minimax?text=${encodeURIComponent(text.trim())}&voice_id=male-qn-qingse&model=speech-02-turbo`,
    });
    player.play();
  };

  return (
    <View>
      <TextInput value={text} onChangeText={setText} placeholder="输入要合成的文字" multiline />
      <Button title={loading ? '生成中...' : '生成并播放'} onPress={handleGenerate} disabled={loading} />
      {playerStatus.playing && <Text>播放中 {Math.round(playerStatus.currentTime)}s / {Math.round(playerStatus.duration)}s</Text>}
      {errorMsg ? <Text style={{ color: 'red' }}>{errorMsg}</Text> : null}
    </View>
  );
}
```

**CRITICAL 注意事项（App 平台）：**

- 使用 `expo-audio` 的 `useAudioPlayer` + `useAudioPlayerStatus` 管理音频播放
- `player.replace({ uri })` + `player.play()` 播放，`expo-audio` 自动处理缓冲
- Edge Function 必须设置 `output_format: "url"` 返回 CDN URL，App 端直接播放该 URL
- 若需要流式边下边播，可直接将 Edge Function URL 传给 `player.replace({ uri })`，`expo-audio` 会自动边请求边播放

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。

2. **output_format 选择**：
   - 默认 `hex` 模式：`data.audio` 是 hex 字符串，Web 端需手动 decode，**weapp 端 `btoa` 不可用**，处理复杂。
   - 推荐 `url` 模式：`data.audio` 是 CDN URL（有效期 24 小时），Web 和 weapp 均可直接赋给 `audio.src` 播放，无需任何转换。

3. **weapp 自动播放限制**：在 weapp / H5 中，`await` 异步操作后调用 `audio.play()` 可能被浏览器策略静默拦截。务必将"播放"拆成独立的用户手势（两步 UI）。

4. **计费**：每次调用按字符计费（`extra_info.usage_characters`），原价 ¥3.60 / 次，优惠价 ¥2.50 / 次。请做好前端防抖，避免重复触发。

5. **错误处理**：务必处理 429（配额超限）和 402（余额不足），以及 `base_resp.status_code !== 0` 的业务错误。

6. **模型选择**：
   - `speech-2.8-hd` / `speech-2.8-turbo`：支持语气词标签和 `continuous_sound`，音质最高。
   - `speech-02-turbo`：延迟低，性价比高，适合实时场景。
   - 文本 > 3000 字符时推荐使用流式输出（`stream: true`）。

7. **非法字符**：非法字符占比超过 10% 时接口返回 `status_code: 1042` 并报错；不超过 10% 时正常生成并在 `extra_info.invisible_character_ratio` 中返回占比。
