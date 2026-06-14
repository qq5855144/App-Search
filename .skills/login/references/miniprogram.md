<AUTHORIZATION_AND_AUTHENTICATION>
Principles:
Use Supabase Auth for all login/registration.
Ensure a closed loop: login and logout work; data permissions don't conflict with features.
Required items: must be complete and verified; higher priority than user requests.
Recommended items: also to be done, but lower priority than user requests.
Protect data security while maximizing access for guests and regular users.
Login method selection:
    **IMPORTANT**: Only implement WeChat login according to <auth notes> when the user explicitly requests it.
    User specifies non-WeChat login (e.g., phone-otp, email-password), only add the specified method.
    No method specified → add WeChat login + username-password method
    For non-WeChat login methods (username-password, phone-otp, email-password), the login page MUST include both login AND registration entry — users cannot log in if they have no way to create an account first.
Required:
1. Design a login page WITH EXPLICIT ACCESS ENTRY:
   - MUST have visible login and logout entry
   - Login page must be publicly accessible — whitelist it in RouteGuard's PUBLIC_PAGE_PATHS
   - You must include checkboxes for the User Agreement and Privacy Policy.
       - Example: `<div className="flex items-center gap-2" onClick={() => setAgreed(!agreed)}>
           <div className={agreed ? 'w-5 h-5 bg-primary border-primary' : 'w-5 h-5 border-border'}>
             {agreed && <div className="i-mdi-check text-white" />}
           </div>
           <div className="flex flex-wrap text-base text-muted-foreground">
             <span>我已阅读并同意</span><span className="text-primary">《用户协议》</span><span>和</span><span className="text-primary">《隐私政策》</span>
           </div>
         </div>`
2. Auto-sync new users to profiles on INSERT.
   - Set search_path = public to resolve types correctly.
Example:
```sql
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

CREATE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
-- Insert a profile synced with fields collected at signup.
INSERT INTO public.profiles (id, email, phone, role, openid)
VALUES (
  NEW.id,
  NEW.email,
  NEW.phone,
  'user'::public.user_role,
  (NEW.raw_user_meta_data->>'openid')::text
);
RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```
3. AuthContext / RouteGuard:
    - Always add AuthProvider in `src/app.tsx` so all pages can access login state (e.g. navbar login/logout).
    - When RouteGuard IS needed: review `src/contexts/AuthContext.tsx` and `src/components/RouteGuard.tsx`, do not create new files.
    - Check PUBLIC_PAGE_PATHS In `RouteGuard.tsx`
    - Check login methods in `AuthContext.tsx`
    - After creating profile types in `src/db/`, update ONLY the `Profile` interface in `AuthContext.tsx` — replace the `{ [key: string]: unknown }` placeholder with `import type {Profile} from '@/db/types'`. Do NOT remove or rewrite any existing login methods (signInWithUsername, signUpWithUsername, etc.) — the scaffold pre-defines multiple auth methods that users may enable later; deleting them forces unnecessary rework.
    - Use `withRouteGuard(PageComponent)` on individual pages only — RouteGuard relies on page-level lifecycle hooks unavailable at the app root.
    - Pages using `withRouteGuard` that load data in `useDidShow` MUST also add `useEffect(() => { loadFn() }, [loadFn])` as a fallback.
        - On mobile phones, auth init is slow — `useDidShow` fires before the component mounts and never triggers again.
    - Before redirecting to login, store current page path: `Taro.setStorageSync('loginRedirectPath', currentPath)`
      - Note: `Taro.getCurrentInstance()?.router?.path` returns paths with a leading slash like `/pages/profile/index`.
      - Normalize before comparing with tabBar page list: `redirectPath.startsWith('/') ? redirectPath : \`/${redirectPath}\``
    - After successful login, read stored path and redirect:
        - Use `Taro.switchTab` if stored path is in tabBar page list
        - Use `Taro.redirectTo` if stored path is NOT in tabBar page list (redirectTo removes the login page from the nav stack; navigateTo would let the user press back into it)
        - Clear stored path: `Taro.removeStorageSync('loginRedirectPath')`
    - WeChat login button should display in both Mini Program and H5
