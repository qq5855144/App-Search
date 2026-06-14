<NATIVE_AUTH_REQUIREMENTS>

**Principles**:
- Use Supabase Auth for all login/registration
- Ensure a closed loop: login and logout work; data permissions don't conflict with features
- Required items: must be complete and verified; higher priority than user requests
- Recommended items: also to be done, but lower priority than user requests
- Protect data security while maximizing access for guests and regular users
- All admin backend features must have all pages created with no TODOs left

**Supported Login Methods (Phase 1)**:
- Username + Password (default, required)
- Phone + OTP Verification Code (when user requests phone login)
- Google SSO: **NOT supported in Phase 1** (requires `expo-auth-session` setup, planned for Phase 2)

<AUTH_REQUIRED_ITEMS>
**Required**:
1. Design a login screen using React Native components (`TextInput`, `Pressable`, `Text`, `View`)
   - Include registration
   - Add checkboxes for the User Agreement and Privacy Policy
     - Sample User Agreement & Privacy Policy (brief one sentence)
     - Inform the user in the finish summary: <user-reminder>Please modify the User Agreement & Privacy Policy yourself to mitigate legal risks.</user-reminder>
2. Auto-sync new users to profiles on INSERT.
   - Set `search_path = public` to resolve types correctly.
   - The following template has been validated as a best practice and is compatible with any business requirements. Only the custom registration fields to be synchronized in `handle_new_user` may be modified. No other changes are allowed, and no additional trigger logic may be added to the auth table.
   Template:
   ```sql
   CREATE TYPE public.user_role AS ENUM ('user', 'admin');

   CREATE FUNCTION handle_new_user()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY DEFINER SET search_path = public
   AS $$
   BEGIN
   INSERT INTO public.profiles (id, email, phone, role)
   VALUES (
     NEW.id,
     NEW.email,
     NEW.phone,
     'user'::public.user_role
   );
   RETURN NEW;
   END;
   $$;

   -- Do not add any additional triggers to the auth table.
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW
     EXECUTE FUNCTION handle_new_user();
   ```
3. Implement route guard in root `app/_layout.tsx` using `Stack.Protected` (SDK 53+):
   - Use `Stack.Protected guard={!!session}` to protect business routes, `guard={!session}` for auth pages
   - Get session state from `supabase.auth.onAuthStateChange()` listener in a context provider
   - NEVER scatter auth redirect logic (`useEffect + router.replace`) across individual pages — converge all access control into the root layout
   - Public auth pages (`sign-in`, `sign-up`) live at root level; all post-login pages go under a protected `(app)/` group
