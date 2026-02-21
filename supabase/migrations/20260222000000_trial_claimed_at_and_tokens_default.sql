-- Trial semantics: profile-scoped one-time trial; new users get 0 tokens by default.

alter table public.profiles
  add column if not exists trial_claimed_at timestamptz null default null;

comment on column public.profiles.trial_claimed_at is
  'Set once when user claims one-time trial (handoff); null = eligible for trial.';

-- Existing users who already have at least one session are not eligible for trial.
update public.profiles
set trial_claimed_at = now()
where id in (select user_id from public.interview_sessions);

-- New inserts get 0 tokens; existing rows keep current value.
alter table public.profiles
  alter column tokens set default 0;
