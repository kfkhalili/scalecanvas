-- Add status to interview_sessions for AI kill switch (terminate_interview tool).

alter table public.interview_sessions
  add column if not exists status text not null default 'active';

comment on column public.interview_sessions.status is 'Session lifecycle: active | terminated (set by terminate_interview tool).';
