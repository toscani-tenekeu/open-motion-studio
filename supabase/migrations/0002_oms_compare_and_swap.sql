create or replace function oms_private.oms_save_project(
  p_project_id uuid,
  p_visitor_id text,
  p_expected_revision bigint,
  p_document jsonb,
  p_checksum text,
  p_media_manifest jsonb default '[]'::jsonb
)
returns public.oms_projects
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare saved public.oms_projects;
begin
  update public.oms_projects
  set document = p_document,
      checksum = p_checksum,
      media_manifest = p_media_manifest,
      revision = revision + 1,
      updated_at = now()
  where id = p_project_id
    and visitor_id = p_visitor_id
    and revision = p_expected_revision
  returning * into saved;

  if saved.id is null then
    raise exception using errcode = '40001', message = 'oms_revision_conflict';
  end if;

  insert into public.oms_project_versions(project_id, visitor_id, revision, document, checksum)
  values (saved.id, saved.visitor_id, saved.revision, saved.document, saved.checksum);
  return saved;
end;
$$;

revoke all on function oms_private.oms_save_project(uuid, text, bigint, jsonb, text, jsonb) from public, anon, authenticated;
