create type public.app_role as enum ('admin','moderator','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create table public.profiles (id uuid primary key, display_name text, created_at timestamptz not null default now());
grant select, insert, update on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.trusted_contacts (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), name text not null check (char_length(name) between 1 and 40), relation text check (char_length(relation) <= 40), selected boolean not null default true, created_at timestamptz not null default now());
grant select, insert, update, delete on public.trusted_contacts to authenticated; grant all on public.trusted_contacts to service_role;
alter table public.trusted_contacts enable row level security;
create policy "own contacts" on public.trusted_contacts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'moderator') then
    insert into public.user_roles(user_id, role) values (new.id, 'moderator');
  end if;
  insert into public.trusted_contacts(user_id, name, relation, selected) values (new.id,'Mom','Family',true),(new.id,'Riya','Friend',true),(new.id,'Warden','Hostel warden',false);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  category text not null check (category in ('Broken light','Unsafe path','Harassment concern','Hazard')),
  area text not null check (area in ('fast','bal','safe')),
  details text not null check (char_length(details) between 1 and 140),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
grant select on public.reports to anon; grant select, insert, update on public.reports to authenticated; grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "public sees verified" on public.reports for select to anon using (status = 'verified');
create policy "members see all" on public.reports for select to authenticated using (true);
create policy "members submit" on public.reports for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "moderators moderate" on public.reports for update to authenticated using (public.has_role(auth.uid(),'moderator')) with check (public.has_role(auth.uid(),'moderator'));

create or replace function public.enforce_report_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where user_id = new.user_id and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Rate limit reached: 3 reports per hour';
  end if;
  new.details := regexp_replace(new.details, '[<>&"''`]', '', 'g');
  return new;
end $$;
create trigger reports_rate_limit before insert on public.reports for each row execute function public.enforce_report_limit();

create or replace function public.reports_left() returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 3 - count(*))::int from public.reports where user_id = auth.uid() and created_at > now() - interval '1 hour' $$;

insert into public.reports(user_id, category, area, details, status) values
 (null,'Broken light','fast','Two lamps out near Market lane','verified'),
 (null,'Unsafe path','bal','Overgrown hedge blocks the view on Park road','pending');

alter publication supabase_realtime add table public.reports;
alter table public.reports replica identity full;