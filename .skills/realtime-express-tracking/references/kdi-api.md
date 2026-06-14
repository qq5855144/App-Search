# 快递物流轨迹查询 API

## API 基本信息

| 项目 | 值 |
|------|----|
| Plugin ID | `b955023f-4f9c-4f2b-b137-6f7b630a2ee4` |
| API ID | `api-AalZz7v4QEGL` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-AalZz7v4QEGL-gateway.appmiaoda.com/kdi` |
| Auth 模式 | `platform_managed`（密钥由平台注入） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json;charset=UTF-8` |
| third_part_domain | `app-cblk1rqa5fk1-api-AalZz7v4QEGL-gateway.appmiaoda.com` |
| 计费 | 未启用（`enable_billing: false`） |

---

## 请求参数表

### Query Parameters

| 参数名 | 类型 | 必填 | 示例值 | 说明 |
|--------|------|------|--------|------|
| no | string | 是 | `780098068058`、`123456789:1234` | 快递单号。**顺丰特殊规则**：需填写「单号:收件人/寄件人手机号后四位」，如 `123456789:1234` |
| type | string | 否 | `ZTO`、`SF`、`YD`、`EMS`、`chinapost` | 快递公司简码，不填时系统自动识别（约 95% 准确率）。中国邮政需区分 `EMS`（邮政速递）与 `chinapost`（邮政包裹） |

### 请求头

| Header | 值 | 必填 |
|--------|----|------|
| Content-Type | `application/json;charset=UTF-8` | 是 |

---

## 响应字段表

### 成功响应（msg: "ok"）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | string | 整体请求状态码，`"0"` 表示请求成功（与错误响应中的 `status` 字段含义相同，成功时固定为 `"0"`） |
| `msg` | string | 响应消息，正常时为 `"ok"` |
| `result` | object | 物流核心数据对象 |
| `result.number` | string | 快递单号 |
| `result.type` | string | 快递公司简码 |
| `result.expName` | string | 快递公司名称 |
| `result.expSite` | string | 快递公司官网地址 |
| `result.expPhone` | string | 快递公司官方电话 |
| `result.deliverystatus` | string | 投递状态码（见下方说明） |
| `result.issign` | string | 是否本人签收（`"0"` = 否，`"1"` = 是），注意：可能存在物管代签导致不准确 |
| `result.courier` | string | 快递员姓名（若有） |
| `result.courierPhone` | string | 快递员电话（若有） |
| `result.updateTime` | string | 最新物流轨迹更新时间（格式：`YYYY-MM-DD HH:mm:ss`） |
| `result.takeTime` | string | 从发货到最新轨迹的耗时（如 `"1天16小时53分"`），仅供参考 |
| `result.citys` | string[] | 物流涉及的城市列表 |
| `result.logo` | string | 快递公司 logo 图片链接 |
| `result.list` | object[] | 物流轨迹列表（时间倒序） |
| `result.list[].time` | string | 轨迹发生时间 |
| `result.list[].status` | string | 轨迹事件详情（含地点、操作描述） |
| `result.list[].cityLoeLae` | string[] | 城市及经纬度，格式：`[城市名, 经度, 纬度]` |

**投递状态码（deliverystatus）说明：**

| 状态码 | 说明 |
|--------|------|
| `"0"` | 快递收件（揽件） |
| `"1"` | 在途中（运输中） |
| `"2"` | 正在派件 |
| `"3"` | 已签收 |
| `"4"` | 派送失败（无法联系收件人、客户要求择日派送等） |
| `"5"` | 疑难件（收件人拒签、地址有误、超出派送范围等） |
| `"6"` | 退件签收（快递被退回并签收） |

**成功响应示例：**

