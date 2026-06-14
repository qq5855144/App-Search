# 微信小程序 Excel 处理

基于 Supabase Edge Function + Taro 实现，支持 H5 和微信小程序双端。

## 一、Excel 导入与导出

### 1.1 前置条件

> 注意：Supabase Storage 文件路径不支持中文字符，路径中只能包含字母、数字、连字符（`-`）、下划线（`_`）和点（`.`）。上传和导出时生成的文件名均须满足此要求。

**数据库表**

目标表需包含 `row_data` (jsonb) 列，每行 Excel 数据以 JSON 对象形式存入。

```sql
CREATE TABLE IF NOT EXISTS public.records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_data    jsonb        NOT NULL,
  imported_at timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON public.records FOR ALL USING (true) WITH CHECK (true);
```

**Storage 桶配置**

导入桶 `uploads`（私有，临时存放待解析文件）：

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads', 'uploads', false, 10485760,
  ARRAY[
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_upload" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "public_read"   ON storage.objects FOR SELECT TO public USING  (bucket_id = 'uploads');
```

导出桶 `exports`（公开读，生成公开下载链接）：

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports', 'exports', true, 52428800,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_upload_exports" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'exports');
```

### 1.2 后端 Edge Function 实现

**import-file（导入）**

实现思路：从 Storage 下载前端上传的 Excel 文件 → 通过 `import * as XLSX from 'npm:xlsx'` 引入 npm 包 `xlsx` 解析第一个工作表 → 按 `batch_size` 分批 INSERT 到目标表（每行存为 `row_data` jsonb）。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_path` | string | 是 | 文件在 Storage 中的路径 |
| `bucket` | string | 是 | Storage 桶名 |
| `table` | string | 是 | 目标数据库表名 |
| `batch_size` | number | 否 | 批量写入大小，默认 500 |

返回（成功）：`{ success: true, imported_count, sheet_name, columns }`

返回（失败）：`{ success: false, error }`

---

**export-file（导出）**

实现思路：查询目标表数据 → 将 `data_key` 指定的 jsonb 字段展开为列，并追加 `extra_columns` 中的额外列 → 用 `xlsx` 生成 `.xlsx` 文件 → 上传到公开 Storage 桶 → 返回公开下载链接。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `table` | string | 是 | 数据库表名 |
| `bucket` | string | 是 | 导出文件上传的 Storage 桶名（需为公开桶） |
| `columns` | string[] | 否 | 查询的列，默认 `['id', 'row_data', 'imported_at']` |
| `data_key` | string | 否 | 需要展开的 jsonb 字段名，如 `'row_data'` |
| `extra_columns` | Record\<string, string\> | 否 | 追加的额外列，如 `{ "导入时间": "imported_at" }` |
| `limit` | number | 否 | 最大导出行数，默认 5000 |
| `sheet_name` | string | 否 | 工作表名称，默认 `'数据'` |

返回（成功）：`{ success: true, url, file_name, row_count }`

返回（失败）：`{ success: false, error }`

### 1.3 前端 Taro 端调用

**类型定义**

```typescript
interface FileInput {
  name: string
  type: string
  size: number
  tempFilePath?: string  // 小程序专用
}
```

**selectFile — 文件选择**

```typescript
import Taro from '@tarojs/taro'

async function selectFile(accept = '.xlsx,.xls'): Promise<FileInput | null> {
  // H5
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    return new Promise<FileInput | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = (e: any) => {
        const f: File | undefined = e.target?.files?.[0]
        input.remove()
        resolve(f ? (f as unknown as FileInput) : null)
      }
      input.oncancel = () => { input.remove(); resolve(null) }
      input.click()
    })
  }

  // 小程序
  const extensions = accept.split(',').map((s) => s.replace('.', ''))
  const result = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: extensions })
  if (!result.tempFiles?.length) return null
  const f = result.tempFiles[0]
  const ext = f.name?.split('.').pop()?.toLowerCase() || ''
  const mimeMap: Record<string, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pdf: 'application/pdf',
    csv: 'text/csv',
  }
  return { name: f.name, type: mimeMap[ext] ?? 'application/octet-stream', size: f.size, tempFilePath: f.path }
}
```

**uploadToStorage — 上传到 Storage**

```typescript
import { supabase } from '@/client/supabase'

async function uploadToStorage(
  file: FileInput,
  bucket: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const ext = file.name?.split('.').pop() || 'bin'
    const storageName = `public/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
    const fileContent = Taro.getEnv() === Taro.ENV_TYPE.WEB
      ? (file as unknown as File)
      : { tempFilePath: file.tempFilePath }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storageName, fileContent as any, { contentType: file.type, upsert: false })

    if (error) throw error
    return { success: true, path: data.path }
  } catch (e: any) {
    return { success: false, error: e.message || '上传失败' }
  }
}
```

**downloadFile — 文件下载**

```typescript
async function downloadFile(url: string, fileName: string): Promise<void> {
  // 小程序
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEB) {
    const res = await Taro.downloadFile({ url })
    if (res.statusCode === 200) {
      await Taro.openDocument({ filePath: res.tempFilePath, showMenu: true })
    } else {
      throw new Error(`文件下载失败 (${res.statusCode})`)
    }
    return
  }

  // H5
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载失败: ${response.status}`)
  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)
}
```

**previewFile — 文件预览**

```typescript
async function previewFile(url: string, fileType: string): Promise<void> {
  // H5
  if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
    window.open(url, '_blank')
    return
  }

  // 小程序
  try {
    const downloadResult = await Taro.downloadFile({ url })
    if (downloadResult.statusCode !== 200) {
      throw new Error('文件下载失败')
    }
    await Taro.openDocument({
      filePath: downloadResult.tempFilePath,
      fileType: fileType as any,  // 'pdf' | 'xlsx' | 'doc' 等
      showMenu: true,
    })
  } catch (err) {
    console.error('预览失败:', err)
    Taro.showToast({ title: '预览失败，请稍后重试', icon: 'none' })
  }
}
```

**完整调用示例**

```typescript
import { supabase } from '@/client/supabase'

// 导入 Excel
async function handleImport() {
  const file = await selectFile('.xlsx,.xls')
  if (!file) return

  const uploadResult = await uploadToStorage(file, 'uploads')
  if (!uploadResult.success || !uploadResult.path) {
    throw new Error(`上传失败: ${uploadResult.error}`)
  }

  const { data, error } = await supabase.functions.invoke('import-file', {
    body: {
      file_path: uploadResult.path,
      bucket: 'uploads',
      table: 'records',
      batch_size: 500,
    },
  })

  if (error) throw new Error(await error?.context?.text?.() || error.message)
  if (!data?.success) throw new Error(data?.error || '导入失败')

  console.log(`导入 ${data.imported_count} 条数据`)
  return data  // { success, imported_count, sheet_name, columns }
}

// 导出 Excel
async function handleExport() {
  const { data, error } = await supabase.functions.invoke('export-file', {
    body: {
      table: 'records',
      bucket: 'exports',
      data_key: 'row_data',
      extra_columns: { '导入时间': 'imported_at' },
    },
  })

  if (error) throw new Error(await error?.context?.text?.() || error.message)
  if (!data?.success) throw new Error(data?.error || '导出失败')

  await downloadFile(data.url, data.file_name)
  return data  // { success, url, file_name, row_count }
}
```
