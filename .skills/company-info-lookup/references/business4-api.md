# 企业工商全维度版 API

## API 基本信息

| 属性 | 值 |
|------|-----|
| Plugin ID | `ee49a105-a594-4d41-a8db-aa55308121f1` |
| API ID | `api-e94GZ5j0Kxja` |
| Endpoint | `GET https://app-cblk1rqa5fk1-api-e94GZ5j0Kxja-gateway.appmiaoda.com/business4/get` |
| Auth 模式 | platform_managed |
| Auth Header | `X-Gateway-Authorization: Bearer ${apiKey}` |
| Content-Type | `application/json;charset=UTF-8` |
| third_part_domain | `app-cblk1rqa5fk1-api-e94GZ5j0Kxja-gateway.appmiaoda.com` |
| 计费单价 | 原价 ¥12.00 / 次，折扣价 ¥7.50 / 次 |

---

## 请求参数表

### Query Parameters

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `keyword` | string | 是 | 关键字，支持公司名全称、注册号、社会统一信用代码 |

### Headers

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `Content-Type` | string | 是 | `application/json;charset=UTF-8` |

---

## 响应字段表

### 成功响应（code: 200）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 为成功 |
| `msg` | string | 状态描述，成功时为"成功" |
| `success` | boolean | 请求成功标识 |
| `data.orderNo` | string | 订单号 |
| `data.data.base.companyName` | string | 公司名称 |
| `data.data.base.companyCode` | string | 注册号 |
| `data.data.base.creditNo` | string | 社会统一信用代码 |
| `data.data.base.orgCode` | string | 组织机构代码 |
| `data.data.base.legalPerson` | string | 法人名 |
| `data.data.base.establishDate` | string | 成立日期 |
| `data.data.base.companyStatus` | string | 企业状态（如"存续"） |
| `data.data.base.capital` | string | 注册资本 |
| `data.data.base.companyType` | string | 企业类型 |
| `data.data.base.companyAddress` | string | 注册地址 |
| `data.data.base.businessScope` | string | 经营范围 |
| `data.data.base.businessDateFrom` | string | 营业开始日期 |
| `data.data.base.businessDateTo` | string? | 营业结束日期（null 为长期） |
| `data.data.base.revokeDate` | string? | 吊销日期 |
| `data.data.base.province` | string | 省份 |
| `data.data.base.updatedDate` | string | 数据更新日期 |
| `data.data.base.issueDate` | string | 发照日期 |
| `data.data.base.authority` | string | 登记机关 |
| `data.data.base.isOnStock` | string? | 是否上市（0 未上市，1 上市） |
| `data.data.base.stockNumber` | string? | 上市公司代码 |
| `data.data.base.stockType` | string? | 上市类型 |
| `data.data.base.keyNo` | string | 内部标识符 |
| `data.data.base.logoUrl` | string? | 企业 Logo URL |
| `data.data.base.realCaptical` | string? | 实缴资本 |
| `data.data.branches` | array | 分支机构列表 |
| `data.data.branches[].companyCode` | string | 注册号 |
| `data.data.branches[].companyName` | string | 分支机构名称 |
| `data.data.branches[].authority` | string | 登记机关 |
| `data.data.branches[].creditNo` | string | 社会信用代码 |
| `data.data.branches[].legalPerson` | string | 法人姓名 |
| `data.data.changes` | array | 企业变更记录列表 |
| `data.data.changes[].changeField` | string | 变更事项 |
| `data.data.changes[].changeBefore` | string | 变更前内容 |
| `data.data.changes[].changeAfter` | string | 变更后内容 |
| `data.data.changes[].changeDate` | string | 变更日期 |
| `data.data.taxCredits` | array | 纳税信息列表 |
| `data.data.taxCredits[].taxPayerNo` | string | 纳税人识别号 |
| `data.data.taxCredits[].taxPayerName` | string | 纳税人名称 |
| `data.data.taxCredits[].year` | string | 评价年度 |
| `data.data.taxCredits[].level` | string | 信用等级 |
| `data.data.contactInfo.website` | array | 网站列表（含 name、url） |
| `data.data.contactInfo.phoneNumber` | string | 联系电话 |
| `data.data.contactInfo.email` | string | 联系邮箱 |
| `data.data.employees` | array | 企业高管列表 |
| `data.data.employees[].employeeName` | string | 高管姓名 |
| `data.data.employees[].position` | string | 职位 |
| `data.data.exceptions` | array | 经营异常记录列表 |
| `data.data.exceptions[].addReason` | string | 列入异常名录原因 |
| `data.data.exceptions[].addDate` | string | 列入日期 |
| `data.data.exceptions[].romoveReason` | string | 移出原因 |
| `data.data.exceptions[].removeDate` | string | 移出日期 |
| `data.data.exceptions[].decisionOffice` | string | 做出决定机关 |
| `data.data.exceptions[].removeDecisionOffice` | string | 移出决定机关 |
| `data.data.industry.industryL1Code` | string | 一级行业编码 |
| `data.data.industry.industryL1Name` | string | 一级行业名称 |
| `data.data.industry.industryL2Code` | string | 二级行业编码 |
| `data.data.industry.industryL2Name` | string | 二级行业名称 |
| `data.data.industry.industryL3Code` | string | 三级行业编码 |
| `data.data.industry.industryL3Name` | string | 三级行业名称 |
| `data.data.industry.industryL4Code` | string | 四级行业编码 |
| `data.data.industry.industryL4Name` | string | 四级行业名称 |
| `data.data.liquidation` | object? | 公司清算信息 |
| `data.data.liquidation.leader` | string | 清算组负责人 |
| `data.data.liquidation.member` | string | 清算组成员 |
| `data.data.partners` | array | 股东信息列表 |
| `data.data.partners[].stockName` | string | 股东名称 |
| `data.data.partners[].stockType` | string | 股东类型 |
| `data.data.partners[].stockPercent` | string | 出资比例 |
| `data.data.partners[].stockCapital` | string | 认缴出资额（万元） |
| `data.data.partners[].shoudDate` | string? | 认缴出资时间 |
| `data.data.partners[].investType` | string | 认缴出资方式 |
| `data.data.partners[].stockRealcapital` | string? | 实缴出资额 |
| `data.data.partners[].capiDate` | string? | 实缴时间 |
| `data.data.partners[].investName` | string? | 实际出资方式 |
| `data.data.punishes` | array | 行政处罚记录列表 |
| `data.data.punishes[].punishCode` | string | 行政处罚决定书文号 |
| `data.data.punishes[].illegalType` | string | 违法行为类型 |
| `data.data.punishes[].authority` | string | 行政处罚决定机关名称 |
| `data.data.punishes[].content` | string | 行政处罚内容 |
| `data.data.punishes[].punishDate` | string | 作出行政处罚决定日期 |
| `data.data.punishes[].publicDate` | string | 公示日期 |
| `data.data.punishes[].punishContent` | string | 备注 |
| `data.data.allows` | array | 行政许可记录列表 |
| `data.data.allows[].docName` | string | 许可项目名称 |
| `data.data.allows[].office` | string | 许可机关 |
| `data.data.allows[].content` | string | 许可内容 |
| `data.data.allows[].startDate` | string | 有效期自 |
| `data.data.allows[].endDate` | string | 有效期至 |
| `data.data.allows[].docNo` | string | 决定文书号 |
| `data.data.pledges` | array | 股权出质列表 |
| `data.data.pledges[].registNo` | string | 质权登记编号 |
| `data.data.pledges[].pledgor` | string | 出质人 |
| `data.data.pledges[].pledgorNo` | string | 出质人证照编号 |
| `data.data.pledges[].pledgee` | string | 质权人 |
| `data.data.pledges[].pledgeeNo` | string | 质权人证照编号 |
| `data.data.pledges[].pledgedAmount` | string | 出质股权数额 |
| `data.data.pledges[].regDate` | string | 股权出质设立登记日期 |
| `data.data.pledges[].publicDate` | string | 公示时间 |
| `data.data.pledges[].status` | string | 出质状态 |
| `data.data.mpledges` | array | 动产抵押列表 |
| `data.data.mpledges[].registerNo` | string | 登记编号 |
| `data.data.mpledges[].registerDate` | string | 登记时间 |
| `data.data.mpledges[].publicDate` | string | 公示日期 |
| `data.data.mpledges[].registerOffice` | string | 登记机关 |
| `data.data.mpledges[].debtSecuredAmount` | string | 被担保债权数额 |
| `data.data.mpledges[].status` | string | 状态 |
| `data.data.spotChecks` | array | 企业抽查检查记录列表 |
| `data.data.spotChecks[].no` | string | 登记编号 |
| `data.data.spotChecks[].executiveOrg` | string | 检查实施机关 |
| `data.data.spotChecks[].type` | string | 类型 |
| `data.data.spotChecks[].date` | string | 日期 |
| `data.data.spotChecks[].consequence` | string | 结果 |
| `data.data.spotChecks[].remark` | string | 备注 |
| `data.data.originalName` | array | 曾用名列表 |
| `data.data.originalName[].name` | string | 曾用名 |
| `data.data.originalName[].changeDate` | string | 变更日期 |
| `data.data.shiXinItems` | array | 失信被执行记录列表 |
| `data.data.shiXinItems[].iname` | string | 公司名称 |
| `data.data.shiXinItems[].regDate` | string | 立案日期 |
| `data.data.shiXinItems[].caseCode` | string | 立案文书号 |
| `data.data.shiXinItems[].cardnum` | string | 组织机构代码 |
| `data.data.shiXinItems[].gistCid` | string | 执行依据文号 |
| `data.data.shiXinItems[].publishDate` | string | 发布时间 |
| `data.data.shiXinItems[].performedPart` | string | 被执行人履行情况 |
| `data.data.shiXinItems[].disreputTypeName` | string | 行为备注 |
| `data.data.shiXinItems[].courtName` | string | 执行法院 |
| `data.data.zhiXingItems` | array | 被执行记录列表 |
| `data.data.zhiXingItems[].zxId` | string | 官网系统 ID |
| `data.data.zhiXingItems[].pname` | string | 名称 |
| `data.data.zhiXingItems[].caseCreatetime` | string | 立案时间 |
| `data.data.zhiXingItems[].caseCode` | string | 立案号 |
| `data.data.zhiXingItems[].execCourtname` | string | 执行法院 |
| `data.data.zhiXingItems[].execMoney` | string | 标的 |
| `data.data.zhiXingItems[].caseState` | string | 状态 |
| `data.data.zhiXingItems[].partyCardnum` | string | 身份证号码/组织机构代码 |
| `data.data.zhiXingItems[].lastupdatetime` | string | 数据更新时间 |