```json
{
  "status": "0",
  "msg": "ok",
  "result": {
    "number": "780098068058",
    "type": "ZTO",
    "expName": "中通快递",
    "expSite": "www.zto.com",
    "expPhone": "95311",
    "deliverystatus": "3",
    "issign": "1",
    "courier": "张三",
    "courierPhone": "13800138000",
    "updateTime": "2024-01-01 10:00:00",
    "takeTime": "2天3小时",
    "citys": ["上海市", "北京市"],
    "logo": "https://img3.fegine.com/express/zto.jpg",
    "list": [
      {
        "time": "2024-01-01 10:00:00",
        "status": "已签收,签收人:本人",
        "cityLoeLae": ["北京市", "116.407526", "39.904030"]
      }
    ]
  }
}
```

### 错误响应

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | string | 错误状态码 |
| `msg` | string | 错误描述 |
| `result.number` | string | 查询的快递单号 |
| `result.type` | string | 快递公司简码（自动识别时为 `"AUTO"`） |
| `result.list` | array | 空数组 `[]` |

**错误码说明：**

| 错误码（status） | 错误消息（msg） | 原因说明 |
|-----------------|----------------|---------|
| `"201"` | 快递单号错误 | 单号格式无效或不存在 |
| `"203"` | 快递公司不存在 | 指定的 `type` 不在支持列表中 |
| `"204"` | 快递公司识别失败 | 未指定 `type` 时，系统无法自动识别 |
| `"205"` | 没有信息；单号错误 | 1. 单号无物流信息；2. 单号对应多个快递公司，需指定 `type` |
| `"207"` | 该单号被限制，错误单号 | 1. 单号被系统限制；2. 单号对应多个快递公司，需指定 `type` |

**错误响应示例：**

```json
{
  "status": "205",
  "msg": "没有信息",
  "result": {
    "number": "1111ADECD1234",
    "type": "AUTO",
    "list": []
  }
}
```

---

## 生成期代码（Agent 直接调用）

```typescript
/**
 * 查询快递物流轨迹。
 * @param no - 快递单号。顺丰需填写「单号:手机号后四位」，如 "123456789:1234"。
 * @param type - 可选。快递公司简码（如 "ZTO"/"SF"/"EMS"/"chinapost"）；不填时自动识别。
 * @returns 物流轨迹详细数据，包含快递公司信息、投递状态和轨迹列表。
 */
const apiKey = process.env["INTEGRATIONS_API_KEY"]!; // platform_managed，密钥由平台注入

interface TrackingItem {
  time: string;
  status: string;
  cityLoeLae: string[];
}

interface TrackingResult {
  number: string;
  type: string;
  expName: string;
  expSite?: string;
  expPhone?: string;
  deliverystatus: string;
  issign: string;
  courier?: string;
  courierPhone?: string;
  updateTime: string;
  takeTime?: string;
  citys?: string[];
  logo?: string;
  list: TrackingItem[];
}

async function queryExpressTracking(no: string, type?: string): Promise<TrackingResult> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-AalZz7v4QEGL-gateway.appmiaoda.com/kdi"
  );
  url.searchParams.set("no", no);
  if (type) {
    url.searchParams.set("type", type);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const json = await response.json();
  if (json.msg !== "ok") {
    throw new Error(`API error ${json.status ?? "unknown"}: ${json.msg}`);
  }

  return json.result as TrackingResult;
}

// 使用示例：普通快递查询
const result = await queryExpressTracking("780098068058", "ZTO");
console.log(`投递状态: ${result.deliverystatus}, 快递员: ${result.courier}`);
console.log("最新轨迹:", result.list[0]);

// 使用示例：顺丰快递（需附加手机号后四位）
const sfResult = await queryExpressTracking("123456789:1234", "SF");
console.log(sfResult);
```

---

## Edge Function 代码

两个平台（Web / MiniProgram）的 Edge Function 实现相同，因为响应为 JSON 数据。

