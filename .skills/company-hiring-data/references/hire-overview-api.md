# 招聘概况查询 API

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `179c86e6-24ab-4303-8530-f21c4437c23e` |
| API ID | `api-Aa2PZ2MejdoL` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-Aa2PZ2MejdoL-gateway.appmiaoda.com/enterprise/hire-overview` |
| Auth | `platform_managed`，Header: `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/x-www-form-urlencoded` |
| third_part_domain | `app-cblk1rqa5fk1-api-Aa2PZ2MejdoL-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `keyword` | string | 是 | 企业名/统一信用代码/注册号/企业历史名称 |

## 响应字段说明

### 成功响应（code: 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码（200 表示成功） |
| `msg` | string | 返回消息 |
| `success` | boolean | 是否成功 |
| `taskNo` | string | 任务编号 |
| `data.titleKw` | string | 职位关键词 |
| `data.titleType` | string | 职位类型（如"实习、全职"） |
| `data.city` | string | 城市分布（逗号分隔） |
| `data.src` | string | 招聘来源（如"boss直聘、58同城"） |
| `data.titleLevel` | string | 职位级别（如"其他、高级、专员、经理"） |
| `data.avgSal` | string | 平均薪资（数值字符串，单位：元） |
| `data.titleCnt` | integer | 职位数量 |
| `data.titleModifyDate` | string | 职位更新时间（如"<1个月"） |
| `data.cityCnt` | integer | 城市数量 |

### 失败响应

| code | 说明 |
|------|------|
| 201 | 查无数据 |
| 400 | 参数错误（如关键字为空） |
| 500 | 系统维护，请稍候再试 |
| 999 | 其他，以实际返回为准 |

### 响应示例

```json
{
  "data": {
    "titleKw": "其他",
    "titleType": "实习、全职",
    "city": "成都市、北京市、济南市、珠海市、燕郊",
    "src": "boss直聘、58同城",
    "titleLevel": "其他、高级、专员、经理",
    "avgSal": "16795.48",
    "titleCnt": 25,
    "titleModifyDate": "<1个月",
    "cityCnt": 0
  },
  "msg": "成功",
  "success": true,
  "code": 200,
  "taskNo": "590896628201113530504246"
}
```

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface HireOverviewData {
  titleKw: string;
  titleType: string;
  city: string;
  src: string;
  titleLevel: string;
  avgSal: string;
  titleCnt: number;
  titleModifyDate: string;
  cityCnt: number;
}

/**
 * 查询企业招聘概况，返回职位关键词、职位类型、城市分布、招聘来源、职位级别、平均薪资、职位数量等统计数据。
 *
 * @param keyword - 企业名/统一信用代码/注册号/企业历史名称
 * @returns 招聘概况数据对象
 */
async function fetchHireOverview(keyword: string): Promise<HireOverviewData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-Aa2PZ2MejdoL-gateway.appmiaoda.com/enterprise/hire-overview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ keyword }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as HireOverviewData;
}

// 使用示例
const overview = await fetchHireOverview("北京百度网讯科技有限公司");
console.log("平均薪资：", overview.avgSal);
console.log("职位数量：", overview.titleCnt);
console.log("城市分布：", overview.city);
```

---

## Edge Function 代码

```typescript
// edge-functions/hire-overview.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let keyword: string;
  try {
    const body = await req.json();
    keyword = body.keyword;
    if (!keyword) throw new Error("Missing keyword");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游接口 ---
  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-Aa2PZ2MejdoL-gateway.appmiaoda.com/enterprise/hire-overview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ keyword }).toString(),
    }
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

### Web 平台（推荐，使用 supabase client）

```typescript
/**
 * 查询企业招聘概况。
 *
 * @param keyword - 企业名称或统一信用代码等标识
 * @returns 招聘概况数据
 */
async function fetchHireOverview(keyword: string) {
  const { data, error } = await supabase.functions.invoke("hire-overview", {
    body: { keyword },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

### Web 平台（备用，无 supabase client 时）

```typescript
/**
 * 查询企业招聘概况（备用方式）。
 *
 * @param keyword - 企业名称或统一信用代码等标识
 * @returns 招聘概况数据
 */
async function fetchHireOverview(keyword: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hire-overview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    }
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
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);

  return json.data;
}
```

### MiniProgram 平台（Taro / supabase.functions.invoke）

```typescript
/**
 * 查询企业招聘概况（小程序端）。
 *
 * @param keyword - 企业名称或统一信用代码等标识
 * @returns 招聘概况数据
 */
async function fetchHireOverview(keyword: string) {
  const { data, error } = await supabase.functions.invoke("hire-overview", {
    body: { keyword },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）；code 201 表示查无数据，应给用户友好提示。
- **计费**：折扣价 ¥4.00 / 次，原价 ¥4.80 / 次（`price_unit: 4` 即每4次计费单元），每次调用均计费，避免因关键字不精确导致的无效重复调用。
- **查询关键字**：支持企业全称、简称、统一信用代码、注册号或历史名称，建议优先使用全称或统一信用代码以确保精准匹配。
