create table public.live_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lat double precision, lng double precision, acc integer,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.live_shares to authenticated;
grant all on public.live_shares to service_role;
alter table public.live_shares enable row level security;
create policy "own shares" on public.live_shares for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_live_share(_id uuid)
returns table(lat double precision, lng double precision, acc integer, updated_at timestamptz, live boolean, name text)
language sql stable security definer set search_path = public as $$
  select s.lat, s.lng, s.acc, s.updated_at, (s.active and s.expires_at > now()), p.display_name
  from public.live_shares s left join public.profiles p on p.id = s.user_id
  where s.id = _id and s.expires_at > now() - interval '1 hour'
$$;
grant execute on function public.get_live_share(uuid) to anon, authenticated;