# 招聘数据统计 API

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `179c86e6-24ab-4303-8530-f21c4437c23e` |
| API ID | `api-zYkZzErqJg4L` |
| Endpoint | `POST https://app-cblk1rqa5fk1-api-zYkZzErqJg4L-gateway.appmiaoda.com/enterprise/hire-statistics` |
| Auth | `platform_managed`，Header: `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}` |
| Content-Type | `application/x-www-form-urlencoded` |
| third_part_domain | `app-cblk1rqa5fk1-api-zYkZzErqJg4L-gateway.appmiaoda.com` |

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `keyword` | string | 是 | 企业名称/统一信用代码/注册号/企业历史名称 |

## 响应字段说明

### 成功响应（code: 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码（200 表示成功） |
| `msg` | string | 返回消息 |
| `success` | boolean | 是否成功 |
| `taskNo` | string | 任务编号 |
| `data.companyName` | string | 企业名称 |
| `data.avgSal` | number | 平均薪资数值（元） |
| `data.avgSalStr` | string | 平均薪资字符串（如"3万"） |
| `data.priProvince` | string | 主要招聘省份 |
| `data.zpnumber` | integer | 总招聘数量 |
| `data.bkEducation` | string | 本科学历占比（如"69.62%"） |
| `data.btw3and5Years` | string | 3-5年工作经验占比（如"28.71%"） |
| `data.educationList` | array | 学历分布列表，每项含 `key`（学历名称）、`value`（数量） |
| `data.salaryList` | array | 薪资区间分布，每项含 `key`（区间名称）、`value`（数量） |
| `data.yearsList` | array | 工作年限分布，每项含 `key`（年限区间）、`value`（数量） |
| `data.recruitPosition` | array | 招聘职位名称列表（string[]） |
| `data.zpnumberList` | array | 月度招聘数量时间序列，每项含 `key`（"YYYY-MM"）、`value`（数量） |
| `data.ssNumHisList` | array | 年度招聘数量统计，每项含 `key`（年份字符串）、`value`（数量） |

### 失败响应

| code | 说明 |
|------|------|
| 201 | 查无数据 |
| 400 | 参数错误（如关键字为空） |
| 500 | 系统维护，请稍候再试 |
| 999 | 其他，以实际返回为准 |

### 响应示例（节选）

```json
{
  "data": {
    "avgSalStr": "3万",
    "bkEducation": "69.62%",
    "educationList": [
      { "value": 857, "key": "大专及以下" },
      { "value": 1897, "key": "本科" },
      { "value": 67, "key": "硕士及以上" }
    ],
    "priProvince": "北京",
    "companyName": "北京百度网讯科技有限公司",
    "avgSal": 25547.110638,
    "zpnumber": 2821,
    "btw3and5Years": "28.71%",
    "recruitPosition": ["PMO", "Product Operations Manager", "运营助理/专员"],
    "salaryList": [
      { "value": 115, "key": "0K-5K" },
      { "value": 1501, "key": "25K以上" }
    ],
    "yearsList": [
      { "value": 1760, "key": "3年以下" },
      { "value": 810, "key": "3-5年" }
    ],
    "zpnumberList": [
      { "value": 172, "key": "2024-06" },
      { "value": 94, "key": "2024-03" }
    ],
    "ssNumHisList": [
      { "value": 6792, "key": "2018" },
      { "value": 4221, "key": "2024" }
    ]
  },
  "msg": "成功",
  "success": true,
  "code": 200,
  "taskNo": "413539613218849232425903"
}
```

---

## 生成期代码（TypeScript）

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed 密钥由平台注入

interface KeyValueItem {
  key: string;
  value: number;
}

interface HireStatisticsData {
  companyName: string;
  avgSal: number;
  avgSalStr: string;
  priProvince: string;
  zpnumber: number;
  bkEducation: string;
  btw3and5Years: string;
  educationList: KeyValueItem[];
  salaryList: KeyValueItem[];
  yearsList: KeyValueItem[];
  recruitPosition: string[];
  zpnumberList: KeyValueItem[];
  ssNumHisList: KeyValueItem[];
}

/**
 * 查询企业招聘数据统计，返回平均薪资、学历分布、主要省份、招聘职位、
 * 薪资区间、工作年限分布、招聘数量时间序列等详细统计信息。
 *
 * @param keyword - 企业名称/统一信用代码/注册号/企业历史名称
 * @returns 招聘统计数据对象
 */
async function fetchHireStatistics(keyword: string): Promise<HireStatisticsData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-zYkZzErqJg4L-gateway.appmiaoda.com/enterprise/hire-statistics",
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

  return json.data as HireStatisticsData;
}

// 使用示例
const stats = await fetchHireStatistics("北京百度网讯科技有限公司");
console.log("总招聘数量：", stats.zpnumber);
console.log("平均薪资：", stats.avgSalStr);
console.log("主要省份：", stats.priProvince);
console.log("本科占比：", stats.bkEducation);
console.log("薪资分布：", stats.salaryList);
```

---

## Edge Function 代码

```typescript
// edge-functions/hire-statistics.ts
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
    "https://app-cblk1rqa5fk1-api-zYkZzErqJg4L-gateway.appmiaoda.com/enterprise/hire-statistics",
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
 * 查询企业招聘数据统计。
 *
 * @param keyword - 企业名称或统一信用代码等标识
 * @returns 招聘统计数据
 */
async function fetchHireStatistics(keyword: string) {
  const { data, error } = await supabase.functions.invoke("hire-statistics", {
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
 * 查询企业招聘数据统计（备用方式）。
 *
 * @param keyword - 企业名称或统一信用代码等标识
 * @returns 招聘统计数据
 */
async function fetchHireStatistics(keyword: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hire-statistics`,
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
 * 查询企业招聘数据统计（小程序端）。
 *
 * @param keyword - 企业名称或统一信用代码等标识
 * @returns 招聘统计数据
 */
async function fetchHireStatistics(keyword: string) {
  const { data, error } = await supabase.functions.invoke("hire-statistics", {
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
- **计费**：折扣价 ¥4.00 / 次，原价 ¥4.80 / 次（`price_unit: 4`），每次调用均计费，避免因关键字不精确导致的无效重复调用。
- **数据量说明**：`zpnumberList` 为逐月时间序列，数据量较大（可能含 100 条以上记录），前端渲染时建议按需截取最近 N 个月展示。
- **查询关键字**：支持企业全称、简称、统一信用代码、注册号或历史名称，建议优先使用全称或统一信用代码以确保精准匹配。
