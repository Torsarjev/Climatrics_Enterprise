-- Phase 1 storage: the same JSON/CSV documents the app keeps in Netlify Blobs today,
-- in one table, so switching backends needs no change to the app's data model.
create table if not exists public.app_kv (
  key        text primary key,
  value      text not null,
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.app_kv enable row level security;
-- No policies: only the server (service role) can read or write. Browser keys get nothing.
revoke all on public.app_kv from anon, authenticated;

create or replace function public.kv_put(p_key text, p_value text)
returns bigint
language sql
as $$
  insert into public.app_kv (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, version = public.app_kv.version + 1, updated_at = now()
  returning version;
$$;

-- Compare-and-swap: writes only if nobody else changed the row since it was read.
create or replace function public.kv_cas(p_key text, p_value text, p_version bigint)
returns boolean
language plpgsql
as $$
begin
  update public.app_kv set value = p_value, version = version + 1, updated_at = now()
  where key = p_key and version = p_version;
  return found;
end;
$$;

revoke all on function public.kv_put(text, text) from public, anon, authenticated;
revoke all on function public.kv_cas(text, text, bigint) from public, anon, authenticated;
grant execute on function public.kv_put(text, text) to service_role;
grant execute on function public.kv_cas(text, text, bigint) to service_role;
