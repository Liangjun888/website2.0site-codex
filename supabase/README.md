# Supabase setup for the client portal

This repository contains the frontend for the Gold Summit Capital client document portal. Supabase provides login, database records, private PDF storage, and access control.

## 1. Create the Supabase project

1. Create a Supabase project.
2. In Authentication, enable email login.
3. Keep public sign-up disabled if you want all users to be invited manually.
4. In the SQL editor, run `supabase/schema.sql`.

## 2. Configure the website

Copy the values from Supabase Project Settings:

- Project URL
- anon public key

Then edit `scripts/portal-config.js`:

```js
window.GSC_PORTAL_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  storageBucket: "client-documents",
};
```

The anon key is designed for browser use. Access is still controlled by Row Level Security policies in `supabase/schema.sql`.

## 3. Create users

1. Create a user in Supabase Auth for the administrator.
2. Copy the user id.
3. Insert the matching profile row:

```sql
insert into public.profiles (id, email, display_name, role)
values ('USER_ID_FROM_AUTH', 'admin@example.com', 'Gold Summit Admin', 'admin')
on conflict (id) do update set role = 'admin', email = excluded.email;
```

For a client user:

```sql
insert into public.profiles (id, email, display_name, role)
values ('USER_ID_FROM_AUTH', 'client@example.com', 'Client Name', 'client')
on conflict (id) do update set role = 'client', email = excluded.email;
```

## 4. Upload monthly reports

Open:

```text
/zh-CN/client-portal/admin/
```

Use an admin email to sign in. Create one monthly report and upload all three PDFs:

- Simplified Chinese: `zh-CN`
- Traditional Chinese: `zh-HK`
- English: `en`

Publishing is blocked until all three language files exist.

## 5. Client access

Clients open:

```text
/zh-CN/client-portal/
```

After magic-link login, they can view published monthly reports and download each language version through controlled private storage links.
