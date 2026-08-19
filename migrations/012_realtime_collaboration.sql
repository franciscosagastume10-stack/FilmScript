CREATE TABLE IF NOT EXISTS collaboration_documents (
  project_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  module TEXT NOT NULL,
  snapshot_blob BLOB NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(project_id, document_id)
);

CREATE TABLE IF NOT EXISTS collaboration_entities (
  project_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  field_versions_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(project_id, document_id, entity_id)
);

CREATE INDEX IF NOT EXISTS collaboration_entities_module_idx
  ON collaboration_entities(project_id, module, document_id);
