# Supabase Frontend — Web (Vite + React)

## Environment Variables

- Prefix: `VITE_`
- Access: `import.meta.env.VITE_SUPABASE_URL` / `import.meta.env.VITE_SUPABASE_ANON_KEY`
- Written automatically into `.env` after `supabase_init`

## Type Definitions

- Define types in `@/types/types.ts` matching SQL schema
- When unsure whether a field exists, query the table structure first

## api.ts Coding Standards

- Use `.maybeSingle()` instead of `.single()`
- Always use `.order()` with `.limit()`
- When writing select queries, avoid `table_name(*)` — use `table_name!foreign_key_name` to explicitly specify relationships and prevent ambiguity
- Implement pagination for multiple results — **strictly prohibit** fetching all data without pagination
- **Prefer cursor-based pagination**
- Return arrays safely: `Array.isArray(data) ? data : []`
- Empty strings need to be converted to NULL to prevent SQL formatting misalignment
- Prefer `.insert()` without `.select()`
- Protect nulls: `meeting.participants?.length`, `meeting.title || 'Untitled'`
- Use Supabase Realtime for real-time data updates instead of polling

## Storage Upload (Frontend)

- Create for image/file uploads only
- **NEVER** store images/videos as Base64 in database
- Frontend validation: 1MB limit, snake_case filenames
- Web: upload directly using `File` / `Blob`:

```ts
const { data, error } = await supabase.storage
  .from(bucket)
  .upload(`${userId}/${snakeCaseName}.jpg`, file, { contentType: file.type });

const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
// Store urlData.publicUrl in database
```

## Edge Function Invocation

- Always use `supabase.functions.invoke`, except when a non-standard or custom Content-Type is required
- Read `error.context.text()` for the real error message
- For GET requests with parameters, append query parameters directly to the function name: `supabase.functions.invoke('test-fn?id=123', { method: 'GET' })`

```ts
// Type signature
supabase.functions.invoke<T = any>(
  functionName: string,
  options?: {
    body?: any
    headers?: Record<string, string>
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    signal?: AbortSignal
  }
): Promise<{
  data: T | null
  error: FunctionsHttpError | null // Read error.context.text() for real message
}>

const { data, error } = await supabase.functions.invoke('hello_world', {
  body: { key: 'value' },
  method: 'POST',
});

if (error) {
  const errorMsg = await error?.context?.text();
  console.error("edge function error in <hello_world>:", errorMsg || error?.message);
}
```

## Realtime Subscription (low-frequency feature)

Use only when realtime capability is genuinely needed. Full spec (server-side publication switch, subscription template, per-stack differences) is in `supabase-server/references/realtime.md`.

## Auth

For login/signup/OAuth/SSO implementation, follow the `login` skill — **MUST** call `skill_action(skill="login")` to get the latest spec.