```typescript
// edge-functions/kdi-query.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * 将远程图片 URL 转存至 Supabase Storage，返回持久化公开 URL。
 * @param mediaUrl - 第三方图片 URL（如快递公司 logo）
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
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const isAllowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream";
    if (!isAllowed) throw new Error(`Unsupported content type: ${contentType}`);
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
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
  /**
   * 快递物流轨迹查询 Edge Function。
   * 接收客户端请求，注入平台密钥，转发到上游 API，返回物流轨迹数据。
   */
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- 解析客户端请求 ---
  let no: string;
  let type: string | undefined;
  try {
    const body = await req.json();
    no = body.no;
    type = body.type; // 可选参数
    if (!no) throw new Error("Missing no");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body: 'no' is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（绝不暴露给客户端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-AalZz7v4QEGL-gateway.appmiaoda.com/kdi"
  );
  url.searchParams.set("no", no);
  if (type) {
    url.searchParams.set("type", type);
  }

  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
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

  const data = await upstream.json();

  // 将快递公司 logo URL（第三方 CDN）转存至 Supabase Storage
  if (data?.result?.logo) {
    const stored = await streamMediaToStorage(data.result.logo, "express-logos");
    if (stored.success) {
      data.result.logo = stored.publicUrl;
    }
    // 转存失败时保留原始 URL
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## 前端调用代码

### Web 平台（推荐方式）

```typescript
interface TrackingItem {
  time: string;
  status: string;
  cityLoeLae: string[];
}

interface TrackingResult {
  number: string;
  type: string;
  expName: string;
  deliverystatus: string;
  issign: string;
  courier?: string;
  courierPhone?: string;
  updateTime: string;
  takeTime?: string;
  citys?: string[];
  logo?: string;
  list: TrackingItem[];
}

/**
 * 查询快递物流轨迹（Web 平台）。
 * @param no - 快递单号，顺丰需填写「单号:手机号后四位」。
 * @param type - 可选。快递公司简码；不填时自动识别。
 * @returns 物流轨迹详细数据。
 */
async function fetchExpressTracking(no: string, type?: string): Promise<TrackingResult> {
  const { data, error } = await supabase.functions.invoke("kdi-query", {
    body: { no, type },
  });
  if (error) throw error;
  if (data.msg !== "ok") {
    throw new Error(`API 错误 ${data.status ?? "unknown"}：${data.msg}`);
  }
  return data.result as TrackingResult;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 查询快递物流轨迹（MiniProgram 平台）。
 * @param no - 快递单号，顺丰需填写「单号:手机号后四位」。
 * @param type - 可选。快递公司简码；不填时自动识别。
 * @returns 物流轨迹详细数据。
 */
async function fetchExpressTracking(no: string, type?: string): Promise<TrackingResult> {
  const { data, error } = await supabase.functions.invoke("kdi-query", {
    body: { no, type },
  });
  if (error) throw error;
  if (data.msg !== "ok") {
    throw new Error(`API 错误 ${data.status ?? "unknown"}：${data.msg}`);
  }
  return data.result as TrackingResult;
}
```

### 备用方式（无法使用 supabase client 时）

```typescript
/**
 * 直接 fetch 调用快递物流轨迹查询 Edge Function（备用）。
 * @param no - 快递单号，顺丰需填写「单号:手机号后四位」。
 * @param type - 可选。快递公司简码。
 * @returns 物流轨迹详细数据。
 */
async function fetchExpressTracking(no: string, type?: string): Promise<TrackingResult> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kdi-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ no, type }),
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
  if (json.msg !== "ok") {
    throw new Error(`API 错误 ${json.status ?? "unknown"}：${json.msg}`);
  }
  return json.result as TrackingResult;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：此接口未启用计费（`enable_billing: false`）。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）响应；同时需处理上游返回的业务错误码（201/203/204/205/207）。
- **顺丰特殊规则**：查询顺丰快递时，`no` 参数必须填写「单号:手机号后四位」（如 `123456789:1234`），否则无法查询。
- **中国邮政区分**：`EMS`（邮政速递）与 `chinapost`（邮政包裹）不同，错填会导致查询失败。
- **自动识别限制**：不填 `type` 时，系统约 95% 概率自动识别；若返回 `status: "204"`，需先调用快递公司列表接口获取正确简码，再指定 `type` 重新查询。
- **数据时效性**：物流轨迹数据可能存在 1-5 分钟延迟，建议间隔 30 秒以上重复查询，避免高频调用。
