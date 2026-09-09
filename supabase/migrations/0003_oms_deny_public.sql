-- Make the P0 server-only access model explicit for the exposed public schema.
create policy oms_projects_deny_public on public.oms_projects
  for all to anon, authenticated using (false) with check (false);
create policy oms_project_versions_deny_public on public.oms_project_versions
  for all to anon, authenticated using (false) with check (false);
create policy oms_assets_deny_public on public.oms_assets
  for all to anon, authenticated using (false) with check (false);
create policy oms_render_jobs_deny_public on public.oms_render_jobs
  for all to anon, authenticated using (false) with check (false);
