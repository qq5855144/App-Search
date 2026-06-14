---
name: driving-exam-questions
description: 驾考题库查询，获取科目一/科目四题目（含选项、答案、解析），支持按车型、章节、分页、随机排序筛选。适合驾考备考辅助和题目练习场景。
license: MIT
---

## 能力概述

查询驾驶员考试题库，覆盖科目一和科目四，支持按车型（A1/A2/A3/B1/B2/C1/C2/C3/D/E/F）、章节、排序方式进行筛选，提供分页功能。
每道题目包含完整题目文本、四个选项（判断题选项为空）、正确答案及答案解析，可选带题目图片。

- **Endpoint**: `POST https://app-cblk1rqa5fk1-api-o9wN0mk1DAPa-gateway.appmiaoda.com/driverexam/query`
- **认证**: platform_managed（密钥由平台注入）
- **响应格式**: JSON

**响应示例：**

```json
{
  "status": 0,
  "msg": "ok",
  "result": {
    "total": "950",
    "pagenum": "1",
    "pagesize": "3",
    "subject": "1",
    "type": "C1",
    "sort": "normal",
    "list": [
      {
        "question": "未取得驾驶证的学员在道路上学习驾驶技能，下列哪种做法是正确的？",
        "option1": "A、使用所学车型的教练车由教练员随车指导",
        "option2": "B、使用所学车型的教练车单独驾驶学习",
        "option3": "C、使用私家车由教练员随车指导",
        "option4": "D、使用所学车型的教练车由非教练员的驾驶人随车指导",
        "answer": "A",
        "explain": "《公安部令第123号》规定：未取得驾驶证的学员在道路上学习驾驶技能，使用所学车型的教练车由教练员随车指导。",
        "pic": "",
        "type": "C1,C2,C3"
      }
    ]
  }
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `type` | string | 是 | `C1` | 题目类型，可选值：A1, A3, B1, A2, B2, C1, C2, C3, D, E, F |
| `subject` | string | 否 | `1` | 科目类别：`1` 为科目一，`4` 为科目四 |
| `pagesize` | string | 否 | `1` | 每页数量 |
| `pagenum` | string | 否 | — | 当前页数 |
| `sort` | string | 否 | `normal` | 排序方式：`normal` 正常排序，`rand` 随机排序 |
| `chapter` | string | 否 | — | 章节：科目一为 1-4，科目四为 1-7 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | integer | 状态码，`0` 表示成功 |
| `msg` | string | 返回消息，成功时为 `ok` |
| `result.total` | string | 符合条件的题目总数 |
| `result.pagenum` | string | 当前页码 |
| `result.pagesize` | string | 每页数量 |
| `result.subject` | string | 科目类别 |
| `result.type` | string | 题目类型 |
| `result.sort` | string | 排序方式 |
| `result.list` | array | 题目列表 |
| `result.list[].question` | string | 题目内容 |
| `result.list[].option1` | string | 选项 A（判断题为空） |
| `result.list[].option2` | string | 选项 B（判断题为空） |
| `result.list[].option3` | string | 选项 C（判断题为空） |
| `result.list[].option4` | string | 选项 D（判断题为空） |
| `result.list[].answer` | string | 正确答案（选择题为字母，判断题为"对"/"错"） |
| `result.list[].explain` | string | 答案解析 |
| `result.list[].pic` | string | 题目图片 URL，无图片时为空字符串 |
| `result.list[].type` | string | 适用车型，逗号分隔 |

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface ExamQuestion {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  answer: string;
  explain: string;
  pic: string;
  type: string;
}

interface ExamQueryResult {
  total: string;
  pagenum: string;
  pagesize: string;
  subject: string;
  type: string;
  sort: string;
  list: ExamQuestion[];
}

/**
 * 查询驾考题库，返回分页后的题目列表。
 *
 * @param type - 题目类型，必填，如 "C1"、"B2" 等
 * @param subject - 科目类别，"1" 为科目一，"4" 为科目四，默认 "1"
 * @param pagesize - 每页数量，默认 "1"
 * @param pagenum - 当前页数，不传则取第一页
 * @param sort - 排序方式，"normal" 或 "rand"，默认 "normal"
 * @param chapter - 章节，科目一为 1-4，科目四为 1-7
 * @returns 题目列表及分页信息
 */
async function queryDrivingExamQuestions(
  type: string,
  subject?: string,
  pagesize?: string,
  pagenum?: string,
  sort?: string,
  chapter?: string,
): Promise<ExamQueryResult> {
  const params = new URLSearchParams({ type });
  if (subject) params.set("subject", subject);
  if (pagesize) params.set("pagesize", pagesize);
  if (pagenum) params.set("pagenum", pagenum);
  if (sort) params.set("sort", sort);
  if (chapter) params.set("chapter", chapter);

  const response = await fetch(
    `https://app-cblk1rqa5fk1-api-o9wN0mk1DAPa-gateway.appmiaoda.com/driverexam/query?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.msg}`);

  return json.result;
}

