ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;

UPDATE users
SET first_name = CASE
      WHEN TRIM(COALESCE(name, '')) <> '' AND TRIM(name) LIKE '% %'
      THEN SUBSTR(TRIM(name), 1, INSTR(TRIM(name), ' ') - 1)
      WHEN TRIM(COALESCE(name, '')) <> ''
      THEN TRIM(name)
      ELSE first_name
    END,
    last_name = CASE
      WHEN TRIM(COALESCE(name, '')) LIKE '% %'
      THEN TRIM(SUBSTR(TRIM(name), INSTR(TRIM(name), ' ') + 1))
      ELSE last_name
    END
WHERE (first_name IS NULL OR TRIM(first_name) = '')
   OR (last_name IS NULL OR TRIM(last_name) = '');

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '18');
