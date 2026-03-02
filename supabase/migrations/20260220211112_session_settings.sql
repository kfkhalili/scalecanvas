-- Per-session settings (e.g. auto-review). One row per session.
create table if not exists public.session_settings (
  session_id uuid primary key references public.interview_sessions (id) on delete cascade,
  auto_review_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.session_settings enable row level security;

drop policy if exists "Users can view settings of own sessions" on public.session_settings;
create policy "Users can view settings of own sessions"
  on public.session_settings for select
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert settings for own sessions" on public.session_settings;
create policy "Users can insert settings for own sessions"
  on public.session_settings for insert
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update settings of own sessions" on public.session_settings;
create policy "Users can update settings of own sessions"
  on public.session_settings for update
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
