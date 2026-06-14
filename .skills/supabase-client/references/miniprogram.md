# Supabase Frontend — WeChat MiniProgram (Taro / weapp)

## Technology Stack

- Taro framework for cross-platform mini-programs
- React components with TypeScript
- Use HTML tags to build page UI and layouts
- Tailwind CSS for styling (when applicable)

## Mini-Program Specific

- Follow WeChat Mini-Program design guidelines
- Implement WeChat-specific features (share, login)
- Handle mini-program lifecycle events properly
- Optimize for mini-program size limits

## Development Considerations

- Limited JavaScript APIs compared to web
- No direct DOM manipulation
- Use Taro.request for network requests
- Handle permissions properly (location, camera, etc.)
- `Taro.showModal` does NOT support `editable` or `placeholderText` — these are WeChat-native-only properties that Taro has not implemented. Using them causes TypeScript errors and runtime failures. For text input dialogs, build a custom modal component with `<input>` instead.

## Performance Optimization

- Minimize package size for faster loading
- Use setData efficiently to avoid performance issues
- Implement lazy loading for heavy components
- Optimize images for mini-program environment
- Reduce unnecessary re-renders

## Testing and Deployment

- Consider different device screen sizes
- Handle network conditions gracefully
- Implement proper error boundaries
- Follow WeChat review guidelines

## Audio Playback (InnerAudioContext)

- Always call `Taro.setInnerAudioOption({ speakerOn: true, obeyMuteSwitch: false })` **before** creating `InnerAudioContext`; without this, audio plays through earpiece instead of speaker on real devices
- `speakerOn` and `obeyMuteSwitch` are global options set via `setInnerAudioOption`, NOT properties on the `InnerAudioContext` instance

---

## Supabase Client

- The client is already configured at `src/client/supabase.ts` (with weapp-compatible `customFetch`) — **do not modify**
- Import directly: `import { supabase } from "@/client/supabase"`

## Directory Conventions

- Place types and query wrappers under `src/db/`
- Encapsulate all queries in `@/db/api.ts`
- Types must strictly match the SQL schema — do not add extra fields
- Create a corresponding TypeScript interface in `src/db/` for each table

## api.ts Coding Standards

- **Before writing api.ts, read the corresponding `supabase/migrations/*.sql`** to confirm NOT NULL constraints for every column — context compression may lose field details; migrations are the ground truth
- Use `.maybeSingle()` instead of `.single()`
- Always use `.order()` with `.limit()`
- When writing select queries, avoid `table_name(*)` — use `table_name!foreign_key_name` to explicitly specify relationships
- Implement pagination for multiple results — **strictly prohibit** fetching all data without pagination; **prefer cursor-based pagination**
- Return arrays safely: `Array.isArray(data) ? data : []`
- Empty strings need to be converted to NULL
- Prefer `.insert()` without `.select()`
- INSERT on user-owned tables must include `user_id`
- Protect nulls: `meeting.participants?.length`, `meeting.title || 'Untitled'`
- When unsure whether a field exists, query the schema first
- Use Supabase Realtime instead of polling for realtime data
- Due to performance constraints, **polling intervals exceeding 0.2s are forbidden**; prefer Realtime
- Use `supabase_apply_migration` to create/edit table structures; if it fails, fix the SQL and rerun

## Storage Upload Scaffold (`src/utils/upload.ts`)

The scaffold provides the following functions — use them directly:

- `selectMediaFiles(options)` — select images/videos via `Taro.chooseMedia`
- `selectMessageFile(options)` — select documents from WeChat chat or system file picker
- `uploadToSupabase(file, { bucket, userId })` — cross-platform upload, returns `{ success, data, error }`
- `getMimeType(ext)` — converts file extension to MIME type. **Always** use this for constructing MIME from extension — `jpg` and `jpeg` are the same format but only `image/jpeg` is valid; plain string concatenation will produce errors and Supabase Storage will reject the upload

### Key Rules

- **weapp**: Pass `tempFilePath` directly to `uploadToSupabase` — `supabase-wechat-js` converts it to `wx.uploadFile` internally. **Reading it as ArrayBuffer first will fail**
- `uploadToSupabase` returns `data.path` (a storage path like `userId/filename.jpg`), **not a URL**. To get a URL, call `supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl` (for display, database storage, or API calls)
- **Keep the full file object (including `name` and `type`) in state** (e.g., `useState<MiniProgramFileInput | File | null>`) — storing only `tempFilePath` will result in the MIME being incorrectly set to `application/octet-stream` during upload
- Use `upload.ts`'s `selectMediaFiles` for all media selection — it already correctly wraps `Taro.chooseMedia` for cross-platform handling
- Frontend validation: 1MB limit, snake_case filenames
- **NEVER** store images/videos as Base64 in database

## Edge Function Invocation

- Always use `supabase.functions.invoke`, except when a non-standard or custom Content-Type is required
- Read `error.context.text()` for the real error message
- For GET requests with parameters, append query parameters directly to the function name: `supabase.functions.invoke('test-fn?id=123', { method: 'GET' })`

```ts
const { data, error } = await supabase.functions.invoke('hello_world', {
  body: { key: 'value' },
  method: 'POST',
});

if (error) {
  const errorMsg = await error?.context?.text?.();
  console.error("edge function error in <hello_world>:", errorMsg || error?.message);
}
```

### QR Code Scan Page

The backend generates QR codes via Edge Function and writes the URL to Storage (see `supabase-server`). The frontend must pair with:

- Display: `const { data } = await supabase.functions.invoke('generate-qrcode', { body: { text } })` → `<Image src={data.url} />`
- **Scan page**: Use `Taro.scanCode` to read QR code content, query the table based on content, display according to app role schema permissions

## Realtime Subscription (low-frequency feature)

Use only when realtime capability is genuinely needed. Full spec (server-side publication switch, subscription template, weapp polling constraints) is in `supabase-server/references/realtime.md`.

## Auth

For login/signup/OAuth/SSO implementation, follow the `login` skill — **MUST** call `skill_action(skill="login")` to get the latest spec.
