---
name: vehicle-traffic-restriction
description: 查询全国多城市汽车尾号限行信息，获取指定日期的限行尾号、限行时段和限行区域；适用于出行规划、生活服务类应用场景
license: MIT
---

## 能力概述

本技能封装「汽车尾号限行查询」插件，提供两个接口：

| 接口 | 方法 | Endpoint |
|------|------|----------|
| 城市限行查询 | POST | `https://app-cblk1rqa5fk1-api-pLVzAxRQyMWL-gateway.appmiaoda.com/vehiclelimit/query` |
| 获取支持限行查询的城市列表 | POST | `https://app-cblk1rqa5fk1-api-DYJwnJVBwb4a-gateway.appmiaoda.com/vehiclelimit/city` |

**认证模式：** `platform_managed`（密钥由平台注入，读取 `INTEGRATIONS_API_KEY` 环境变量）
- Auth Header 为 `X-Gateway-Authorization: Bearer ${INTEGRATIONS_API_KEY}`（注意不是标准的 `Authorization`）。

**支持城市：** 北京、天津、杭州、成都、兰州、贵阳、南昌、长春、哈尔滨、武汉、上海、深圳（共 12 个城市）

**典型响应示例（城市限行查询）：**
```json
{
  "status": 0,
  "msg": "ok",
  "result": {
    "city": "hangzhou",
    "cityname": "杭州",
    "date": "2015-12-03",
    "week": "星期四",
    "time": ["07:00-09:00", "16:30-18:30"],
    "area": "留祥路—石祥路—石桥路—秋涛路—复兴路构成的围合区域",
    "summary": "本市号牌尾号限行，外地号牌全部限行",
    "numberrule": "最后一位数字",
    "number": "4和6"
  }
}
```

## 生成期用法（Agent 直接调用）

包含两个接口的完整实现，详见 `references/vehiclelimit-api.md` — 生成期代码章节。

## 生成后用法（应用内通过 Edge Function 调用）

需要为两个接口分别部署 Edge Function：

| Edge Function | 功能 | 计费 |
|--------------|------|------|
| `vehiclelimit-query` | 按城市+日期查询限行规则 | 是（¥0.85/千次，原价 ¥1.10/千次） |
| `vehiclelimit-city` | 获取支持限行查询的城市列表 | 否 |

Web 与 MiniProgram 平台均返回 JSON，前端调用方式相同，可统一使用 `supabase.functions.invoke`。

详见 `references/vehiclelimit-api.md` — Edge Function 与前端调用代码章节。
