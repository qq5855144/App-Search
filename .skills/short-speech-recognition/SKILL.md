---
name: short-speech-recognition
description: 将60秒以内的语音文件（wav/m4a）识别为文字，适用于语音输入、语音指令、语音搜索等短语音交互场景。
license: MIT
---

## 能力概述

**短语音识别标准版 API**：将60秒以内的语音精准识别为文字，支持 wav（不压缩 PCM 编码）和 m4a（压缩格式）两种格式。

| 属性 | 值 |
|------|-----|
| Endpoint | `https://app-cblk1rqa5fk1-api-Aa2PZnjEw5NL-gateway.appmiaoda.com/server_api` |
| Method | POST |
| Content-Type | application/json |
| Plugin ID | `4ce92d6c-eb93-4c59-be9c-7f265903e2c8` |
| API ID | `api-Aa2PZnjEw5NL` |
| 认证模式 | platform_managed（密钥由平台注入） |

Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**核心约束：**
- 语音文件需进行 base64 编码后作为请求体中的 `speech` 字段传输
- 采样率支持 16000 或 8000（8000 仅支持普通话模型）
- 编码要求：16bit 位深单声道
- 最大时长：60 秒
- Web 录音时 MediaRecorder 默认产出 `audio/webm`，需转换为 `audio/wav` 后再 base64 编码
- MiniProgram 支持直接上传 `x-m4a` 格式
- App（expo-audio）录音直接产出 `m4a` 格式，无需转换

**平台说明：**

| 平台 | 录音格式 | 转换要求 |
|------|---------|---------|
| Web | audio/webm（MediaRecorder 默认） | 需转换为 audio/wav，采样率 16000 |
| MiniProgram | audio/x-m4a（原生录音） | 无需转换，直接 base64 编码 |
| App | audio/m4a（expo-audio） | 无需转换，录音时指定 16000Hz 单声道 |

**响应示例：**
```json
{
  "corpus_no": "6433214037620997779",
  "err_no": 0,
  "err_msg": "success.",
  "sn": "371191073711497849365",
  "result": ["北京科技馆"]
}
```

详细参数表和响应字段说明见 `references/server-api.md`。

---

## 生成期用法（Agent 直接调用）

通过平台注入的 `INTEGRATIONS_API_KEY` 直接调用上游 API，适用于 Agent 在生成阶段处理语音数据。

详见 `references/server-api.md` → **生成期代码** 章节。

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内通过 Supabase Edge Function 调用，Edge Function 负责注入密钥，前端不直接接触 `INTEGRATIONS_API_KEY`。

各平台的前端实现差异：

| 差异点 | Web | MiniProgram | App |
|--------|-----|-------------|-----|
| 录音格式 | audio/webm → 需转为 wav | audio/x-m4a → 直接用 | audio/m4a → 直接 base64 |
| 采样率设置 | 录音时指定 16000 | 录音时指定 16000 | 录音时指定 16000 |
| 调用方式 | `supabase.functions.invoke` | `supabase.functions.invoke` | `supabase.functions.invoke` |

详见 `references/server-api.md` → **Edge Function 代码** 和 **前端调用代码** 章节。
