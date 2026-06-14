# 编辑演示文稿

## 基于模板的工作流程

使用现有演示文稿作为模板时：

1. **分析现有幻灯片**：
   ```bash
   python -m markitdown template.pptx
   ```
   查看 markitdown 输出了解占位符文字和幻灯片结构。

2. **规划幻灯片映射**：为每个内容章节选择一个模板幻灯片。

   ⚠️ **使用多样化布局** — 单调是常见失败模式。主动寻找：
   - 多列布局（双列、三列）
   - 图片+文字组合
   - 全出血图片加文字叠层
   - 引言或标注幻灯片
   - 章节分隔页
   - 数字标注幻灯片
   - 图标网格或图标+文字行

3. **解包**：`python scripts/office/unpack.py template.pptx ./unpacked/`

4. **清查表格和图表**（在编辑文字**之前**执行）：
   ```bash
   grep -rl "a:tbl" ./unpacked/ppt/slides/
   ls ./unpacked/ppt/charts/ 2>/dev/null
   ```
   记录哪些幻灯片含有表格、哪些图表文件存在——这些需要替换数据。

5. **构建演示文稿结构**（自己操作，不用子代理）：
   - 删除不需要的幻灯片（从 `<p:sldIdLst>` 中移除）
   - 复制要复用的幻灯片：`python scripts/add_slide.py ./unpacked/ slide2.xml`
   - 在 `<p:sldIdLst>` 中重新排列幻灯片顺序
   - **在第 6 步之前完成所有结构性修改**

6. **编辑文字内容** — 如果可用子代理，在此使用（幻灯片是独立的 XML 文件，可并行处理）：
   - 读取幻灯片的 XML
   - 识别**所有**占位符内容——文字、图片、图表、图标、说明
   - 用最终内容替换每个占位符
   - **使用 Edit 工具，不要用 sed 或 Python 脚本**

