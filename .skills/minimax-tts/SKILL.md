---
name: minimax-tts
description: 使用 MiniMax 将文本转换为高质量语音音频，支持多音色、情绪、语速等控制，适用于有声内容、语音助手、游戏配音等场景
license: MIT
---

## 能力概述

基于 MiniMax T2A V2 接口，将文本同步合成为语音音频。支持中文、英文、日文等多种语言，提供系统音色与自定义音色，可控制语速、音量、语调、情绪等参数，还支持停顿标记、语气词标签、发音字典、LaTeX 朗读、混合音色、声音效果器等高级特性。

| 项目 | 值 |
|------|----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-DLEO7Bj0lORa-gateway.appmiaoda.com/v1/t2a_v2` |
| 认证方式 | platform_managed（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| 响应格式 | JSON（`data.audio` 默认为 hex 编码音频；设置 `output_format: "url"` 可获取 CDN URL） |
| 计费单价 | 原价 ¥3.60 / 次，优惠价 ¥2.50 / 次 |

### 平台差异说明

| 平台 | 推荐方案 | 原因 |
|------|---------|------|
| Web | `output_format: "url"` + `supabase.functions.invoke` 或原生 `fetch`，获取 `audioUrl` 后赋给 `new Audio().src` | 通过 Edge Function 返回 CDN URL，直接播放，无需 base64 转换 |
| MiniProgram | `output_format: "url"` + `supabase.functions.invoke`，获取 `audioUrl` 后赋给 `Taro.createInnerAudioContext().src` | weapp 不支持 `btoa`；CDN URL 可直接赋给 `audio.src` |
| App | `output_format: "url"` + `supabase.functions.invoke`，获取 `audioUrl` 后通过 `expo-audio` 的 `useAudioPlayer` 播放 | 使用 `player.replace({ uri: audioUrl })` + `player.play()` 播放，三端一致 |

> 详细参数表、Edge Function 代码、前端代码见 [references/t2a-v2-api.md](references/t2a-v2-api.md)

---

## 生成期用法（Agent 直接调用）

直接在 Deno 脚本中调用 MiniMax T2A V2 接口，使用平台注入的密钥。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

async function callMinimaxTTS(
  text: string,
  voiceId: string = "male-qn-qingse",
  model: string = "speech-02-turbo",
  outputFormat: "url" | "hex" = "url",
): Promise<{ audioUrl: string; audioLength: number; usageCharacters: number }> {
  const response = await fetch("https://app-cblk1rqa5fk1-api-DLEO7Bj0lORa-gateway.appmiaoda.com/v1/t2a_v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      text,
      stream: false,
      output_format: outputFormat,
      voice_setting: { voice_id: voiceId, speed: 1, vol: 1 },
      audio_setting: { format: "mp3" },
    }),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.base_resp?.status_code !== 0) {
    throw new Error(`API error ${json.base_resp?.status_code}: ${json.base_resp?.status_msg}`);
  }

  return {
    audioUrl: json.data.audio,                        // CDN URL（output_format: "url" 时）
    audioLength: json.extra_info?.audio_length ?? 0,
    usageCharacters: json.extra_info?.usage_characters ?? 0,
  };
}
```

> 完整参数列表、高级用法（混合音色、声音效果器、发音字典等）见 [references/t2a-v2-api.md](references/t2a-v2-api.md)

---

## 生成后用法（应用内通过 Edge Function 调用）

在应用中通过 Supabase Edge Function 调用 MiniMax TTS，平台密钥由 Edge Function 注入，客户端不接触原始 API Key。

**Web 与 MiniProgram 实现存在差异**，请根据目标平台选择对应的 Edge Function 和前端代码：

| 平台 | Edge Function | 返回值 | 前端播放方式 |
|------|--------------|--------|------------|
| Web / MiniProgram 通用 | `tts-minimax` | `{ audioUrl: string }` | 直接将 `audioUrl` 赋给 `<audio>.src` 或 `InnerAudioContext.src` |

> 完整 Edge Function 代码、Web 前端代码、MiniProgram 前端代码见 [references/t2a-v2-api.md](references/t2a-v2-api.md)
