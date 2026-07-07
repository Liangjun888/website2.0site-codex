-- Gold Summit Capital client document portal V1
-- Run this file in the Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  report_month date not null unique,
  title text not null,
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.monthly_reports(id) on delete cascade,
  language_code text not null check (language_code in ('zh-CN', 'zh-HK', 'en')),
  storage_path text not null unique,
  file_name text not null,
  file_size bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, language_code)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'notice' check (category in ('notice', 'market-commentary', 'education', 'event-record')),
  title text not null,
  summary text not null,
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_file_id uuid references public.monthly_report_files(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists monthly_reports_month_idx on public.monthly_reports(report_month desc);
create index if not exists monthly_reports_status_idx on public.monthly_reports(status);
create index if not exists monthly_report_files_report_idx on public.monthly_report_files(report_id);
create index if not exists download_events_user_idx on public.download_events(user_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/pdf'];

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.monthly_report_has_all_languages(target_report_id uuid)
returns boolean
language sql
stable
as $$
  select count(distinct language_code) = 3
  from public.monthly_report_files
  where monthly_report_files.report_id = target_report_id
    and language_code in ('zh-CN', 'zh-HK', 'en')
$$;

create or replace function public.prevent_incomplete_monthly_report_publish()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and not public.monthly_report_has_all_languages(new.id) then
    raise exception 'Monthly reports require zh-CN, zh-HK, and en files before publishing.';
  end if;
  return new;
end;
$$;

drop trigger if exists monthly_reports_publish_guard on public.monthly_reports;
create trigger monthly_reports_publish_guard
before update of status on public.monthly_reports
for each row
when (new.status = 'published')
execute function public.prevent_incomplete_monthly_report_publish();

alter table public.profiles enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.monthly_report_files enable row level security;
alter table public.documents enable row level security;
alter table public.download_events enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write"
on public.profiles for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "monthly_reports_select_published_or_admin" on public.monthly_reports;
create policy "monthly_reports_select_published_or_admin"
on public.monthly_reports for select
to authenticated
using (status = 'published' or public.current_user_role() = 'admin');

drop policy if exists "monthly_reports_admin_write" on public.monthly_reports;
create policy "monthly_reports_admin_write"
on public.monthly_reports for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "monthly_report_files_select_published_or_admin" on public.monthly_report_files;
create policy "monthly_report_files_select_published_or_admin"
on public.monthly_report_files for select
to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.monthly_reports
    where monthly_reports.id = monthly_report_files.report_id
      and monthly_reports.status = 'published'
  )
);

drop policy if exists "monthly_report_files_admin_write" on public.monthly_report_files;
create policy "monthly_report_files_admin_write"
on public.monthly_report_files for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "documents_select_published_or_admin" on public.documents;
create policy "documents_select_published_or_admin"
on public.documents for select
to authenticated
using (status = 'published' or public.current_user_role() = 'admin');

drop policy if exists "documents_admin_write" on public.documents;
create policy "documents_admin_write"
on public.documents for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "download_events_insert_own" on public.download_events;
create policy "download_events_insert_own"
on public.download_events for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "download_events_select_own_or_admin" on public.download_events;
create policy "download_events_select_own_or_admin"
on public.download_events for select
to authenticated
using (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "storage_select_published_client_documents_or_admin" on storage.objects;
create policy "storage_select_published_client_documents_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'client-documents'
  and (
    public.current_user_role() = 'admin'
    or name in (
      select monthly_report_files.storage_path
      from public.monthly_report_files
      join public.monthly_reports on monthly_reports.id = monthly_report_files.report_id
      where monthly_reports.status = 'published'
    )
    or name in (
      select documents.storage_path
      from public.documents
      where documents.status = 'published' and documents.storage_path is not null
    )
  )
);

drop policy if exists "storage_admin_insert_client_documents" on storage.objects;
create policy "storage_admin_insert_client_documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'client-documents' and public.current_user_role() = 'admin');

drop policy if exists "storage_admin_update_client_documents" on storage.objects;
create policy "storage_admin_update_client_documents"
on storage.objects for update
to authenticated
using (bucket_id = 'client-documents' and public.current_user_role() = 'admin')
with check (bucket_id = 'client-documents' and public.current_user_role() = 'admin');

drop policy if exists "storage_admin_delete_client_documents" on storage.objects;
create policy "storage_admin_delete_client_documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'client-documents' and public.current_user_role() = 'admin');
