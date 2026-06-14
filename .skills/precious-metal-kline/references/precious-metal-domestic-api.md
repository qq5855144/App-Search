# 国内贵金属行情 API

## API 基本信息

| 字段 | 值 |
|------|----|
| Plugin ID | `d9eca9b4-2a1c-411e-9af7-5bd745ade28f` |
| 认证方式 | `platform_managed`（`INTEGRATIONS_API_KEY`） |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/x-www-form-urlencoded` |
| Third-part Domain | `app-cblk1rqa5fk1-api-ra5Err8G2Rla-gateway.appmiaoda.com` |
| 计费单价 | 折扣价 ¥0.06 / 次（原价 ¥0.10 / 次） |

---

## 一、国内贵金属报价

| 字段 | 值 |
|------|----|
| API ID | `api-ra5Err8G2Rla` |
| 端点 | `POST https://app-cblk1rqa5fk1-api-ra5Err8G2Rla-gateway.appmiaoda.com/precious-metal/domestic/price` |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | string | 是 | 国内贵金属品种代码，如 AUTD(黄金T+D)、AGTD(白银T+D)、AU99(AU99.99)、MAUTD、IAU99、AUTN06、AUTN12、AU0(黄金期货)、AG0(白银期货)等 |

### 成功响应字段（200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码（200 为成功） |
| `msg` | string | 返回信息 |
| `success` | boolean | 请求状态 |
| `taskNo` | string | 请求编号 |
| `data.name` | string | 品种名称 |
| `data.price` | number | 当前价格 |
| `data.open` | number | 开盘价 |
| `data.high` | number | 最高价 |
| `data.low` | number | 最低价 |
| `data.preclose` | number | 昨收盘价 |
| `data.presettle` | number | 昨结算价 |
| `data.settle` | number | 结算价 |
| `data.change` | number | 涨跌额 |
| `data.changeRate` | number | 涨跌幅（%） |
| `data.bid` | number | 买价 |
| `data.bid_vol` | number | 买量 |
| `data.ask` | number | 卖价 |
| `data.ask_vol` | number | 卖量 |
| `data.volume` | number | 成交量 |
| `data.value` | number | 成交额 |
| `data.hold` | number | 持仓量 |
| `data.update_time` | number | 更新时间戳（Unix 秒） |

### 失败响应

| code | msg 示例 | 说明 |
|------|---------|------|
| 400 | 国内贵金属品种不能为空 | 参数错误 |
| 500 | — | 服务异常 |
| 999 | — | 未知错误/服务端内部错误 |

### 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface DomesticPriceData {
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  preclose: number;
  presettle: number;
  settle: number;
  change: number;
  changeRate: number;
  bid: number;
  bid_vol: number;
  ask: number;
  ask_vol: number;
  volume: number;
  value: number;
  hold: number;
  update_time: number;
}

async function getDomesticPrice(symbol: string): Promise<DomesticPriceData> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5Err8G2Rla-gateway.appmiaoda.com/precious-metal/domestic/price",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ symbol }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data as DomesticPriceData;
}

// 使用示例：查询黄金T+D报价
const data = await getDomesticPrice("AUTD");
console.log(`黄金T+D 当前价格: ${data.price}，涨跌幅: ${data.changeRate}%`);
```

### Edge Function 代码

```typescript
// edge-functions/precious-metal-domestic-price.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let symbol: string;
  try {
    const body = await req.json();
    symbol = body.symbol;
    if (!symbol) throw new Error("Missing symbol");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-ra5Err8G2Rla-gateway.appmiaoda.com/precious-metal/domestic/price",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ symbol }).toString(),
    }
  );

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

### 前端调用代码（Web / MiniProgram 通用）

```typescript
async function getDomesticPrice(symbol: string) {
  const { data, error } = await supabase.functions.invoke("precious-metal-domestic-price", {
    body: { symbol },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}

// 调用示例
const price = await getDomesticPrice("AUTD");
console.log(`黄金T+D: ${price.price} 元/克，涨跌幅: ${price.changeRate}%`);
```

---

## 二、国内贵金属K线

| 字段 | 值 |
|------|----|
| API ID | `api-rLobRR63mpd9` |
| 端点 | `POST https://app-cblk1rqa5fk1-api-rLobRR63mpd9-gateway.appmiaoda.com/precious-metal/domestic/kline` |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | string | 是 | 国内贵金属品种代码，如 AUTD(黄金T+D)、AGTD(白银T+D)、AU0(黄金期货)等 |
| `type` | string | 是 | K线类型：0=日K，1=1分钟，5=5分钟，30=30分钟，60=60分钟，120=120分钟，240=240分钟 |
| `limit` | string | 否 | 返回数据条数，默认 10 |

### 成功响应字段（200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码 |
| `msg` | string | 返回信息 |
| `success` | boolean | 请求状态 |
| `taskNo` | string | 请求编号 |
| `data.fields` | string[] | 字段名称映射，顺序为 `["open","close","high","low","change","changeRate","volume","tick_at"]` |
| `data.lines` | number[][] | K线数据二维数组，每行按 `fields` 顺序排列 |

