---
name: image-generation-super
description: 图片生成与编辑（超级版），调用 GPT-Image-2 模型生成和编辑图片。需要 AI 画图、生成图片、编辑图片、多图融合、背景替换、风格转换、电商商品图合成、海报设计、插画创作时优先使用该工具。纯像素操作（文字叠加、加水印、裁剪、缩放）请改用 Pillow，不要触发本工具。
license: MIT
---

## 能力概述

调用 GPT-Image-2 模型进行 AI 图像生成与编辑，支持通过自然语言描述生成高质量图片，以及上传多张图片进行 AI 编辑融合。

| 属性 | 值 |
|------|-----|
| Plugin ID | `e480d4b6-835c-45f8-a494-d38da962b394` |
| 认证模式 | `platform_managed`（密钥由平台注入） |
| 密钥来源 | `process.env["INTEGRATIONS_API_KEY"]` |
| Auth Header | `X-Gateway-Authorization: Bearer <key>` |
| 支持平台 | Web、MiniProgram |
| 响应格式 | SSE 流（`text/event-stream`），心跳保活 + 最终结果事件中 Base64 编码内嵌于 `data[].b64_json` |

**接口列表：**

| 接口 | 方法 | Endpoint | 说明 |
|------|------|----------|------|
| 创建图片 | POST | `http://app-cblk1rqa5fk1-api-wLNdpny6ZpVa-gateway.appmiaoda.com/v1/images/generations` | 根据文本描述生成图片 |
| 编辑图片 | POST | `http://app-cblk1rqa5fk1-api-baBw3XMNVmv9-gateway.appmiaoda.com/v1/images/edits` | 上传 1–3 张图片进行 AI 编辑融合 |

**核心能力：**

- **文生图**：通过 `prompt` 描述生成全新图片，支持多种尺寸和数量配置
- **多图编辑**：上传 1–3 张图片，通过文本描述控制融合、背景替换、风格统一、局部重绘等效果
- **提示词优化**：接口返回 `revised_prompt`，展示模型自动优化后的提示词

**平台差异概览：**

| 平台 | Edge Function 返回 | 前端获取图片方式 |
|------|-------------------|----------------|
| Web（创建图片） | SSE 流式响应（心跳 + 结果） | 用 `fetch` + `getReader()` 消费 SSE 流，收到 `type: "result"` 事件后解析 |
| Web（编辑图片） | SSE 流式响应（心跳 + 结果） | 用 `fetch` + `getReader()` 消费 SSE 流，收到 `type: "result"` 事件后解析 |
| MiniProgram | JSON（含 Base64） | 解析 JSON，写临时文件后用 `<image>` 组件展示 |

详细参数说明、代码示例及两平台完整实现见：
- `references/image-generations-api.md` — 创建图片接口
- `references/image-edits-api.md` — 编辑图片接口

---

## 使用前决策

调用本工具前，先判断场景是否真的需要 AI 生成：

| 场景 | 推荐方案 |
|------|---------|
| 根据文字描述生成全新图片 | ✅ 本工具（文生图） |
| 上传图片 + 提示词做风格转换或内容编辑 | ✅ 本工具（图生图） |
| 多张图片融合 / 背景替换 / 海报合成 | ✅ 本工具（多图编辑） |
| 在图片上叠加文字 / 水印 | ❌ 改用 Pillow（速度快、可离线） |
| 裁剪、缩放、格式转换、像素级操作 | ❌ 改用 Pillow |
| 图片内容审核 / 质量评分 | ❌ 改用视觉模型直接分析，无需生成 |

---

## Prompt 编写规范

底层模型（GPT-Image-2）对英文提示词的理解和图像质量通常优于中文，请优先将用户需求改写为英文后再提交 API。

**写作原则：**
- 使用描述句，直接描述目标画面，而非告诉模型"帮我生成……"
- 具体优于抽象：`"a ginger cat sitting in a sunlit garden"` 好于 `"可爱的猫"`
- 避免否定词：不写 `"no background"`，改写 `"isolated on pure white background"`
- 末尾加质量修饰词提升细节：`high quality`, `detailed`, `8k`, `photorealistic`

**文生图模板：**

```
[Subject], [Action/Pose/State], [Scene/Environment], [Lighting], [Style], [Quality]
```

示例：
```
A golden retriever puppy, sitting and looking up curiously, in a cozy living room with warm afternoon lighting, watercolor illustration style, high quality, detailed
```

