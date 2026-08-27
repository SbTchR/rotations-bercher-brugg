-- Rotations Bercher–Brugg — stockage privé pour l’interface GitHub Pages.
-- À exécuter une seule fois dans l’éditeur SQL d’un projet Supabase vide.

create table if not exists public.authorized_users (
  email text primary key,
  organization text not null check (organization in ('Bercher', 'Bezirksschule', 'Sekundarschule')),
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint authorized_users_email_lowercase check (email = lower(email))
);

create table if not exists public.workspaces (
  id bigint generated always as identity primary key,
  title text not null,
  school_year text not null unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.workspace_versions (
  id bigint generated always as identity primary key,
  workspace_id bigint not null references public.workspaces(id) on delete cascade,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid references auth.users(id) on delete set null
);

create index if not exists workspace_versions_workspace_saved_idx
  on public.workspace_versions (workspace_id, saved_at desc);

create or replace function public.is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.authorized_users
    where email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;

create or replace function public.touch_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

create or replace function public.archive_workspace_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_versions (workspace_id, data, saved_by)
  values (new.id, new.data, new.updated_by);
  return new;
end;
$$;

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch
before update on public.workspaces
for each row execute function public.touch_workspace();

drop trigger if exists workspaces_archive on public.workspaces;
create trigger workspaces_archive
after update on public.workspaces
for each row execute function public.archive_workspace_version();

create or replace function public.save_workspace(
  workspace_id bigint,
  expected_updated_at timestamptz,
  payload jsonb
)
returns table(updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_authorized()) then
    raise exception 'Accès non autorisé';
  end if;

  return query
  update public.workspaces as workspace
  set data = payload
  where workspace.id = save_workspace.workspace_id
    and workspace.updated_at = save_workspace.expected_updated_at
  returning workspace.updated_at;
end;
$$;

alter table public.authorized_users enable row level security;
alter table public.authorized_users force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_versions enable row level security;
alter table public.workspace_versions force row level security;

drop policy if exists authorized_users_self_select on public.authorized_users;
create policy authorized_users_self_select on public.authorized_users
  for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists workspaces_authorized_select on public.workspaces;
create policy workspaces_authorized_select on public.workspaces
  for select to authenticated
  using ((select public.is_authorized()));

drop policy if exists workspace_versions_authorized_select on public.workspace_versions;
create policy workspace_versions_authorized_select on public.workspace_versions
  for select to authenticated
  using ((select public.is_authorized()));

revoke all on public.authorized_users, public.workspaces, public.workspace_versions from anon;
revoke all on public.authorized_users, public.workspaces, public.workspace_versions from authenticated;
grant select on public.authorized_users, public.workspaces, public.workspace_versions to authenticated;
revoke all on function public.archive_workspace_version() from public, anon, authenticated;
revoke all on function public.is_authorized() from public, anon, authenticated;
grant execute on function public.is_authorized() to authenticated;
revoke all on function public.save_workspace(bigint, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_workspace(bigint, timestamptz, jsonb) to authenticated;

insert into public.workspaces (title, school_year, data)
values ('Échange 2026–2027', '2026–2027', '{}'::jsonb)
on conflict (school_year) do nothing;

-- Comptes génériques : créer séparément ces cinq utilisateurs dans Authentication → Users,
-- avec une adresse déjà confirmée et un mot de passe distinct qui ne doit jamais figurer ici.
insert into public.authorized_users (email, organization, display_name) values
  ('responsable1@comptes.rotations-bercher-brugg.invalid', 'Bercher', 'Responsable 1'),
  ('responsable2@comptes.rotations-bercher-brugg.invalid', 'Bezirksschule', 'Responsable 2'),
  ('responsable3@comptes.rotations-bercher-brugg.invalid', 'Sekundarschule', 'Responsable 3'),
  ('responsable4@comptes.rotations-bercher-brugg.invalid', 'Bercher', 'Responsable 4'),
  ('responsable5@comptes.rotations-bercher-brugg.invalid', 'Bezirksschule', 'Responsable 5')
on conflict (email) do update
set organization = excluded.organization, display_name = excluded.display_name;
