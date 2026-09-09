# Supabase rollout checklist

These migrations target the existing `kmerhosting` project and create only
`oms_*` objects. Before applying them:

1. Export the current schemas, tables, functions, policies, storage buckets and
   grants from the project.
2. Confirm no `oms_` collision exists.
3. Review the storage bucket insertion against the current Storage schema.
4. Apply migrations through the Supabase CLI or MCP after the inventory backup.
5. Run policy tests with two opaque visitor IDs and verify service-role access
   is server-only.

P0 routes all data access through the API. No Supabase secret, service-role key,
or administrative identifier is included in the editor bundle.
