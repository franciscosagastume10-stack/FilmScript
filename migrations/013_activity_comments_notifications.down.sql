DROP TABLE IF EXISTS comment_mentions;
DROP INDEX IF EXISTS activity_events_aggregation_idx;
-- SQLite does not safely remove the additive columns on mixed production versions.
INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '12');
