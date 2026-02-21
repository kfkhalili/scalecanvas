-- One-time trial: create session without deducting tokens when trial_claimed_at is null.

create or replace function public.claim_trial_and_create_session(p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  claimed_at timestamptz;
  new_session_id uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.trial_claimed_at into claimed_at
  from public.profiles p
  where p.id = uid
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if claimed_at is not null then
    raise exception 'Trial already claimed';
  end if;

  insert into public.interview_sessions (user_id, title, is_trial)
  values (uid, p_title, true)
  returning id into new_session_id;

  update public.profiles
  set trial_claimed_at = now(), updated_at = now()
  where id = uid;

  return new_session_id;
end;
$$;

comment on function public.claim_trial_and_create_session is
  'Creates one trial session and sets trial_claimed_at when eligible (null). Raises if trial already claimed.';
