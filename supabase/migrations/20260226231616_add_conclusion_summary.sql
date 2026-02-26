-- Final summary from time-expired or voluntary conclusion; set once per session.
alter table public.interview_sessions
  add column if not exists conclusion_summary text null;

comment on column public.interview_sessions.conclusion_summary is
  'Final summary from time-expired or voluntary conclusion; set once per session.';
