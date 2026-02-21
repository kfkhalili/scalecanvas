-- Add is_trial flag to interview_sessions for free-trial vs paid session differentiation.
-- The deduct_token_and_create_session RPC is updated to mark the first-ever session as trial.

alter table public.interview_sessions
  add column if not exists is_trial boolean not null default false;

comment on column public.interview_sessions.is_trial is
  'True for the user''s first-ever session (free 15-min trial); false for paid 60-min sessions.';

-- Replace the RPC to set is_trial = true when user has zero previous sessions.
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
  session_count int;
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

  select count(*) into session_count
  from public.interview_sessions s
  where s.user_id = uid;

  insert into public.interview_sessions (user_id, title, is_trial)
  values (uid, null, session_count = 0)
  returning id into new_session_id;

  return new_session_id;
end;
$$;

comment on function public.deduct_token_and_create_session is
  'Decrements one token, creates an interview_session (is_trial=true if first session), and returns its id.';
