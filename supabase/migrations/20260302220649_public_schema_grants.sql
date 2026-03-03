-- Supabase requires explicit GRANTs on the public schema so that PostgREST
-- can access tables as the anon/authenticated roles. These are normally set up
-- by Supabase on project creation, but must be re-applied explicitly in
-- migrations to survive any schema reset (DROP SCHEMA public CASCADE).
-- RLS policies still restrict row-level access; these grants only allow
-- PostgREST to hit the tables at all.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