### 失败响应（code: 400）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 错误状态码，如 400 |
| `msg` | string | 错误描述，如"入参错误" |
| `success` | boolean | `false` |
| `data` | object | 空对象 `{}` |

---

## 生成期代码

```typescript
// 生成期直接调用：企业工商全维度查询
// platform_managed 模式，密钥由平台注入
const apiKey = process.env["INTEGRATIONS_API_KEY"]!;

interface BusinessBase {
  keyNo: string;
  companyName: string;
  companyCode: string;
  creditNo: string;
  orgCode: string;
  legalPerson: string;
  establishDate: string;
  companyStatus: string;
  capital: string;
  companyType: string;
  companyAddress: string;
  businessScope: string;
  businessDateFrom: string;
  businessDateTo: string | null;
  revokeDate: string | null;
  province: string;
  updatedDate: string;
  issueDate: string;
  authority: string;
  isOnStock: string | null;
  stockNumber: string | null;
  stockType: string | null;
  logoUrl: string | null;
  realCaptical: string | null;
}

interface BusinessData {
  base: BusinessBase;
  branches: object[];
  changes: object[];
  taxCredits: object[];
  contactInfo: { website: object[]; phoneNumber: string; email: string };
  employees: { employeeName: string; position: string }[];
  exceptions: object[];
  industry: {
    industryL1Code: string;
    industryL1Name: string;
    industryL2Code: string;
    industryL2Name: string;
    industryL3Code: string;
    industryL3Name: string;
    industryL4Code: string;
    industryL4Name: string;
  };
  liquidation: { leader: string; member: string } | null;
  partners: object[];
  punishes: object[];
  allows: object[];
  pledges: object[];
  mpledges: object[];
  spotChecks: object[];
  originalName: object[];
  shiXinItems: object[];
  zhiXingItems: object[];
}

interface BusinessQueryResult {
  orderNo: string;
  data: BusinessData;
}

/**
 * 查询企业工商全维度信息
 * @param keyword - 公司名全称、注册号或统一社会信用代码
 * @returns 企业全维度工商信息
 */
async function queryBusinessInfo(keyword: string): Promise<BusinessQueryResult> {
  const url = new URL(
    "https://app-cblk1rqa5fk1-api-e94GZ5j0Kxja-gateway.appmiaoda.com/business4/get"
  );
  url.searchParams.set("keyword", keyword);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (!json.success || json.code !== 200) {
    throw new Error(`API error ${json.code}: ${json.msg}`);
  }

  return json.data as BusinessQueryResult;
}

// 示例：查询"百度"
const result = await queryBusinessInfo("百度");
console.log("公司名称:", result.data.base.companyName);
console.log("法定代表人:", result.data.base.legalPerson);
console.log("注册资本:", result.data.base.capital);
console.log("企业状态:", result.data.base.companyStatus);
console.log("经营范围:", result.data.base.businessScope);
```