7. **替换表格数据**（如有表格——见下方[表格数据替换](#表格数据替换)）

8. **替换图表数据**（如有图表——见下方[图表数据替换](#图表数据替换)）

9. **清理**：`python scripts/clean.py ./unpacked/`

10. **打包**：`python scripts/office/pack.py ./unpacked/ ./output.pptx --original template.pptx`

11. **验证**：
    ```bash
    # XML 结构验证（检查手动编辑是否损坏 XML）
    python scripts/office/validate.py ./output.pptx

    # 内容验证（检查是否有残留模板数据）
    python -m markitdown ./output.pptx | grep -iE "steaming|tapai|lorem|ipsum|xxxx|placeholder"
    ```
    XML 验证报错 = 编辑时改坏了结构，PowerPoint 打开可能异常，建议修复。内容验证有匹配 = 模板数据仍存在，修复后再交付。两者均不影响文件本身的生成。

---

## 脚本说明

| 脚本 | 用途 |
|--------|---------|
| `scripts/office/unpack.py` | 解压并格式化输出 PPTX |
| `scripts/add_slide.py` | 复制幻灯片或从布局新建 |
| `scripts/clean.py` | 清理孤立文件 |
| `scripts/office/pack.py` | 重新打包并验证 |

---

## 表格数据替换

**所有前代 skill 都在这里失败了。** 本节解决这个问题。

### 查找表格

解包后执行：
```bash
grep -rl "a:tbl" ./unpacked/ppt/slides/
```

### 理解表格结构

PPTX XML 中的表格结构如下：
```xml
<a:tbl>
  <a:tr>                          <!-- 行 -->
    <a:tc>                        <!-- 单元格 -->
      <a:txBody>
        <a:p>
          <a:r>
            <a:t>标题文字</a:t>   <!-- ← 实际内容 -->
          </a:r>
        </a:p>
      </a:txBody>
    </a:tc>
    <a:tc>
      <a:txBody><a:p><a:r><a:t>另一个单元格</a:t></a:r></a:p></a:txBody>
    </a:tc>
  </a:tr>
</a:tbl>
```

### 替换表格内容

对每个表格单元格，使用 **Edit 工具**替换 `<a:t>` 中的文字：

```xml
<!-- 替换前（模板数据） -->
<a:t>Steaming time</a:t>

<!-- 替换后（实际内容） -->
<a:t>Q1 营收</a:t>
```

**逐行操作**：先读取完整的表格 XML，规划好所有替换，再依次执行。不要猜测——替换前确认现有文字的准确内容。

### 多运行段单元格

部分单元格的文字分散在多个运行段中：
```xml
<a:tc>
  <a:txBody><a:p>
    <a:r><a:rPr b="1"/><a:t>加粗 </a:t></a:r>
    <a:r><a:t>常规文字</a:t></a:r>
  </a:p></a:txBody>
</a:tc>
```
可以逐个替换 `<a:t>` 的值，或在格式不重要时合并为一个运行段。

---

## 图表数据替换

图表文件位于 `./unpacked/ppt/charts/chartN.xml`。

### 理解图表结构

```xml
<c:chartSpace>
  <c:chart>
    <c:plotArea>
      <c:barChart>
        <c:ser>                              <!-- 一个数据系列 -->
          <c:tx><c:strRef>...</c:strRef></c:tx>   <!-- 系列名称 -->
          <c:cat>                            <!-- 类别标签（X轴） -->
            <c:strRef>
              <c:strCache>
                <c:ptCount val="4"/>
                <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                <c:pt idx="2"><c:v>Q3</c:v></c:pt>
                <c:pt idx="3"><c:v>Q4</c:v></c:pt>
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>                            <!-- 数据值（Y轴） -->
            <c:numRef>
              <c:numCache>
                <c:ptCount val="4"/>
                <c:pt idx="0"><c:v>42</c:v></c:pt>
                <c:pt idx="1"><c:v>58</c:v></c:pt>
                <c:pt idx="2"><c:v>71</c:v></c:pt>
                <c:pt idx="3"><c:v>89</c:v></c:pt>
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>
```

### 替换图表数据

1. 读取图表 XML
2. 替换 `<c:cat>`（标签）和 `<c:val>`（数值）中的 `<c:v>` 值
3. 如需更改数据点数量，更新 `<c:ptCount val="N"/>` 并调整 `idx` 属性

**使用 Edit 工具** — 替换具体的 `<c:v>` 内容，而不是重写整个章节。

### 替换图表数据后

图表 XML 中还包含缓存的单元格引用，如 `<c:f>Sheet1!$A$2:$A$5</c:f>`。无需更新这些——如果没有内嵌的工作簿，PowerPoint 会直接从 `<c:strCache>` / `<c:numCache>` 读取。

---

## 编辑内容（文字）

**子代理**：完成第 5 步后使用。每张幻灯片是独立的 XML 文件，子代理可以并行编辑。给子代理的提示中需包含：
- 要编辑的幻灯片文件路径
- **"所有修改使用 Edit 工具"**
- 下方的格式规则和常见陷阱

对每张幻灯片：
1. 读取幻灯片的 XML
2. 识别**所有**占位符内容——文字、图片、图表、图标、说明
3. 用最终内容替换每个占位符

**使用 Edit 工具，不要用 sed 或 Python 脚本。**

### 格式规则

- **所有标题、小标题和行内标签加粗**：在 `<a:rPr>` 上设置 `b="1"`
- **不使用 Unicode 项目符号（•）**：使用 `<a:buChar>` 或 `<a:buAutoNum>`
- **项目符号一致性**：让项目符号从布局继承

---

## 常见陷阱

### 模板适配

当源内容的条目少于模板时：
- **完整删除多余元素**（图片、形状、文本框），不能只清空文字
- 清空文字内容后检查是否有孤立的视觉元素
- 进行视觉 QA，发现数量不匹配的情况

当用不同长度的内容替换文字时：
- **较短的替换**：通常安全
- **较长的替换**：可能溢出——用视觉 QA 检验

**模板位置 ≠ 源条目数**：如果模板有 4 个团队成员但源只有 3 个，删除第 4 个成员的完整分组（图片 + 文本框）。

### 多条目内容

每个条目创建独立的 `<a:p>` 元素——不要拼接成一个字符串。

```xml
<!-- ❌ 错误 -->
<a:p><a:r><a:t>步骤一：执行X。步骤二：执行Y。</a:t></a:r></a:p>

<!-- ✅ 正确 -->
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr b="1"/><a:t>步骤一</a:t></a:r>
</a:p>
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:t>执行X。</a:t></a:r>
</a:p>
```

### 智能引号

解包/打包时自动处理。添加包含引号的新文字时，使用 XML 实体：

| 字符 | XML 实体 |
|-----------|------------|
| `"` （左双引号） | `&#x201C;` |
| `"` （右双引号） | `&#x201D;` |
| `'` （左单引号） | `&#x2018;` |
| `'` （右单引号） | `&#x2019;` |

### 其他注意事项

- **空白字符**：有前导/尾随空格时，在 `<a:t>` 上使用 `xml:space="preserve"`
- **XML 解析**：使用 `defusedxml.minidom`，不要用 `xml.etree.ElementTree`（会破坏命名空间）
