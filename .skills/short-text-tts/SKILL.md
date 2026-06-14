---
name: short-text-tts
description: 将短文本（≤500汉字）合成为 MP3/WAV 音频；适用于语音通知、单词发音、语音播报等需要文字转语音的场景
license: MIT
---

## 能力概述

**百度短文本在线合成服务** — 将中英文混合短文本转换为可播放的音频文件。

| 项目 | 值 |
|------|-----|
| Endpoint | `POST https://app-cblk1rqa5fk1-api-e94GZ5j0ljja-gateway.appmiaoda.com/text2audio` |
| Content-Type | `application/x-www-form-urlencoded` |
| 认证 | `platform_managed`（`X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`） |
| 响应 | 二进制音频流（`application/octet-stream`），aue=3 为 MP3，aue=6 为 WAV |
| 文本长度限制 | 不超过 500 个汉字（需 URL encode） |
| 语言 | 中英文混合模式 |
| 计费 | 计费信息以平台实际配置为准 |

**支持平台：Web、MiniProgram、App（三套实现，差异显著）**

| 平台 | Edge Function 返回格式 | 前端调用方式 |
|------|----------------------|------------|
| Web | 直接返回二进制流（`audio/mpeg`） | 原生 `fetch + resp.blob()`，**禁止**用 `supabase.functions.invoke` |
| MiniProgram | 返回 base64 JSON（`{ audioBase64 }`） | `supabase.functions.invoke` + 两步 UI（生成 → 播放） |
| App | 直接返回二进制流（GET 接口，query 传参） | `expo-audio` 的 `useAudioPlayer`，`player.replace({ uri })` 直接传 URL，边请求边缓冲 |

> **关键差异说明**
> - **Web**：`supabase.functions.invoke` 会把二进制响应误解析为 JSON，产生损坏音频，必须用原生 `fetch + resp.blob()`。
> - **MiniProgram（weapp 真机）**：`InnerAudioContext` 不接受 `data:` URI（会抛 `INNERERRCODE:-1100`），必须先将 base64 写入临时文件再播放。
> - **H5 自动播放策略**：`await` 后调用 `audio.play()` 会被浏览器静默拦截，必须使用两步 UI（先生成存储 base64，再由用户点击"播放"触发全新手势）。
> - **App（Expo）**：`expo-audio` 的 `useAudioPlayer` 原生支持直接传 URL，边请求边缓冲播放，无需 base64 转换；Edge Function 使用 GET 接口通过 query 参数传参，支持流式返回。

---

## 生成期用法（Agent 直接调用）

直接调用上游 API，读取平台注入的密钥，同步返回二进制音频流。

详见 `references/text2audio-api.md` — **生成期代码** 小节。

---

## 生成后用法（应用内通过 Edge Function 调用）

需要为 Web 和 MiniProgram 分别部署不同的 Edge Function，前端调用方式也不同。

详见 `references/text2audio-api.md` — **Edge Function（Web 平台）**、**Edge Function（MiniProgram 平台）**、**Edge Function（App 平台）**、**前端调用代码** 各小节。