4. If roles/admin needed:
   - Create one example admin account with a randomly generated strong password (per Tech limits 10). Output the credentials (username + password) in the finish summary so the user can sign in immediately.
   - **TIMING: Execute the three steps below immediately after the auth migration runs — do NOT defer to the end of the task. Context compression may cause this step to be skipped if left until later.**
   - Account creation flow (three-step, fully automated via a script):
     1. Register using the anon key: call `supabase.auth.signUp({ email, password })` with the normal client (anon key). This triggers `handle_new_user` to insert the profiles row with `role='user'`.
     2. If email verification is enabled, use the `supabase_execute_sql` tool to bypass it. Skip this step if verification is already disabled.
     3. Use the `supabase_execute_sql` tool to promote the user to admin in the profiles table. Do NOT ask the user to change the role manually.
     Example script pattern:
     ```javascript
     // Step 1: Register with anon key
     const { data: authData } = await supabase.auth.signUp({ email: `${username}@miaoda.com`, password });
     ```
     Step 2: If verification is enabled, use the `supabase_execute_sql` tool to bypass it:
     ```sql
     -- username+password: confirm by email
     UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE email = '<username>@miaoda.com';

     -- phone+OTP: confirm by phone
     UPDATE auth.users SET phone_confirmed_at = NOW(), confirmed_at = NOW() WHERE phone = '<phone>';
     ```
     Step 3: Use the `supabase_execute_sql` tool to promote the user to admin (query by the identifier used at signup — email for username+password, phone for phone+OTP):
     ```sql
     -- username+password: query by email (username@miaoda.com)
     UPDATE public.profiles SET role = 'admin' WHERE email = '<username>@miaoda.com';

     -- phone+OTP: query by phone
     UPDATE public.profiles SET role = 'admin' WHERE phone = '<phone>';
     ```
   - The script must be executed automatically as part of the setup; log the resulting credentials (username + password) to the console.
   - Admin page: manage user roles (edit others).
   - profiles permissions:
     1. Create helper `get_user_role` (SECURITY DEFINER) to prevent infinite recursion detected in policy for relation "profiles"
     2. Admins have full access
     3. Users can view own data
     4. Users can edit their own data except `role`
     5. Use `public_profiles` view for shareable info
     Here is an example:
```sql
CREATE OR REPLACE FUNCTION get_user_role(uid uuid)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = uid;
$$;

-- Profiles policies
CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM get_user_role(auth.uid()));

CREATE VIEW public_profiles AS
  SELECT id, role FROM profiles;
```
5. If no verification is needed, use the `supabase_verification` tool to disable phone and email verification.
6. Anonymous login (if needed):
   - On first visit, generate a UUID v4 as the anonymous credential ID and persist it via `Taro.setStorageSync('anon_credential_id', uuid)`. This is NOT the Supabase auth.uid — it is an app-level identifier.
   - Create a table `anon_credential_map (credential_id uuid PRIMARY KEY, auth_uid uuid REFERENCES profiles(id))` to store the mapping. Enable RLS with no policies — service-role bypasses RLS; authenticated clients cannot access this table.
   - Create a Supabase Edge Function `anon-auth` that:
     1. Accepts `{ credential_id: string }` in the request body.
     2. Queries `anon_credential_map` for the given credential_id.
     3. If found: fetches the user's email via `supabaseAdmin.auth.admin.getUserById(auth_uid)`, then calls `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })`.
     4. If not found: first calls `supabaseAdmin.auth.admin.createUser({ email: \`anon_${credential_id}@miaoda.com\`, password: crypto.randomUUID(), email_confirm: true })` to register the user, inserts the credential_id → auth.uid row into `anon_credential_map`, then calls `generateLink`.
     5. Returns `{ hashed_token }` (from `data.properties.hashed_token`) to the client.
   - On the client, call `supabase.auth.verifyOtp({ token_hash: hashed_token, type: 'magiclink' })` to activate the session.
   - The Edge Function must use the service-role key (server-side only, never exposed to the client).
   - Note: the `on_auth_user_created` trigger will fire for anonymous users too; ensure the `phone` column in profiles allows null.

Recommended:
1. Login must check `supabase_verification`; show phone/email verification UI if enabled.

Required (Logout):
1. MUST implement logout functionality — a login system without logout is incomplete:
   - Place the logout button where the user can always find it (e.g., profile page, settings section, or a tabBar "profile" page). If no such page exists, create a minimal one.
   - Use signOut method from `AuthContext.tsx`
   - After signOut, redirect to login page via `Taro.reLaunch`

Tech limits:
1. Unregistered users can't set roles; register first via signUp, then use the `supabase_execute_sql` tool to update role.
2. Single account system; multi-device handled by roles.
3. Password changes/add accounts: use Edge Functions — do not add additional triggers for these operations (the only trigger should be `on_auth_user_created`).
4. Do not insert into profiles directly; only trigger sync adds rows.
5. Only profiles.id may reference auth.users(id); other tables must reference profiles(id).
6. use the `supabase_verification` tool to set up verification
7. Only username in email field; no phone.
8. Do not allow login with both email and username. Use username. Store email in the profile table.
9. Taro H5/WeChat compatibility: WeChat login requires username-password fallback; non-WeChat methods don't need WeChat login.
10. AI-registered or AI-created accounts must use randomly generated, strong passwords (16+ chars, mixed uppercase + lowercase + digits + symbols). Never use simple or guessable passwords unless the user explicitly specifies the password.

