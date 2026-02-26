-- Persistent rate-limit buckets for serverless-safe request throttling.
-- Replaces the in-memory Map that reset on every cold start.

create table if not exists public.rate_limit_buckets (
  key   text        primary key,
  count int         not null default 1,
  reset_at timestamptz not null
);

-- RLS: only the service role (used by server routes) touches this table.
alter table public.rate_limit_buckets enable row level security;

-- Atomic check-and-increment.  Returns a JSON object:
--   { "allowed": bool, "remaining": int, "reset_at": iso-string }
--
-- When the window has expired (or the key doesn't exist), it upserts a fresh
-- bucket.  Otherwise it increments and checks against p_max.

create or replace function public.check_rate_limit(
  p_key       text,
  p_window_ms int,
  p_max       int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket   record;
  new_reset timestamptz;
begin
  -- Try to fetch an existing, non-expired bucket and lock it.
  select b.count, b.reset_at into bucket
  from public.rate_limit_buckets b
  where b.key = p_key
    and b.reset_at > now()
  for update;

  if not found then
    -- First request in this window (or previous window expired).
    new_reset := now() + (p_window_ms || ' milliseconds')::interval;

    insert into public.rate_limit_buckets (key, count, reset_at)
    values (p_key, 1, new_reset)
    on conflict (key) do update
      set count    = 1,
          reset_at = excluded.reset_at;

    return jsonb_build_object(
      'allowed',   true,
      'remaining', p_max - 1,
      'reset_at',  to_char(new_reset, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;

  if bucket.count >= p_max then
    return jsonb_build_object(
      'allowed',   false,
      'remaining', 0,
      'reset_at',  to_char(bucket.reset_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;

  update public.rate_limit_buckets
  set count = count + 1
  where key = p_key;

  return jsonb_build_object(
    'allowed',   true,
    'remaining', p_max - (bucket.count + 1),
    'reset_at',  to_char(bucket.reset_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;
