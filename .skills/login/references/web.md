<LOGIN_REQUIREMENTS>
principles:
Use Supabase Auth for all login/registration.
Ensure a closed loop: login and logout work; data permissions don't conflict with features.
Required items: must be complete and verified; higher priority than user requests.
Recommended items: also to be done, but lower priority than user requests.
Protect data security while maximizing access for guests and regular users.

Required:
1. Design a login page.
    - Include registration
    - Add checkboxes for the User Agreement and Privacy Policy.
        - Sample User Agreement & Privacy Policy (Brief one sentence)
        - Inform the user in the finish summary. <user-reminder>Please modify the User Agreement & Privacy Policy yourself to mitigate legal risks.<user-reminder/>
2. Auto-sync new users to profiles on INSERT.
   - Set search_path = public to resolve types correctly.
   - The following template has been validated as a best practice and is compatible with any business requirements. Only the custom registration fields to be synchronized in handle_new_user may be modified. No other changes are allowed, and no additional trigger logic may be added to the auth table.
Template:
```sql
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

CREATE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
-- Insert a profile synced with fields collected at signup.
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
3. AuthContext / RouteGuard:
    - Always add AuthProvider in @/App.tsx so all pages can access login state (e.g. navbar login/logout).
    - RouteGuard is optional: only add it when authentication is required for most routes.
      - If the app pattern is "only admin needs login, other routes are public", do NOT add RouteGuard. Its default-block-all interception (whitelist-only) will break the app for regular users.
      - When RouteGuard IS needed: review @/contexts/AuthContext.tsx and @/components/common/RouteGuard.tsx, do not create new files. Check PUBLIC_ROUTES and add RouteGuard in @/App.tsx.
4. Show login status and login/logout in navbar(add header in app.tsx); if without a navbar, add a login/logout button, login status on the home page.
5. After a successful login, the user must be redirected to a non-login page.
6. If roles/admin needed:
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
     -- username+password: confirm by email
     UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE email = '<username>@miaoda.com';

     -- phone+OTP: confirm by phone
     UPDATE auth.users SET phone_confirmed_at = NOW(), confirmed_at = NOW() WHERE phone = '<phone>';
     ```
     Step 3: Use the `supabase_execute_sql` tool to promote the user to admin (query by the identifier used at signup — email for username+password, phone for phone+OTP, email for email+password):
     ```sql
     -- username+password: query by email (username@miaoda.com)
     UPDATE public.profiles SET role = 'admin' WHERE email = '<username>@miaoda.com';

     -- phone+OTP: query by phone
     UPDATE public.profiles SET role = 'admin' WHERE phone = '<phone>';

     -- email+password: query by email
     UPDATE public.profiles SET role = 'admin' WHERE email = '<email>';
     ```
   - The script must be executed automatically as part of the setup; log the resulting credentials (username + password) to the console.
   - Admin sees Admin entry in navbar.
   - Admin page: manage user roles (edit others).
   - profiles permissions:
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

7. Anonymous login (if needed):
   - On first visit, generate a UUID v4 as the anonymous credential ID and persist it in localStorage under the key `anon_credential_id`. This is NOT the Supabase auth.uid — it is an app-level identifier.
   - Create a table `anon_credential_map (credential_id uuid PRIMARY KEY, auth_uid uuid REFERENCES profiles(id))` to store the mapping. RLS: only the Edge Function's service-role key may read/write this table.
   - Create a Supabase Edge Function `anon-auth` that:
     1. Accepts `{ credential_id: string }` in the request body.
     2. Queries `anon_credential_map` for the given credential_id.
     3. If found: calls `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` to generate a token for the existing user.
     4. If not found: first calls `supabaseAdmin.auth.admin.createUser({ email: 'anon_<credential_id>@miaoda.com', password: <random strong password>, email_confirm: true })` to register the user, inserts the credential_id → auth.uid row into `anon_credential_map`, then calls `generateLink` to generate a token.
     5. Returns `{ hashed_token }` (from `data.properties.hashed_token`) to the client.
   - On the client, call `supabase.auth.verifyOtp({ token_hash: hashed_token, type: 'magiclink' })` to activate the session.
   - The Edge Function must use the service-role key (server-side only, never exposed to the client).
   - The credential_id must never be sent to any third party and must only be used for this Edge Function call.
   - Note: the `on_auth_user_created` trigger will fire for anonymous users too; ensure the profiles table allows null email and phone.


Recommended:
1. If no method specified, use username + password.
2. Login must check `supabase_verification`; show phone/email verification UI if enabled.
3. If no verification is needed, auto-login after signup and go back to the last page.


Tech limits:
1. Unregistered users can't set roles; register first via signUp, then use the `supabase_execute_sql` tool to update role.
2. Single account system; multi-device handled by roles.
3. Password changes/add accounts via Edge Functions (do not use trigger for auth→profiles).
4. Do not insert into profiles directly; only trigger sync adds rows.
5. Only profiles.id may reference auth.users(id); other tables must reference profiles(id).
6. use the `supabase_verification` tool to set up verification
7. Only username in email field; no phone.
8. Do not allow login with both email and username. Use username. Store email in the profiles table.
9. AI-registered or AI-created accounts must use randomly generated, strong passwords (16+ chars, mixed uppercase + lowercase + digits + symbols). Never use simple or guessable passwords unless the user explicitly specifies the password.

Finish Summary Requirements (MANDATORY):
In the final reply to the user, you MUST include a summary section covering all applicable items:
1. List all login methods implemented (e.g., username-password, Google SSO, phone OTP, email).
2. Admin roles (if created): output the example admin account credentials (username + password) logged by the setup script.
3. User Agreement & Privacy Policy: remind the user — "Please modify the User Agreement & Privacy Policy yourself to mitigate legal risks."
4. Verification status: if verification was disabled via `supabase_verification`, inform the user that verification is currently disabled and explain how to re-enable it if needed.
5. Anonymous login (if implemented): explain to the user how anonymous sessions work and that anonymous credentials are persisted in localStorage.
6. Any other manual steps the user must perform (Supabase Dashboard changes, environment variable settings, role updates, etc.).

Auth notes:
1. Username + password:
  - simulate email/password with @miaoda.com
  - use `supabase_verification` tool to disable email verification
  - Only letters, digits, and _ are allowed in usernames.
2. Google SSO:
```
const { data, error } = await client.auth.signInWithSSO({
  domain: 'miaoda-gg.com',
  options: { redirectTo: window.location.origin },
});
window.open(data.url, '_self');
```
Do not use OAuth.
3. Phone OTP:
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
4. Phone + password (verification ON): Use signUp(phone) to send OTP (Password required), verifyOtp() to register.
5. Email + password (verification ON): pass emailRedirectTo to signup (default window.location.origin).
</LOGIN_REQUIREMENTS>
