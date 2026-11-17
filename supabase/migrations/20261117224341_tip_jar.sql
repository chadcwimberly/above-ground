-- Tip jar. Amounts per platform: the iOS/Android rows name in-app products (consumables created in App Store
-- Connect / Play Console); the web rows hold payment links. A row shows only once it is active and, on the web,
-- has a url; in the apps, only if the store returns the product.
create table public.tip_options (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios', 'android', 'web')),
  label text not null,
  product_id text,
  url text,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tip_options enable row level security;
create policy "read active" on public.tip_options for select to anon, authenticated using (is_active);

-- Short pieces of app copy that aren't exercises, editable without an app update.
create table public.app_copy (
  key text primary key,
  body text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_copy enable row level security;
create policy "read" on public.app_copy for select to anon, authenticated using (true);
-- Rows (tip amounts, product IDs, support copy) live only in the database.
