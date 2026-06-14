
create table if not exists apps_cache (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  repo text not null,
  full_name text not null unique,
  name text,
  description text,
  stars integer default 0,
  forks integer default 0,
  language text,
  topics jsonb default '[]',
  avatar_url text,
  platforms jsonb default '[]',
  latest_version text,
  latest_release_date timestamptz,
  readme text,
  download_count integer default 0,
  html_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_synced_at timestamptz default now()
);

create table if not exists releases_cache (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps_cache(id) on delete cascade,
  version text not null,
  published_at timestamptz,
  body text,
  assets jsonb default '[]',
  download_count integer default 0,
  html_url text,
  created_at timestamptz default now()
);

create index if not exists idx_apps_cache_stars on apps_cache(stars desc);
create index if not exists idx_apps_cache_language on apps_cache(language);
create index if not exists idx_apps_cache_platforms on apps_cache(platforms);
create index if not exists idx_apps_cache_updated on apps_cache(updated_at desc);
create index if not exists idx_releases_cache_app on releases_cache(app_id);

alter table apps_cache enable row level security;
alter table releases_cache enable row level security;

create policy "Allow anonymous read apps"
  on apps_cache for select to anon using (true);

create policy "Allow anonymous read releases"
  on releases_cache for select to anon using (true);
