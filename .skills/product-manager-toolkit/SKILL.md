---
name: product-manager-toolkit
description: 产品经理综合工具包，包含 RICE 优先级排序、客户访谈分析、PRD 模板、需求发现框架和上市策略。当用户需要进行功能优先级排序、用户研究分析、需求文档编写或产品策略制定时触发。
license: MIT
---

# 产品经理工具包

从需求发现到交付上市的现代产品管理必备工具和框架。

---

## 目录

- [快速开始](#快速开始)
- [核心工作流](#核心工作流)
  - [功能优先级排序](#功能优先级排序流程)
  - [客户洞察发现](#客户洞察发现流程)
  - [PRD 文档开发](#prd文档开发流程)
- [工具参考](#工具参考)
  - [RICE 优先级排序器](#rice-优先级排序器)
  - [客户访谈分析器](#客户访谈分析器)
- [输入输出示例](#输入输出示例)
- [集成对接](#集成对接)
- [常见陷阱](#常见陷阱)

---

## 快速开始

### 功能优先级排序

```bash
# 创建示例数据文件
python scripts/rice_prioritizer.py sample

# 运行优先级排序（指定团队容量）
python scripts/rice_prioritizer.py sample_features.csv --capacity 15
```

### 访谈分析

```bash
python scripts/customer_interview_analyzer.py interview_transcript.txt
```

### PRD 创建

1. 从 `references/prd_templates.md` 选择模板
2. 基于发现工作填充各章节
3. 与工程团队评审可行性
4. 在项目管理工具中版本控制

---

## 核心工作流

### 功能优先级排序流程

```
收集 → 评分 → 分析 → 规划 → 验证 → 执行
```

#### 第一步：收集功能需求

- 客户反馈（支持工单、访谈记录）
- 销售需求（CRM pipeline 阻塞点）
- 技术债务（工程团队输入）
- 战略举措（领导层目标）

#### 第二步：RICE 评分

```bash
# 输入：包含功能的 CSV 文件
python scripts/rice_prioritizer.py features.csv --capacity 20
```

详见 `references/frameworks.md` 中的 RICE 公式和评分指南。

#### 第三步：组合分析

审阅工具输出：
- 速赢项目 vs 大赌注的分布
- 工作量集中度（避免全部是超大项目）
- 战略对齐缺口

#### 第四步：生成路线图

- 按季度分配容量
- 识别依赖关系
- 制定干系人沟通计划

#### 第五步：验证结果

**确定路线图前请检查：**
- [ ] 将最高优先级与战略目标对比
- [ ] 运行敏感性分析（如果估算偏差 2 倍会怎样？）
- [ ] 与关键干系人 review，发现盲点
- [ ] 检查功能之间的依赖关系是否遗漏
- [ ] 与工程团队验证工作量估算

#### 第六步：执行与迭代

- 与团队分享路线图
- 跟踪实际 vs 估算工作量
- 每季度重新审视优先级
- 基于经验更新 RICE 输入

---

### 客户洞察发现流程

```
规划 → 招募 → 访谈 → 分析 → 综合 → 验证
```

#### 第一步：规划研究

- 定义研究问题
- 识别目标用户群体
- 创建访谈脚本（见 `references/frameworks.md`）

#### 第二步：招募参与者

- 每个群体 5-8 次访谈
- 混合重度用户和流失用户
- 提供适当激励

#### 第三步：执行访谈

- 使用半结构化格式
- 聚焦问题，而非解决方案
- 获得许可后录音
- 访谈期间做最少笔记

#### 第四步：分析洞察

```bash
python scripts/customer_interview_analyzer.py transcript.txt
```

提取内容：
- 痛点及严重程度
- 功能请求及优先级
- 待办任务模式
- 情感和关键主题
-  notable 引用

#### 第五步：综合发现

- 跨访谈归类相似痛点
- 识别模式（3 次以上提及 = 模式）
- 使用机会解决方案树映射到机会领域
- 按频率和严重程度排序机会

#### 第六步：验证解决方案

**构建前请确认：**
- [ ] 创建解决方案假设（见 `references/frameworks.md`）
- [ ] 用低保真原型测试
- [ ] 衡量实际行为 vs 口头偏好
- [ ] 基于反馈迭代
- [ ] 记录经验供未来研究参考

---

### PRD 文档开发流程

```
定范围 → 起草 → 评审 → 精炼 → 审批 → 跟踪
```

#### 第一步：选择模板

从 `references/prd_templates.md` 选择：

| 模板 | 适用场景 | 时间线 |
|------|----------|--------|
| 标准 PRD | 复杂功能，跨团队 | 6-8 周 |
| 单页 PRD | 简单功能，单团队 | 2-4 周 |
| 功能简报 | 探索阶段 | 1 周 |
| 敏捷 Epic | 基于 Sprint 交付 | 持续 |

#### 第二步：起草内容

- 以问题陈述开头
-  upfront 定义成功指标
- 明确声明范围外内容
- 包含线框图或原型

#### 第三步：评审周期

- 工程：可行性和工作量
- 设计：用户体验缺口
- 销售：市场验证
- 支持：运营影响

#### 第四步：基于反馈精炼

- 处理技术约束
- 调整范围以适应时间线
- 记录权衡决策

#### 第五步：审批与启动

- 干系人签字
- 集成到 Sprint 规划
- 向更广泛的团队沟通

#### 第六步：跟踪执行

**上线后：**
- [ ] 对比实际指标与目标
- [ ] 开展用户反馈会议
- [ ] 记录哪些有效、哪些无效
- [ ] 更新估算准确度数据
- [ ] 与团队分享经验

---

## 工具参考

### RICE 优先级排序器

高级 RICE 框架实现，支持组合分析。

**功能：**
- RICE 分数计算（可配置权重）
- 组合平衡分析（速赢 vs 大赌注）
- 基于容量的季度路线图生成
- 多种输出格式（文本、JSON、CSV）

**CSV 输入格式：**
```csv
name,reach,impact,confidence,effort,description
用户仪表盘重设计,5000,high,high,l,完整重设计
移动端推送通知,10000,massive,medium,m,增加推送支持
深色模式,8000,medium,high,s,深色主题选项
```

**命令：**
```bash
# 创建示例数据
python scripts/rice_prioritizer.py sample

# 使用默认容量运行（10 人月）
python scripts/rice_prioritizer.py features.csv

# 自定义容量
python scripts/rice_prioritizer.py features.csv --capacity 20

# JSON 输出（用于集成）
python scripts/rice_prioritizer.py features.csv --output json

# CSV 输出（用于电子表格）
python scripts/rice_prioritizer.py features.csv --output csv
```

---

### 客户访谈分析器

基于 NLP 的访谈分析，提取可执行洞察。

**能力：**
- 痛点提取及严重程度评估
- 功能请求识别与分类
- 待办任务模式识别
- 按章节情感分析
- 主题和引用提取
- 竞争对手提及检测

**命令：**
```bash
# 分析访谈记录
python scripts/customer_interview_analyzer.py interview.txt

# JSON 输出（用于聚合）
python scripts/customer_interview_analyzer.py interview.txt json
```

---

## 输入输出示例

详见 `references/input-output-examples.md`

---

## 集成对接

兼容的工具和平台：

| 类别 | 平台 |
|------|------|
| **数据分析** | Amplitude, Mixpanel, Google Analytics |
| **路线图** | ProductBoard, Aha!, Roadmunk, Productplan |
| **设计** | Figma, Sketch, Miro |
| **开发** | Jira, Linear, GitHub, Asana |
| **研究** | Dovetail, UserVoice, Pendo, Maze |
| **沟通** | Slack, Notion, Confluence |

**JSON 导出支持大多数工具集成：**
```bash
# 导出给 Jira 导入
python scripts/rice_prioritizer.py features.csv --output json > priorities.json

# 导出给仪表盘
python scripts/customer_interview_analyzer.py interview.txt json > insights.json
```

---

## 常见陷阱

| 陷阱 | 描述 | 预防 |
|------|------|------|
| **先想方案** | 还没理解问题就跳到功能 | 每个 PRD 都从问题陈述开始 |
| **分析瘫痪** | 过度研究而不交付 | 为研究阶段设置时间盒 |
| **功能工厂** | 交付功能但不衡量影响 | 构建前定义成功指标 |
| **忽视技术债务** | 不为平台健康分配时间 | 预留 20% 容量用于维护 |
| **干系人惊喜** | 沟通不及时、不充分 | 每周异步更新，每月 demo |
| **指标表演** | 优化虚荣指标而非真实价值 | 将指标与交付的用户价值挂钩 |

---

## 最佳实践

**写好 PRD：**
- 从问题开始，而非解决方案
-  upfront 包含清晰的成功指标
- 明确声明范围外内容
- 使用可视化（线框图、流程图、图表）
- 技术细节放在附录
- 版本控制所有变更

**有效优先级排序：**
- 速赢和战略赌注混合
- 考虑延迟的机会成本
- 考虑功能之间的依赖
- 预留 20% 缓冲应对意外工作
- 每季度重新审视优先级
- 带着上下文沟通决策

**客户洞察：**
- 问五次"为什么"找到根因
- 聚焦过去行为，而非未来意图
- 避免引导性问题（"难道你不喜欢..."）
- 在用户自然环境中访谈
- 注意情绪反应（痛苦 = 机会）
- 用定量数据验证定性发现

---

## 快速参考

```bash
# 优先级排序
python scripts/rice_prioritizer.py features.csv --capacity 15

# 访谈分析
python scripts/customer_interview_analyzer.py interview.txt

# 生成示例数据
python scripts/rice_prioritizer.py sample

# JSON 输出
python scripts/rice_prioritizer.py features.csv --output json
python scripts/customer_interview_analyzer.py interview.txt json
```

---

## 参考文档

- `references/prd_templates.md` — 不同场景的 PRD 模板
- `references/frameworks.md` — 详细框架文档（RICE、MoSCoW、Kano、JTBD 等）
- `references/input-output-examples.md` — 输入输出示例
