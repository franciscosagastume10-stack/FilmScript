ALTER TABLE scripts ADD COLUMN translated_from_project_id TEXT REFERENCES scripts(id) ON DELETE SET NULL;
ALTER TABLE scripts ADD COLUMN translated_from_script_id TEXT REFERENCES scripts(id) ON DELETE SET NULL;
ALTER TABLE scripts ADD COLUMN source_language TEXT;
ALTER TABLE scripts ADD COLUMN target_language TEXT;
ALTER TABLE scripts ADD COLUMN translation_version INTEGER;
ALTER TABLE scripts ADD COLUMN translation_job_id TEXT;
ALTER TABLE scripts ADD COLUMN translated_at TEXT;

ALTER TABLE notifications ADD COLUMN deduplication_key TEXT;

ALTER TABLE ai_jobs ADD COLUMN translation_family_id TEXT;
ALTER TABLE ai_jobs ADD COLUMN target_language TEXT;
ALTER TABLE ai_jobs ADD COLUMN translation_version INTEGER;

UPDATE ai_jobs
SET translation_family_id = COALESCE(translation_family_id, source_script_id),
    target_language = COALESCE(target_language, json_extract(input_json, '$.targetLanguage'))
WHERE type = 'translation'
  AND (translation_family_id IS NULL OR target_language IS NULL);

WITH existing_versions AS (
  SELECT translation_family_id AS family_id,
         lower(target_language) AS language,
         MAX(translation_version) AS max_version
  FROM ai_jobs
  WHERE type = 'translation'
    AND status NOT IN ('failed', 'cancelled')
    AND translation_version IS NOT NULL
  GROUP BY translation_family_id, lower(target_language)
),
ranked_missing AS (
  SELECT jobs.id,
         COALESCE(existing_versions.max_version, 0) + ROW_NUMBER() OVER (
           PARTITION BY jobs.translation_family_id, lower(jobs.target_language)
           ORDER BY COALESCE(jobs.completed_at, jobs.created_at), jobs.id
         ) AS version
  FROM ai_jobs AS jobs
  LEFT JOIN existing_versions
    ON existing_versions.family_id = jobs.translation_family_id
   AND existing_versions.language = lower(jobs.target_language)
  WHERE jobs.type = 'translation'
    AND jobs.status NOT IN ('failed', 'cancelled')
    AND jobs.translation_version IS NULL
)
UPDATE ai_jobs
SET translation_version = (SELECT version FROM ranked_missing WHERE ranked_missing.id = ai_jobs.id)
WHERE id IN (SELECT id FROM ranked_missing);

WITH translated_jobs AS (
  SELECT ai_jobs.id AS job_id,
         ai_jobs.source_script_id AS source_script_id,
         ai_jobs.translation_family_id AS family_id,
         json_extract(ai_jobs.input_json, '$.sourceLanguage') AS source_language,
         ai_jobs.target_language AS target_language,
         ai_jobs.translation_version AS version,
         ai_jobs.completed_at AS translated_at,
         json_extract(ai_jobs.output_json, '$.scriptId') AS translated_script_id
  FROM ai_jobs
  WHERE ai_jobs.type = 'translation'
    AND ai_jobs.status = 'completed'
    AND json_extract(ai_jobs.output_json, '$.scriptId') IS NOT NULL
)
UPDATE scripts
SET translated_from_project_id = (SELECT family_id FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id),
    translated_from_script_id = (SELECT source_script_id FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id),
    source_language = (SELECT source_language FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id),
    target_language = (SELECT target_language FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id),
    translation_version = (SELECT version FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id),
    translation_job_id = (SELECT job_id FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id),
    translated_at = (SELECT translated_at FROM translated_jobs WHERE translated_jobs.translated_script_id = scripts.id)
WHERE source = 'translation'
  AND translated_from_project_id IS NULL
  AND id IN (SELECT translated_script_id FROM translated_jobs);

CREATE UNIQUE INDEX IF NOT EXISTS scripts_translation_job_idx
  ON scripts(translation_job_id)
  WHERE translation_job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scripts_translation_version_idx
  ON scripts(translated_from_project_id, target_language, translation_version)
  WHERE translated_from_project_id IS NOT NULL
    AND target_language IS NOT NULL
    AND translation_version IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_jobs_translation_version_idx
  ON ai_jobs(translation_family_id, target_language, translation_version)
  WHERE type = 'translation'
    AND status NOT IN ('failed', 'cancelled')
    AND translation_family_id IS NOT NULL
    AND target_language IS NOT NULL
    AND translation_version IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_deduplication_idx
  ON notifications(user_id, deduplication_key)
  WHERE deduplication_key IS NOT NULL;

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '19');
