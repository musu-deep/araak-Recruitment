-- Araak Recruitment production schema
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.employment_applications (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  submission_token text,
  status text not null default 'new',
  source text not null default 'web',
  applicant_name text,
  email text,
  mobile text,
  nationality text,
  desired_position text,
  odoo_applicant_id bigint,
  integration_status text not null default 'pending',
  integration_error text,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employment_attachments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.employment_applications(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.employment_applications(id) on delete cascade,
  preferred_date date,
  preferred_time time,
  timezone text,
  meeting_type text default 'remote',
  notes text,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

alter table public.employment_applications enable row level security;
alter table public.employment_attachments enable row level security;
alter table public.meeting_requests enable row level security;

revoke all on public.employment_applications from anon, authenticated;
revoke all on public.employment_attachments from anon, authenticated;
revoke all on public.meeting_requests from anon, authenticated;

grant insert on public.employment_applications to anon, authenticated;
grant insert on public.employment_attachments to anon, authenticated;
grant insert on public.meeting_requests to anon, authenticated;

-- Anonymous applicants can submit, but cannot read or modify other applications.
drop policy if exists "public application insert" on public.employment_applications;
create policy "public application insert"
on public.employment_applications
for insert
to anon, authenticated
with check (
  id is not null
  and coalesce(length(submission_token), 0) >= 20
);

drop policy if exists "public attachment metadata insert" on public.employment_attachments;
create policy "public attachment metadata insert"
on public.employment_attachments
for insert
to anon, authenticated
with check (application_id is not null);

drop policy if exists "public meeting request insert" on public.meeting_requests;
create policy "public meeting request insert"
on public.meeting_requests
for insert
to anon, authenticated
with check (application_id is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employment-attachments',
  'employment-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public recruitment upload" on storage.objects;
create policy "public recruitment upload"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'employment-attachments');

create index if not exists employment_applications_created_at_idx
  on public.employment_applications(created_at desc);
create index if not exists employment_attachments_application_id_idx
  on public.employment_attachments(application_id);
create index if not exists meeting_requests_application_id_idx
  on public.meeting_requests(application_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employment_applications_set_updated_at on public.employment_applications;
create trigger employment_applications_set_updated_at
before update on public.employment_applications
for each row execute function public.set_updated_at();