// 用法示例：获取 C1 车型科目一第1页前5道题（随机排序）
const result = await queryDrivingExamQuestions("C1", "1", "5", "1", "rand");
console.log(`共 ${result.total} 道题，本页 ${result.list.length} 道`);
for (const q of result.list) {
  console.log(`题目: ${q.question}`);
  console.log(`答案: ${q.answer} — ${q.explain}`);
}
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/driving-exam-questions.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let type: string;
  let subject: string | undefined;
  let pagesize: string | undefined;
  let pagenum: string | undefined;
  let sort: string | undefined;
  let chapter: string | undefined;

  try {
    const body = await req.json();
    type = body.type;
    if (!type) throw new Error("Missing type");
    subject = body.subject;
    pagesize = body.pagesize;
    pagenum = body.pagenum;
    sort = body.sort;
    chapter = body.chapter;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（禁止暴露到前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const params = new URLSearchParams({ type });
  if (subject) params.set("subject", subject);
  if (pagesize) params.set("pagesize", pagesize);
  if (pagenum) params.set("pagenum", pagenum);
  if (sort) params.set("sort", sort);
  if (chapter) params.set("chapter", chapter);

  const upstream = await fetch(
    `https://app-cblk1rqa5fk1-api-o9wN0mk1DAPa-gateway.appmiaoda.com/driverexam/query?${params.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    },
  );

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
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 前端调用

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询驾考题目。
 *
 * @param type - 题目类型，必填，如 "C1"
 * @param options - 可选参数：subject、pagesize、pagenum、sort、chapter
 * @returns 题目列表及分页信息
 */
async function fetchDrivingExamQuestions(
  type: string,
  options?: {
    subject?: string;
    pagesize?: string;
    pagenum?: string;
    sort?: string;
    chapter?: string;
  },
) {
  const { data, error } = await supabase.functions.invoke("driving-exam-questions", {
    body: { type, ...options },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}：${data.msg}`);
  return data.result;
}

// 用法示例：获取 C1 科目一随机5道题
const result = await fetchDrivingExamQuestions("C1", { subject: "1", pagesize: "5", sort: "rand" });
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchDrivingExamQuestions(
  type: string,
  options?: {
    subject?: string;
    pagesize?: string;
    pagenum?: string;
    sort?: string;
    chapter?: string;
  },
) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driving-exam-questions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...options }),
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
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}：${json.msg}`);
  return json.result;
}
```

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种错误，并向用户展示友好提示。
- **计费**：调用单价为 ¥0.08/次（原价 ¥0.20/次），请避免不必要的重复调用；`pagesize` 建议根据实际需求合理设置，避免过度拉取。
- **判断题识别**：若 `option1`~`option4` 均为空字符串，则该题为判断题，`answer` 值为 "对" 或 "错"。
- **图片字段**：`pic` 字段在无配图题目时为空字符串，前端渲染前需做判空处理。
- **参数传递方式**：本接口的所有参数通过 **Query String** 传递，请求体为空（接口规格为 POST 但参数在 URL 查询参数中）。
