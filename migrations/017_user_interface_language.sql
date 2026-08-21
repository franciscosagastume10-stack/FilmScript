ALTER TABLE users ADD COLUMN interface_language TEXT;

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '17');
