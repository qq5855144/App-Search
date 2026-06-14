# Supabase Frontend — Expo / React Native (App)

## Supabase Client (CRITICAL)

- **NEVER create a new Supabase client file** — the boilerplate already provides one at `src/client/supabase.ts` with correct Expo-native configuration
- ALWAYS import from `@/client/supabase`: `import { supabase } from "@/client/supabase"`
- The pre-built client uses `expo-sqlite/localStorage/install` for session persistence (works on iOS, Android, and Web)
- Reference implementation (do NOT copy — it already exists):

```tsx
import { createClient } from '@supabase/supabase-js'
import 'expo-sqlite/localStorage/install';

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

**STRICTLY FORBIDDEN**: AsyncStorage for business data; Web storage APIs (`localStorage` / `sessionStorage`).

## Environment Variables

- Prefix: `EXPO_PUBLIC_` (NOT `VITE_`)
- Access: `process.env.EXPO_PUBLIC_SUPABASE_URL` (NOT `import.meta.env`)
- NEVER put secrets in `EXPO_PUBLIC_` variables — they are visible in the built app

## Key Differences from Web Supabase

| Aspect | Web | Expo / RN |
|--------|-----|-----------|
| Env prefix | `VITE_` | `EXPO_PUBLIC_` |
| Env access | `import.meta.env.VITE_XXX` | `process.env.EXPO_PUBLIC_XXX` |
| Auth storage | `localStorage` (browser) | `localStorage` via `expo-sqlite/localStorage/install` |
| Session detect URL | `true` | `false` |
| File upload | `File` / `Blob` | `ArrayBuffer` (fetch + arrayBuffer()) |
| Realtime | Supported | Phase-1 NOT supported |

## Type Definitions

- Define types in `types/types.ts` matching SQL schema

## api.ts Coding Standards

- Encapsulate queries in `db/api.ts`
- Use `.maybeSingle()` instead of `.single()`
- Always use `.order()` with `.limit()`; implement pagination for multiple results
- When writing select queries, avoid `table_name(*)` — use `table_name!foreign_key_name` to explicitly specify relationships
- Return arrays safely: `Array.isArray(data) ? data : []`
- Empty strings need to be converted to NULL to prevent SQL formatting misalignment
- Prefer `.insert()` without `.select()`
- **Strictly prohibit** fetching all data without pagination; prefer cursor-based pagination
- Protect nulls: `meeting.participants?.length`, `meeting.title || 'Untitled'`
- NEVER store images/videos as Base64 in database — use Supabase Storage

## File Upload (CRITICAL — `expo/fetch + ArrayBuffer`, works on iOS / Android / Web)

```tsx
import { fetch } from "expo/fetch";

const uploadFile = async (uri: string, bucket: string, path: string, mimeType = "image/jpeg") => {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: mimeType });
  return { data, error };
};
```

- Do **not** use `FileReader`, `blob`, or `base64` for uploads
- Frontend validation: 1MB limit, snake_case filenames
- Compress before uploading using `expo-image-manipulator`

## Edge Function Invocation

- Always use `supabase.functions.invoke`
- Read `error.context.text()` for the real error message
- For GET requests with parameters, append query parameters directly to the function name: `supabase.functions.invoke('test-fn?id=123', { method: 'GET' })`

```tsx
const { data, error } = await supabase.functions.invoke('my-function', {
  body: { key: 'value' },
  method: 'POST',
});

if (error) {
  const errorMsg = await error?.context?.text();
  console.error("Edge function error:", errorMsg || error?.message);
}
```

**STRICTLY FORBIDDEN**: Direct third-party API calls from client-side code — all must go through Edge Functions.

## Realtime (low-frequency feature — RN not supported)

Phase-1 does NOT support Supabase Realtime in React Native. Use pull-to-refresh or periodic polling with a configurable interval instead. Full spec in `supabase-server/references/realtime.md`.

## Auth

For login/signup/OAuth/SSO implementation, follow the `login` skill — **MUST** call `skill_action(skill="login")` to get the latest spec.