---

## Edge Function 代码

> 本插件支持 Web 和 MiniProgram 平台，均返回 JSON 数据，Edge Function 实现相同。

```typescript
// edge-functions/business4-query.ts
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
    if (!keyword || typeof keyword !== "string" || keyword.trim() === "") {
      throw new Error("Missing or invalid keyword");
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body, keyword is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 注入平台密钥（严禁暴露到前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const upstreamUrl = new URL(
    "https://app-cblk1rqa5fk1-api-e94GZ5j0Kxja-gateway.appmiaoda.com/business4/get"
  );
  upstreamUrl.searchParams.set("keyword", keyword.trim());

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Gateway-Authorization": `Bearer ${apiKey}`,
    },
  });

  // 转发配额/余额错误（原文透传）
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

### Web 平台（React / Vue）

**推荐方式（supabase client 可用时）：**

```typescript
/**
 * 通过 Edge Function 查询企业工商信息
 * @param keyword - 公司名称、注册号或统一社会信用代码
 * @returns 企业工商全维度数据
 */
async function queryBusinessInfo(keyword: string) {
  const { data, error } = await supabase.functions.invoke("business4-query", {
    body: { keyword },
  });
  if (error) throw error;
  if (!data.success || data.code !== 200) {
    throw new Error(`API 错误 ${data.code}：${data.msg}`);
  }
  return data.data;
}