4. When the app uses authentication, MUST provide a clearly accessible account management entry point from the main navigation (e.g. a "Profile"/"Me"/"Settings" tab in tab-based apps, or a user avatar/gear icon in the header for stack-based apps). This entry point MUST include at minimum: current user info display and a logout button. It MUST be reachable from any primary screen — placing logout only on transitional pages (like role-select or onboarding) does NOT satisfy this requirement.
5. After successful login, use `router.replace('/')` (NOT `router.push`) so the auth screen is removed from back-stack
6. If roles/admin needed:
   - Admin creation strategy depends on the login method:

   **A. Username + Password login (default)**:
   - AI must create one example admin account with a randomly generated, strong password (16+ chars, mixed case + digits + symbols). Never use simple passwords unless the user explicitly specifies one. Output the credentials in the finish summary.
   - **TIMING: Execute the three steps below immediately after the auth migration runs — do NOT defer to the end of the task. Context compression may cause this step to be skipped if left until later.**
   - Account creation flow (three-step, fully automated via script):
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
     UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE email = '<username>@miaoda.com';
     ```
     Step 3: Use the `supabase_execute_sql` tool to promote the user to admin (query by email, since username+password uses `username@miaoda.com` as email):
     ```sql
     UPDATE public.profiles SET role = 'admin' WHERE email = '<username>@miaoda.com';
     ```
   - The script must be executed automatically as part of the setup; log the resulting credentials (username + password) to the console.

   **B. Phone + OTP login**:
   - Do NOT auto-create admin accounts and do NOT generate any admin setup scripts — admin login requires a real phone number to receive OTP, which cannot be predetermined by the AI.
   - Do NOT add a secondary username+password login entry to the login screen — keep the login UI as phone+OTP only.
   - In the finish summary, instruct the user to register normally first, then promote to admin via Supabase Dashboard (see AUTH_FINISH_SUMMARY).

   **Common rules for both methods**:
   - After login, check the user's role from profiles and conditionally show admin navigation entries (e.g. an "管理" tab or header icon). Do NOT create a separate admin login route — admin uses the same login screen as regular users, and the app routes by role after authentication.
   - Admin page: manage user roles (edit others)
   - Profiles permissions:
     1. Create helper `get_user_role` (SECURITY DEFINER) to prevent infinite recursion detected in policy for relation "profiles"
     2. Admins have full access
     3. Users can view own data
     4. Users can edit own data except `role`
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

**Recommended**:
1. If no method specified, use username + password
2. Login must check `supabase_verification`; show phone verification UI if enabled
3. If no verification is needed, auto-login after signup and navigate back
</AUTH_REQUIRED_ITEMS>

<AUTH_METHODS>
**Username + Password** (default method):
- Simulate email/password with `@miaoda.com` suffix: `username@miaoda.com`
- Use `supabase_verification` tool to disable email verification
- Only letters, digits, and `_` are allowed in usernames
- Signup: `supabase.auth.signUp({ email: username + "@miaoda.com", password })`
- Login: `supabase.auth.signInWithPassword({ email: username + "@miaoda.com", password })`

**Phone + OTP**:
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
- Phone input: include country code selector (default +86)
- OTP input: 6-digit code field with auto-focus between digits
- Add countdown timer for resend button (typically 60 seconds)
- **Engineering dependency**: Phone OTP requires SMS provider (Twilio) configured on Supabase instance
- **CRITICAL — `sms-verification` plugin conflict**: The project scaffold may include a `sms-verification` plugin or component (e.g. `SmsVerification`, `useSmsCode`, `sendSmsCode`). This plugin manages its own SMS state and will conflict with Supabase OTP flow — both systems attempt to control the same verification lifecycle, causing double-sends, state desync, or silent failures.
  - **NEVER** wire the `sms-verification` plugin into the phone login flow.
  - If such a component exists in the codebase, do NOT import or call it from the login/register page. Build the OTP UI directly using only `supabase.auth.signInWithOtp()` and `supabase.auth.verifyOtp()`.

**Phone + Password (verification ON)**:
- Use `signUp({ phone, password })` to send OTP (password required)
- Use `verifyOtp()` to complete registration
</AUTH_METHODS>

<AUTH_TOKEN_STORAGE>
**Token Storage**:
- Supabase client already configured with `expo-sqlite/localStorage/install` for session persistence (see `tech_native_supabase.j2`)
- For sensitive tokens beyond Supabase session, use `expo-secure-store`
</AUTH_TOKEN_STORAGE>

<AUTH_UI_RULES>
**Login UI Requirements**:
- MUST use React Native components (`TextInput`, `Pressable`, `Text`, `View`) — NEVER HTML elements
- MUST include User Agreement + Privacy Policy checkbox (same as other app types)
- Show loading state (`ActivityIndicator`) during auth operations
- Show meaningful error messages on auth failure (wrong password, user not found, etc.)
- Password field: use `secureTextEntry` prop with show/hide toggle

**FORBIDDEN in Mobile App Auth**:
- NEVER use `window.location`, `window.open`, or any browser API
- NEVER manually use browser `localStorage` or `AsyncStorage` for auth state — the Supabase client handles session persistence automatically via `expo-sqlite/localStorage/install`
- NEVER implement Google SSO in Phase 1
- NEVER use web-style form submission (`<form>`, `onSubmit`)
- NEVER use `@/components/common/RouteGuard.tsx` or `@/context/AuthContext.tsx` (these are Web boilerplate files)
</AUTH_UI_RULES>

<AUTH_CONSTRAINTS>
**Auth Constraints**:
1. Never run concurrent auth operations; `supabase-js` internally uses global lock for serialization
2. Add timeouts to all auth operations to prevent infinite blocking
3. Check auth state first; defer other operations until confirmed
4. Keep RLS policies fast; avoid complex queries that may hang
5. Combine `auth.users` + `profiles` for complete user information; use `userId` for profile queries
6. Prioritize `getSession()` for login status and provide global login state control
7. Logout MUST be accessible from the main app interface (see Required item 4 above) — NOT hidden in transitional or one-time pages
8. Login screen must be accessible even when not logged in (whitelist the auth route group)
</AUTH_CONSTRAINTS>

<AUTH_TECH_LIMITS>
**Tech Limits**:
1. Unregistered users can't set roles; must register first via signUp. For username+password apps, the AI setup script uses the `supabase_execute_sql` tool to set admin role automatically. For phone+OTP apps, the user promotes accounts to admin via Supabase Dashboard after registration.
2. Single account system; multi-device handled by roles
3. Password changes/add accounts via Edge Functions (do not use trigger for auth→profiles)
4. Do not insert into profiles directly; only trigger sync adds rows
5. Only `profiles.id` may reference `auth.users(id)`; other tables must reference `profiles(id)`
6. Use the `supabase_verification` tool to set up verification
7. Only username in email field; no phone in email field
8. Do not allow login with both email and username — use username with `@miaoda.com` simulation
9. AI-registered or AI-created accounts must use randomly generated, strong passwords (16+ chars, mixed uppercase + lowercase + digits + symbols). Never use simple or guessable passwords unless the user explicitly specifies the password.
</AUTH_TECH_LIMITS>

<AUTH_FINISH_SUMMARY>
**Finish Summary Requirements (MANDATORY)**:
In the final reply to the user, you MUST include a summary section covering all applicable items:
1. List all login methods implemented (e.g., username-password, phone OTP).
2. Admin roles — depends on login method:
   - **Username + Password**: output the admin account credentials (username + password) created by the setup script.
   - **Phone + OTP**: instruct the user to promote an account to admin via Supabase Dashboard by changing profiles.role to 'admin'.
3. User Agreement & Privacy Policy: remind the user — "Please modify the User Agreement & Privacy Policy yourself to mitigate legal risks."
4. Verification status:
   - Phone OTP: inform the user that real SMS requires configuring an SMS provider (e.g. Twilio) in Supabase Dashboard → Authentication → Providers → Phone.
   - Username+Password: if verification was disabled via `supabase_verification`, inform the user that verification is currently disabled and explain how to re-enable it.
5. Any other manual steps the user must perform (Supabase Dashboard changes, environment variable settings, etc.).
</AUTH_FINISH_SUMMARY>

</NATIVE_AUTH_REQUIREMENTS>
