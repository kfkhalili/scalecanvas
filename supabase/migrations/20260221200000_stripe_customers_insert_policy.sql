-- Allow authenticated users to insert their own stripe_customers row.
-- The checkout route creates this mapping when a user first purchases tokens.

create policy "Users can insert own stripe customer"
  on public.stripe_customers for insert
  with check (auth.uid() = user_id);
