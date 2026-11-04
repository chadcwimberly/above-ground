-- Postgres also checks SELECT policies when an insert uses ON CONFLICT (which the app's device registration does).
-- A device may read only its own row.
create policy "read self" on devices for select to authenticated
  using (id = (select auth.uid()));
