-- Stripe integration: customer mapping and purchase ledger for token packs.

-- Maps Supabase user to Stripe customer (one-to-one).
create table if not exists public.stripe_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.stripe_customers enable row level security;

drop policy if exists "Users can view own stripe customer" on public.stripe_customers;
create policy "Users can view own stripe customer"
  on public.stripe_customers for select
  using (auth.uid() = user_id);

-- Token purchase ledger; stripe_session_id is unique for idempotent webhook handling.
create table if not exists public.token_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_session_id text not null unique,
  pack_id text not null,
  tokens_credited integer not null,
  created_at timestamptz not null default now()
);

alter table public.token_purchases enable row level security;

drop policy if exists "Users can view own purchases" on public.token_purchases;
create policy "Users can view own purchases"
  on public.token_purchases for select
  using (auth.uid() = user_id);

-- Atomic: insert purchase record and credit tokens in one transaction.
-- Returns the new token balance. Idempotent via unique stripe_session_id.
create or replace function public.credit_tokens_for_purchase(
  p_user_id uuid,
  p_stripe_session_id text,
  p_pack_id text,
  p_tokens integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_balance integer;
begin
  -- Skip if already credited (idempotent).
  if exists (
    select 1 from public.token_purchases
    where stripe_session_id = p_stripe_session_id
  ) then
    select p.tokens into new_balance
    from public.profiles p
    where p.id = p_user_id;
    return coalesce(new_balance, 0);
  end if;

  insert into public.token_purchases (user_id, stripe_session_id, pack_id, tokens_credited)
  values (p_user_id, p_stripe_session_id, p_pack_id, p_tokens);

  update public.profiles
  set tokens = tokens + p_tokens, updated_at = now()
  where id = p_user_id
  returning tokens into new_balance;

  return coalesce(new_balance, 0);
end;
$$;

comment on function public.credit_tokens_for_purchase is
  'Idempotent: credits tokens for a Stripe checkout session. No-ops on duplicate stripe_session_id.';
