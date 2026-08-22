-- The legacy generic collaboration API persisted versioned entities and
-- operations without materializing a CRDT document row. Postgres correctly
-- requires a parent for those rows, so the importer creates an empty,
-- version-zero FK anchor only when every child proves one unambiguous module.
-- This flag preserves that provenance and prevents an anchor from being
-- mistaken for a materialized collaboration snapshot.

alter table public.collaboration_documents
  add column legacy_synthetic_parent boolean not null default false;

alter table public.collaboration_documents
  add constraint collaboration_documents_synthetic_parent_is_empty check (
    not legacy_synthetic_parent
    or (octet_length(snapshot) = 0 and version = 0)
  );

comment on column public.collaboration_documents.legacy_synthetic_parent is
  'True only for an imported legacy FK anchor whose child entity/operation scope proves one module but whose source had no materializable document snapshot. Such rows must remain empty at version zero until explicitly replaced by a real snapshot with this flag cleared.';
