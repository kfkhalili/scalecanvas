-- Add tokens to profiles (default 1); RPC to deduct one token and create a session atomically.

alter table public.profiles
  add column if not exists tokens integer not null default 1;

comment on column public.profiles.tokens is 'Remaining interview tokens; decremented by deduct_token_and_create_session.';

create or replace function public.deduct_token_and_create_session()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  new_session_id uuid;
  tokens_now int;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.tokens into tokens_now
  from public.profiles p
  where p.id = uid
  for update;

  if not found or tokens_now is null or tokens_now < 1 then
    raise exception 'Insufficient tokens';
  end if;

  update public.profiles
  set tokens = tokens - 1, updated_at = now()
  where id = uid;

  insert into public.interview_sessions (user_id, title)
  values (uid, null)
  returning id into new_session_id;

  return new_session_id;
end;
$$;

comment on function public.deduct_token_and_create_session is 'If the calling user has tokens > 0, decrements tokens by 1, creates an interview_session, and returns its id; otherwise raises.';
