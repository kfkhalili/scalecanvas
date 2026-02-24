-- ScaleCanvas: profiles, interview_sessions, session_transcripts, canvas_states + RLS + profile trigger

-- Profiles (one per auth user)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Interview sessions
create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interview_sessions enable row level security;

create policy "Users can view own sessions"
  on public.interview_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.interview_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.interview_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.interview_sessions for delete
  using (auth.uid() = user_id);

-- Session transcripts
create table public.session_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index session_transcripts_session_id_created_at_idx
  on public.session_transcripts (session_id, created_at);

alter table public.session_transcripts enable row level security;

create policy "Users can view transcripts of own sessions"
  on public.session_transcripts for select
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert transcripts into own sessions"
  on public.session_transcripts for insert
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Canvas states (one per session)
create table public.canvas_states (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade unique,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  viewport jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canvas_states enable row level security;

create policy "Users can view canvas of own sessions"
  on public.canvas_states for select
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can insert canvas for own sessions"
  on public.canvas_states for insert
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "Users can update canvas of own sessions"
  on public.canvas_states for update
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

-- Create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