**图生图 / 多图编辑额外建议：**
- 先描述希望**保留**的内容，再描述希望**改变**的内容
- 风格迁移时明确目标风格，例如 `"convert to anime style"` 或 `"oil painting style"`
- 多图融合时说明图片之间的关系，例如 `"use image 1 as background, place the product from image 2 in the center"`

---

## 生成期用法（Agent 直接调用）

> **在调用 API 之前，先将用户需求翻译/改写为英文提示词**，GPT-Image-2 模型对英文输入的图像质量明显优于中文。

两个接口均为同步调用，直接返回 Base64 编码图片数据，不含 URL。获得响应后必须立即将 Base64 解码保存为图片文件。

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface CreateImageResult {
  created: number;
  data: Array<{
    b64_json: string;
    revised_prompt: string;
  }>;
  background: string;
  output_format: string;
  quality: string;
  size: string;
  model: string;
}

/** 创建图片（文生图） */
async function createImage(
  prompt: string,
  size?: string,
  n?: number
): Promise<CreateImageResult> {
  const response = await fetch(
    "http://app-cblk1rqa5fk1-api-wLNdpny6ZpVa-gateway.appmiaoda.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        size,
        n,
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(`API error: ${JSON.stringify(json.error)}`);
  return json;
}

interface EditImageResult {
  created: number;
  data: Array<{
    b64_json: string;
    revised_prompt: string;
  }>;
  background: string;
  output_format: string;
  quality: string;
  size: string;
  model: string;
  usage?: {
    input_tokens: number;
    input_tokens_details: { image_tokens: number; text_tokens: number };
    output_tokens: number;
    output_tokens_details: { image_tokens: number; text_tokens: number };
    total_tokens: number;
  };
}

/** 编辑图片（多图融合/编辑） */
async function editImage(
  prompt: string,
  images: File[],
  size?: string,
  n?: number
): Promise<EditImageResult> {
  const formData = new FormData();
  formData.append("model", "gpt-image-2");
  formData.append("prompt", prompt);
  if (size) formData.append("size", size);
  if (n) formData.append("n", String(n));
  images.forEach((file, index) => {
    formData.append(`image[${index}]`, file);
  });

  const response = await fetch(
    "http://app-cblk1rqa5fk1-api-wLNdpny6ZpVa-gateway.appmiaoda.com/v1/images/edits",
    {
      method: "POST",
      headers: {
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(`API error: ${JSON.stringify(json.error)}`);
  return json;
}
```

**生成期文件保存（必须执行）：**

两个接口均返回 Base64 编码图片，数据仅存在于当次响应中。获得 Base64 后，**必须立即使用 Bash 工具将其解码并保存到本地**，以便用户查看结果。

```bash
echo "<base64_data>" | base64 -d > <本地路径>.png
```

**完整生成期工作流（含保存步骤）：**

1. 根据用户需求选择对应接口（`createImage` 或 `editImage`）
2. 构造请求参数并调用接口获取响应
3. 从 `json.data[0].b64_json` 提取 Base64 数据
4. 使用 Bash 工具将 Base64 解码并保存：`echo "<b64_json>" | base64 -d > <本地路径>.png`
5. 告知用户文件已保存到对应路径，同时展示 `revised_prompt`

> **注意**：Base64 数据仅存在于当次响应中，必须及时保存，否则数据丢失。

**空间位置描述（生成期 Prompt 增强）：**

在提示词中加入空间位置词可显著提高构图准确性：

| 位置关键词 | 说明 | 示例 |
|-----------|------|------|
| `centered` / `in the center` | 主体居中 | `"a red rose, centered, white background"` |
| `in the top-left / bottom-right corner` | 角落定位 | `"logo in the top-left corner"` |
| `in the foreground / background` | 前景/背景层次 | `"flowers in the foreground, mountains in the background"` |
| `on the left side / right side` | 左右分布 | `"person on the left, product on the right"` |
| `filling the entire frame` | 占满画面 | `"texture filling the entire frame"` |

---

## 生成后用法（应用内通过 Edge Function 调用）

应用内通过 Edge Function 安全调用上游 API，密钥不暴露给前端。

**安全合约：**
- 前端只发送业务参数到 Edge Function，不接触 API Key
- Edge Function 从 `Deno.env.get("INTEGRATIONS_API_KEY")` 读取密钥
- 请求上游时注入 `X-Gateway-Authorization: Bearer ${apiKey}`
- `429`（配额超限）和 `402`（余额不足）错误体原样透传给前端
- 返回的 Base64 数据由前端接收并解码渲染

**Edge Function 实现：**
- `image-generations`：代理创建图片接口，处理 JSON 请求，解析 body 后强制注入 `body.model = "gpt-image-2"`，**采用 SSE 流式响应**，每 15 秒发送心跳事件防止中间路由超时断开连接，最终以 `type: "result"` 事件返回结果
- `image-edits`：代理编辑图片接口，**必须用 `req.formData()` 解析请求体**（不能用 `req.arrayBuffer()` 直接透传），检查并注入 `model` 字段（`formData.set("model", "gpt-image-2")`），然后**采用 SSE 流式响应**，每 15 秒发送心跳事件防止中间路由超时断开连接，最终以 `type: "result"` 事件返回结果

完整 Edge Function 代码和前端调用代码详见：
- `references/image-generations-api.md`（创建图片的 Edge Function + 前端代码）
- `references/image-edits-api.md`（编辑图片的 Edge Function + 前端代码）

---

## 参数说明

### 创建图片核心参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | `string` | 是 | 固定值：`gpt-image-2` |
| `prompt` | `string` | 是 | 图片生成描述词 |
| `size` | `string` | 否 | 输出尺寸：`1024x1024`、`1536x1024`、`1024x1536`、`2848x1152` |
| `n` | `integer` | 否 | 生成数量，默认 1 |

### 编辑图片核心参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | `string` | 是 | 固定值：`gpt-image-2` |
| `prompt` | `string` | 是 | 图片编辑描述词 |
| `size` | `string` | 否 | 输出尺寸 |
| `n` | `integer` | 否 | 输出数量，默认 1 |
| `image[0]` | `file` | 是 | 主图片文件 |
| `image[1]` | `file` | 否 | 附加图片文件 |
| `image[2]` | `file` | 否 | 附加图片文件 |

### 返回核心字段

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `created` | `number` | 创建时间戳 |
| `data` | `array` | 生成结果列表 |
| `data[].b64_json` | `string` | Base64 编码图片内容 |
| `data[].revised_prompt` | `string` | 模型自动优化后的提示词 |
| `usage` | `object` | Token 消耗统计（仅编辑接口返回） |

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端代码或客户端环境变量中。
- **Base64 数据及时保存**：两个接口均返回 Base64 编码图片，数据仅存在于当次响应中。生成期必须在获得响应后立即使用 Bash `base64 -d` 保存为文件。
- **文件上传限制**：编辑接口最多支持 3 张图片（`image[0]` 必填，`image[1]`、`image[2]` 可选），需确保图片格式和大小符合上游要求。
- **model 参数必传**：`model` 字段（值为 `gpt-image-2`）是上游网关路由的必要字段，缺失会导致 403。对于 `image-generations`，Edge Function 在解析 JSON body 后注入 `body.model = "gpt-image-2"`；对于 `image-edits`，Edge Function 在解析 FormData 后检查并补充 `model` 字段。**即使前端忘记传递 model，Edge Function 也必须兜底注入**，确保上游请求中始终包含该字段。
- **错误处理**：
  - `429` — 配额已用尽
  - `402` — 余额不足
  - `400` — 请求参数错误
  - `401` — 认证失败
- **计费**：本插件未启用计费（`enable_billing: false`），但仍需确保 API Key 有效且配额充足。

---

## 失败兜底

当生成质量不满足要求时，判断是否可以用 Pillow 完成：

**可降级到 Pillow 的场景：**
- 在图片上添加文字（标题、水印、标注）
- 在图片上叠加 Logo 或图标
- 裁剪、缩放、旋转、格式转换
- 调整亮度/对比度/饱和度

**Pillow 基础示例（生成期 Agent 可直接运行）：**

```python
from PIL import Image, ImageDraw, ImageFont

# 在图片上叠加文字水印
def add_text_watermark(image_path: str, text: str, output_path: str) -> None:
    img = Image.open(image_path).convert("RGBA")
    draw = ImageDraw.Draw(img)
    # 使用系统字体，或指定 .ttf 路径
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", size=36)
    except OSError:
        font = ImageFont.load_default()
    # 右下角绘制文字
    w, h = img.size
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((w - tw - 20, h - th - 20), text, fill=(255, 255, 255, 180), font=font)
    img.convert("RGB").save(output_path)

add_text_watermark("input.png", "© 2024 My Brand", "output.png")
```

**决策流程：**
1. 调用 AI 生成接口 → 如果成功且质量满意 → 完成
2. 如果返回 `error` 或 HTTP `429`（配额超限）/`402`（余额不足）→ 向用户说明错误
3. 如果用户需求属于纯像素操作 → 改用 Pillow
4. 如果需求超出 Pillow 能力（如真正的语义编辑）→ 向用户说明当前服务不可用并建议稍后重试

