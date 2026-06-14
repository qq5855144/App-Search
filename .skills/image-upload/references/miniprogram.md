<IMAGE_UPLOAD_REQUIREMENTS>
* IMAGE PLATFORM & ARCHITECTURE RULES:
  1. **Mandatory Supabase Storage**
     - All image uploads must use Supabase Storage buckets
     - Buckets must be created using `supabase_apply_migration`
     - Naming convention: `<BUSINESS_NAME>_images`
     - CRITICAL: Never use mock URLs or local temp paths as final image URLs
     - In WeChat MiniProgram, `tempFilePath` (e.g., `wxfile://tmp_xxx.jpg`) MUST be passed to `uploadToSupabase` — the underlying `supabase-wechat-js` converts it to `wx.uploadFile` internally. Do NOT read the file into ArrayBuffer first.
  2. **Bucket Policies**
     - If no login system: all users must be granted permission to upload images
     - If login system exists: admins must be granted permission to upload images
  3. **File Size & Format**
     - Default maximum upload size: 1 MB (enforced by bucket configuration)
     - If file exceeds limit, trigger automatic compression:
       - Convert images to WEBP format
       - Restrict maximum resolution to 1080p (preserve aspect ratio)
       - Apply quality setting = 0.8 and auto-degrade iteratively until < 1 MB
     - Supported formats: JPEG, PNG, GIF, WEBP, AVIF
     - Filename Rules: Only English letters and numbers allowed

* ADDITIONAL FRONTEND INTEGRATION RULES:
  - Design clear **Upload Button**
  - Display **upload progress bar** in real-time
  - Notify users explicitly on **upload success** or **failure**
  - If compression is applied, inform user and display final file size

* FILE UPLOAD IMPLEMENTATION GUIDELINES:
  1. **Use the scaffold utility `src/utils/upload.ts`**
     The scaffold provides three ready-to-use functions:
     - `selectMediaFiles(options)` — select images/videos via `Taro.chooseMedia`, returns `MiniProgramFileInput[]` (weapp) or `File[]` (H5)
     - `selectMessageFile(options)` — select documents (PDF etc.) from WeChat chat (weapp) or system file picker (H5)
     - `uploadToSupabase(file, { bucket, userId })` — cross-platform upload to Supabase Storage, returns `{ success, data, error }`

  2. **Image Display**
     - **Weapp**: use `tempFilePath` directly as preview before upload (`<Image src={file.tempFilePath} />`)
     - **H5**: upload immediately on file selection, then use the Supabase public URL for preview (`supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl`)
     - After upload (both platforms): display with `<Image src={publicUrl} mode="aspectFit" />`

  3. **`uploadToSupabase` returns a storage path, not a URL** — `data.path` is a relative path like `userId/filename.jpg`. Always store `path` in the database.
     - Whenever the path needs to leave the frontend (image display, passing to an Edge Function, calling an external API), convert it first: `supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl`

  4. **Store the full file object in state, not just the path string**
     - Store the entire object returned by `selectMediaFiles` (e.g. `useState<MiniProgramFileInput | File | null>`)
     - Pass it directly to `uploadToSupabase` — do NOT reconstruct a new object from `tempFilePath` alone, as this loses `name` and `type`, causing `application/octet-stream` MIME errors

  5. **DO NOT use deprecated `Taro.chooseImage`** — always use `selectMediaFiles` from `src/utils/upload.ts`

* PDF/DOCUMENT PREVIEW & DOWNLOAD:
  1. **Preview PDF**
     - **Weapp**: `Taro.downloadFile({ url })` → check `statusCode === 200` → `Taro.openDocument({ filePath: res.tempFilePath, fileType: 'pdf', showMenu: true })`
     - **H5**: `window.open(url, '_blank')`
  2. **Download PDF**
     - **Weapp**: reuse preview logic (`openDocument` with `showMenu: true` provides native save)
     - **H5**: `fetch(url)` → `response.blob()` → `URL.createObjectURL(blob)` → create `<a>` with `download=fileName` → `click()` → `revokeObjectURL`
  3. **Note**: `selectMessageFile` returns filename (unlike `selectMediaFiles`) — store and use it for download filename
</IMAGE_UPLOAD_REQUIREMENTS>
