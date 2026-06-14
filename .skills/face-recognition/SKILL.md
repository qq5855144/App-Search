---
name: face-recognition
description: 人脸识别技能，提供人脸注册、人脸搜索、用户信息查询、用户列表获取、删除用户等人脸库管理能力，适用于考勤签到、活动签到等需要人脸身份验证的场景
license: MIT
---

## 能力概述

本 Skill 封装百度 AI 人脸识别平台（`app-cblk1rqa5fk1-api-l9nZz8ro7Bl9-gateway.appmiaoda.com`）的五个核心接口，通过 API Gateway 统一鉴权（platform_managed）对外暴露。

| 接口 | Endpoint | Method | 是否计费 |
|------|----------|--------|---------|
| 人脸注册 | `POST /rest/2.0/face/v3/faceset/user/add` | POST | 是（¥0.15/次） |
| 人脸搜索 | `POST /rest/2.0/face/v3/search` | POST | 是（¥0.15/次） |
| 用户信息查询 | `POST /rest/2.0/face/v3/faceset/user/get` | POST | 否 |
| 用户列表获取 | `POST /rest/2.0/face/v3/faceset/group/getusers` | POST | 否 |
| 删除用户 | `POST /rest/2.0/face/v3/faceset/user/delete` | POST | 否 |

- 认证模式：`platform_managed`，密钥由平台注入（`INTEGRATIONS_API_KEY`），Header 统一使用 `X-Gateway-Authorization: Bearer <key>`
- 支持平台：Web、MiniProgram
- 所有接口均返回 JSON，响应中 `error_code: 0` 表示成功

## 生成期用法（Agent 直接调用）

直接在脚本中调用各接口，密钥从环境变量读取。各接口的完整参数、TypeScript 示例代码详见对应 references 文件：

- 人脸注册：详见 `references/user-add-api.md`
- 人脸搜索：详见 `references/face-search-api.md`
- 用户信息查询：详见 `references/user-get-api.md`
- 用户列表获取：详见 `references/group-getusers-api.md`
- 删除用户：详见 `references/user-delete-api.md`

## 生成后用法（应用内通过 Edge Function 调用）

在应用中为每个接口单独部署一个 Supabase Edge Function，前端通过 `supabase.functions.invoke` 调用。各接口的完整 Edge Function 代码、前端调用代码、注意事项详见对应 references 文件：

| 接口 | Edge Function 文件名 | 参考文档 |
|------|---------------------|---------|
| 人脸注册 | `face-user-add` | `references/user-add-api.md` |
| 人脸搜索 | `face-search` | `references/face-search-api.md` |
| 用户信息查询 | `face-user-get` | `references/user-get-api.md` |
| 用户列表获取 | `face-group-getusers` | `references/group-getusers-api.md` |
| 删除用户 | `face-user-delete` | `references/user-delete-api.md` |

**平台差异说明：** 所有接口均返回 JSON 数据，Web 和 MiniProgram 共用同一套 Edge Function；前端调用方式相同，均使用 `supabase.functions.invoke`。
