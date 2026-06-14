---
name: precious-metal-kline
description: 查询国内外贵金属实时行情与K线数据，支持黄金、白银等品种，适用于贵金属价格查询、投资分析等场景
license: MIT
---

## 能力概述

本 skill 提供国内外贵金属市场的实时行情与历史K线数据查询能力，覆盖上海黄金交易所现货、上海期货交易所期货、
伦敦现货市场及 COMEX 期货市场的主流品种。

| 接口 | 方法 | 端点 |
|------|------|------|
| 国内贵金属报价 | POST | `https://app-cblk1rqa5fk1-api-ra5Err8G2Rla-gateway.appmiaoda.com/precious-metal/domestic/price` |
| 国内贵金属K线 | POST | `https://app-cblk1rqa5fk1-api-rLobRR63mpd9-gateway.appmiaoda.com/precious-metal/domestic/kline` |
| 国内贵金属期货合约 | POST | `https://app-cblk1rqa5fk1-api-DY8Mnnl0GGAa-gateway.appmiaoda.com/precious-metal/domestic/contract` |
| 国际贵金属报价 | POST | `https://app-cblk1rqa5fk1-api-NLZ133Rnwr29-gateway.appmiaoda.com/precious-metal/inter/price` |
| 国际贵金属K线 | POST | `https://app-cblk1rqa5fk1-api-2Y00VV8Rkb2Y-gateway.appmiaoda.com/precious-metal/inter/kline` |
| 国际贵金属期货合约 | POST | `https://app-cblk1rqa5fk1-api-nYWNRRkexgKL-gateway.appmiaoda.com/precious-metal/inter/contract` |

所有接口均返回 JSON，`Content-Type: application/x-www-form-urlencoded`，认证方式为 `platform_managed`。

**支持的品种代码汇总：**

| 市场 | 类型 | 代码示例 |
|------|------|---------|
| 国内现货 | 延期交收 | AUTD(黄金T+D)、AGTD(白银T+D)、AU99、MAUTD、IAU99、AUTN06、AUTN12 |
| 国内期货 | 上期所 | AU0(黄金)、AG0(白银)、CU0(铜)、BC0(国际铜)、ZN0(锌)、AL0(铝)、NI0(镍)、SN0(锡)、PB0(铅)、SS0(不锈钢)、RB0(螺纹钢) |
| 国际现货 | 伦敦 | XAU(伦敦金)、XAG(伦敦银)、CAD(伦敦铜)、AHD(伦敦铝)、ZSD(伦敦锌)、NID(伦敦镍)、PBD(伦敦铅)、SND(伦敦锡)、XPT(铂金)、XPD(钯金) |
| 国际期货 | COMEX | GC(美黄金)、SI(美白银)、HG(美铜) |

---

## 生成期用法（Agent 直接调用）

本 skill 包含 6 个接口，各接口的完整参数表、响应结构及生成期代码详见 `references/` 目录：

- 国内行情 → `references/precious-metal-domestic-api.md`
- 国际行情 → `references/precious-metal-inter-api.md`

**快速示例 — 查询黄金T+D实时报价：**

```typescript
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

const response = await fetch(
  "https://app-cblk1rqa5fk1-api-ra5Err8G2Rla-gateway.appmiaoda.com/precious-metal/domestic/price",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
    body: new URLSearchParams({ symbol: "AUTD" }).toString(),
  }
);
const json = await response.json();
// json.data.price → 当前价格；json.data.changeRate → 涨跌幅
```

---

## 生成后用法（应用内通过 Edge Function 调用）

将接口封装为 Supabase Edge Function，由 Edge Function 持有 `INTEGRATIONS_API_KEY`，前端通过
`supabase.functions.invoke` 调用，确保密钥不暴露到浏览器。

各接口的完整 Edge Function 代码及前端调用代码详见：

- 国内行情（报价 / K线 / 期货合约）→ `references/precious-metal-domestic-api.md`
- 国际行情（报价 / K线 / 期货合约）→ `references/precious-metal-inter-api.md`

**平台差异：** 本 plugin 的所有接口均返回 JSON，无二进制流，Web 和 MiniProgram 前端实现方式相同，
均可使用 `supabase.functions.invoke`。