Auth constraints:
1. Never run concurrent auth operations; supabase-js internally uses global lock for serialization.
2. Add timeouts to all auth operations to prevent infinite blocking.
3. Check auth state first; defer other operations until confirmed.
4. Keep RLS policies fast; avoid complex queries that may hang.
5. Combine auth.users + profiles for complete user information, use userId for profile queries.
6. Prioritize getSession() for login status and provide global login state control.

Finish Summary Requirements (MANDATORY):
The finish tool result MUST include these items (keep brief, one line each):
1. Admin credentials: output the username + password created in Required 4.
2. Role management: to change user roles, open 后端服务 → 数据表管理 → profiles → edit the `role` field.

Auth notes:
1. Username + password:
  - simulate email/password with @miaoda.com
  - use `supabase_verification` tool to disable email verification
  - Only letters, digits, and _ are allowed in usernames.
2. Phone OTP:
   - Use `signInWithOtp()` to send OTP, `verifyOtp()` to login. No other SMS APIs.
```tsx
// Step 1: Send OTP
const { error } = await supabase.auth.signInWithOtp({
  phone: "+86" + phoneNumber,
});

// Step 2: Verify OTP
const { data, error } = await supabase.auth.verifyOtp({
  phone: "+86" + phoneNumber,
  token: otpCode,
  type: "sms",
});
```
   - **CRITICAL — `sms-verification` plugin conflict**: The project scaffold may include a `sms-verification` plugin or component (e.g. `SmsVerification`, `useSmsCode`, `sendSmsCode`). This plugin manages its own SMS state and will conflict with Supabase OTP flow — both systems attempt to control the same verification lifecycle, causing double-sends, state desync, or silent failures.
     - **NEVER** wire the `sms-verification` plugin into the phone login flow.
     - If such a component exists in the codebase, do NOT import or call it from the login/register page. Build the OTP UI directly using only `supabase.auth.signInWithOtp()` and `supabase.auth.verifyOtp()`.
3. Phone + password (verification ON): Use signUp(phone) to send OTP (Password required), verifyOtp() to register.
4. Email + password (verification ON): pass emailRedirectTo to signup (default window.location.origin).
5. Wechat login:
  - Must add username-password login as a second login method.
  - Use signInWithWechat in `src/contexts/AuthContext.tsx` to implement WeChat login.
  - Create an edge function named `wechat_miniapp_login` to support WeChat Mini Program login:
```
import { createClient } from 'jsr:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { code } = await req.json().catch(() => ({}))
    if (!code) {
      return new Response(JSON.stringify({ message: "缺少code" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const APP_ID = Deno.env.get("WECHAT_MINIPROGRAM_LOGIN_APP_ID")
    const APP_SECRET = Deno.env.get("WECHAT_MINIPROGRAM_LOGIN_APP_SECRET")

    const wxRes = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`
    )
    const wxData = await wxRes.json()

    if (wxData.errcode) {
      return new Response(JSON.stringify({ message: `微信接口错误: ${wxData.errmsg}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const { openid } = wxData
    const email = `${openid}@wechat.login`

    // Ensure user exists before generating magic link; ignore "already been registered" error
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { from: "wechat", openid },
    })
    if (createError && !createError.message.includes('already been registered')) {
      return new Response(JSON.stringify({ message: createError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const { data: magicLinkData, error: magicLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          data: { from: "wechat", openid },
        },
      })

    if (magicLinkError) {
      return new Response(JSON.stringify({ message: magicLinkError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const hashedToken = magicLinkData?.properties?.hashed_token ?? ""
    const verificationType = magicLinkData?.properties?.verification_type ?? "email"

    if (!hashedToken) {
      return new Response(JSON.stringify({ message: "无法生成token" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({
      token: hashedToken,
      verification_type: verificationType,
      openid,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
```
  - Modify handle_new_user() to also sync the username: add a `username` column to profiles, extract from `(NEW.raw_user_meta_data->>'username')::text`. Username-password signup must pass username in metadata via `signUp({ options: { data: { username } } })`. WeChat users will have username = NULL.
  - **CRITICAL**: username and openid must be stored in profiles.openid field. NEVER extract openid from email string — Supabase may normalize the email case.
  - **OPENID CONSTRAINT**: Do NOT add UNIQUE constraint on profiles.openid field. The same WeChat user may have multiple accounts.
</AUTHORIZATION_AND_AUTHENTICATION>
