-- Execute somente em um projeto Supabase exclusivo da BE IMPORTS.
create table if not exists public.be_imports_catalog (
  id integer primary key check (id = 1),
  document jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.be_imports_catalog enable row level security;
-- Não há políticas públicas: somente a secret key do servidor pode ler e escrever.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('be-imports-products', 'be-imports-products', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
