-- Historical image/text ledgers record exact usage by cycle, but older JSON
-- snapshots did not retain the plan allowance for every completed cycle.
-- Keep that uncertainty explicit instead of fabricating a historical limit.

alter table private.credit_windows
  add column legacy_allowance_unknown boolean not null default false;

alter table private.credit_windows
  alter column allowance drop not null;

alter table private.credit_windows
  add constraint credit_windows_allowance_known_or_legacy_unknown check (
    allowance is not null or legacy_allowance_unknown
  );

alter table private.credit_windows
  add constraint credit_windows_unknown_allowance_is_null check (
    not legacy_allowance_unknown or allowance is null
  );

comment on column private.credit_windows.legacy_allowance_unknown is
  'True only for an imported legacy cycle whose exact usage is known but whose historical allowance was not retained. Current-cycle rows must carry their exact allowance.';
