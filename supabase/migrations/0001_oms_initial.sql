-- Open Motion Studio objects only. Apply after exporting and reviewing the
-- existing kmerhosting catalog. No existing table, policy or bucket is altered.
create schema if not exists oms_private;

create table if not exists public.oms_projects (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  name text not null check (char_length(name) between 1 and 160),
  document jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  checksum text not null,
  media_manifest jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oms_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.oms_projects(id) on delete cascade,
  visitor_id text not null,
  revision bigint not null,
  document jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

create table if not exists public.oms_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.oms_projects(id) on delete cascade,
  visitor_id text not null,
  storage_path text not null unique,
  media_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum text not null,
  width integer,
  height integer,
  duration_seconds numeric,
  license text,
  created_at timestamptz not null default now()
);

create table if not exists public.oms_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.oms_projects(id) on delete cascade,
  visitor_id text not null,
  source_revision bigint not null,
  engine_version text not null,
  state text not null default 'queued' check (state in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress numeric not null default 0 check (progress between 0 and 1),
  attempts integer not null default 0,
  lease_until timestamptz,
  heartbeat_at timestamptz,
  result_manifest jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists oms_projects_visitor_updated_idx on public.oms_projects (visitor_id, updated_at desc);
create index if not exists oms_project_versions_project_revision_idx on public.oms_project_versions (project_id, revision desc);
create index if not exists oms_assets_project_visitor_idx on public.oms_assets (project_id, visitor_id);
create index if not exists oms_render_jobs_queue_idx on public.oms_render_jobs (state, created_at);

alter table public.oms_projects enable row level security;
alter table public.oms_project_versions enable row level security;
alter table public.oms_assets enable row level security;
alter table public.oms_render_jobs enable row level security;

-- The browser never receives service-role credentials. The API validates the
-- signed opaque visitor cookie and uses the server-only key for these tables.
-- Deliberately no anon/authenticated policies are created in P0.
revoke all on public.oms_projects from anon, authenticated;
revoke all on public.oms_project_versions from anon, authenticated;
revoke all on public.oms_assets from anon, authenticated;
revoke all on public.oms_render_jobs from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('oms_assets', 'oms_assets', false)
on conflict (id) do nothing;

-- Do not revoke or replace policies on storage.objects globally: that table is
-- shared by unrelated KmerHosting products. P0 accesses this private bucket
-- through the server-only key and will add bucket-scoped policies in a reviewed
-- follow-up migration once the existing policy inventory is backed up.

comment on table public.oms_projects is 'Open Motion Studio anonymous projects; access through the signed visitor API only.';
comment on table public.oms_render_jobs is 'Open Motion Studio durable render job metadata.';