### 失败响应

| code | 说明 |
|------|------|
| 400 | 参数错误 |
| 500 | 服务异常 |
| 999 | 未知错误/服务端内部错误 |

### 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface KlineData {
  fields: string[];
  lines: number[][];
}

interface KlineItem {
  open: number;
  close: number;
  high: number;
  low: number;
  change: number;
  changeRate: number;
  volume: number;
  tick_at: number;
}

async function getDomesticKline(
  symbol: string,
  type: string,
  limit?: string
): Promise<KlineItem[]> {
  const params: Record<string, string> = { symbol, type };
  if (limit) params.limit = limit;

  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-rLobRR63mpd9-gateway.appmiaoda.com/precious-metal/domestic/kline",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  const { fields, lines } = json.data as KlineData;
  return lines.map((row) => {
    const item: Record<string, number> = {};
    fields.forEach((field, idx) => { item[field] = row[idx]; });
    return item as unknown as KlineItem;
  });
}

// 使用示例：查询黄金T+D日K线最近10条
const klines = await getDomesticKline("AUTD", "0");
klines.forEach((k) => {
  const date = new Date(k.tick_at * 1000).toLocaleDateString();
  console.log(`${date}: 开${k.open} 高${k.high} 低${k.low} 收${k.close} 涨跌${k.changeRate}%`);
});
```

### Edge Function 代码

```typescript
// edge-functions/precious-metal-domestic-kline.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let symbol: string;
  let type: string;
  let limit: string | undefined;
  try {
    const body = await req.json();
    symbol = body.symbol;
    type = body.type;
    limit = body.limit;
    if (!symbol) throw new Error("Missing symbol");
    if (!type) throw new Error("Missing type");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params: Record<string, string> = { symbol, type };
  if (limit) params.limit = limit;

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-rLobRR63mpd9-gateway.appmiaoda.com/precious-metal/domestic/kline",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams(params).toString(),
    }
  );

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

### 前端调用代码（Web / MiniProgram 通用）

```typescript
async function getDomesticKline(symbol: string, type: string, limit?: string) {
  const { data, error } = await supabase.functions.invoke("precious-metal-domestic-kline", {
    body: { symbol, type, ...(limit ? { limit } : {}) },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}

// 调用示例：查询黄金T+D最近5条日K
const klineData = await getDomesticKline("AUTD", "0", "5");
```

---

## 三、国内贵金属期货合约

| 字段 | 值 |
|------|----|
| API ID | `api-DY8Mnnl0GGAa` |
| 端点 | `POST https://app-cblk1rqa5fk1-api-DY8Mnnl0GGAa-gateway.appmiaoda.com/precious-metal/domestic/contract` |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `symbol` | string | 是 | 国内贵金属期货品种代码，如 AU0(黄金)、AG0(白银)、CU0(铜)、BC0(国际铜)、ZN0(锌)、AL0(铝)、NI0(镍)、SN0(锡)、PB0(铅)、SS0(不锈钢)、RB0(螺纹钢) |

### 成功响应字段（200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码 |
| `msg` | string | 返回信息 |
| `success` | boolean | 请求状态 |
| `taskNo` | string | 请求编号 |
| `data` | object | 合约详情数据 |

### 失败响应

| code | 说明 |
|------|------|
| 400 | 参数错误 |
| 500 | 服务异常 |
| 999 | 未知错误/服务端内部错误 |

### 生成期代码

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

async function getDomesticContract(symbol: string): Promise<unknown> {
  const response = await fetch(
    "https://app-cblk1rqa5fk1-api-DY8Mnnl0GGAa-gateway.appmiaoda.com/precious-metal/domestic/contract",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ symbol }).toString(),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}

// 使用示例：查询黄金期货合约
const contract = await getDomesticContract("AU0");
console.log(JSON.stringify(contract, null, 2));
```

### Edge Function 代码

```typescript
// edge-functions/precious-metal-domestic-contract.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let symbol: string;
  try {
    const body = await req.json();
    symbol = body.symbol;
    if (!symbol) throw new Error("Missing symbol");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(
    "https://app-cblk1rqa5fk1-api-DY8Mnnl0GGAa-gateway.appmiaoda.com/precious-metal/domestic/contract",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: new URLSearchParams({ symbol }).toString(),
    }
  );

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

### 前端调用代码（Web / MiniProgram 通用）

```typescript
async function getDomesticContract(symbol: string) {
  const { data, error } = await supabase.functions.invoke("precious-metal-domestic-contract", {
    body: { symbol },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

---

## 注意事项

- **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **计费**：本 plugin 单次调用折扣价 ¥0.06（原价 ¥0.10），避免频繁轮询造成不必要费用。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）状态码。
- **调用约束**：除非用户明确要求实时刷新，否则只在用户主动请求时调用一次，不主动轮询。
- **品种代码区分**：国内现货品种（如 AUTD）与国内期货品种（如 AU0）使用不同的接口，请注意区分。
- **时间戳**：`update_time` 为 Unix 秒级时间戳，转换为本地时间需乘以 1000。