// 使用示例
const result = await queryBusinessInfo("百度");
console.log(result.data.base.companyName);
```

**备用方式（无法使用 supabase client 时）：**

```typescript
/**
 * 通过原生 fetch 调用 Edge Function 查询企业工商信息
 * @param keyword - 公司名称、注册号或统一社会信用代码
 * @returns 企业工商全维度数据
 */
async function queryBusinessInfo(keyword: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business4-query`,
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
  if (!json.success || json.code !== 200) {
    throw new Error(`API 错误 ${json.code}：${json.msg}`);
  }
  return json.data;
}
```

### MiniProgram 平台（Taro）

```typescript
/**
 * 通过 Edge Function 查询企业工商信息（MiniProgram）
 * @param keyword - 公司名称、注册号或统一社会信用代码
 * @returns 企业工商全维度数据
 */
async function queryBusinessInfo(keyword: string) {
  const { data, error } = await supabase.functions.invoke("business4-query", {
    body: { keyword },
  });
  if (error) throw error;
  if (!data.success || data.code !== 200) {
    throw new Error(`API 错误 ${data.code}：${data.msg}`);
  }
  return data.data;
}

// 使用示例（Taro React 组件内）
const [companyInfo, setCompanyInfo] = useState(null);
const [loading, setLoading] = useState(false);

const handleSearch = async (keyword: string) => {
  setLoading(true);
  try {
    const result = await queryBusinessInfo(keyword);
    setCompanyInfo(result);
  } catch (err) {
    Taro.showToast({ title: (err as Error).message, icon: "none" });
  } finally {
    setLoading(false);
  }
};
```

---

## 注意事项

1. **密钥安全**：`INTEGRATIONS_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
2. **错误处理**：务必处理 429（配额超限）和 402（余额不足）两种状态码，直接向用户展示友好提示。
3. **计费**：原价 ¥12.00 / 次，折扣价 ¥7.50 / 次（`enable_billing: true`）。每次查询均计费，避免重复查询相同公司；建议在前端缓存查询结果或加防抖处理。
4. **输入关键字**：`keyword` 支持公司名全称、注册号（companyCode）、组织机构代码（orgCode）或统一社会信用代码（creditNo）；不支持模糊匹配，建议优先使用全称或信用代码以获得精准结果。
5. **数据时效**：返回数据有 `base.updatedDate` 字段，可用于判断数据新鲜度；部分字段（如 `taxCredits`、`spotChecks`）在初次注册企业中可能为空数组，属于正常情况。
6. **失败响应**：`success: false` 时，`data` 为空对象，需检查 `code` 和 `msg` 定位原因（如入参错误 code=400）。
