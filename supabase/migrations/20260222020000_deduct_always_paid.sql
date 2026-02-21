-- Sessions created by deduct_token_and_create_session are always paid (trial is only via claim_trial).

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

  insert into public.interview_sessions (user_id, title, is_trial)
  values (uid, null, false)
  returning id into new_session_id;

  return new_session_id;
end;
$$;

comment on function public.deduct_token_and_create_session is
  'Decrements one token, creates a paid interview_session (is_trial=false), and returns its id.';
