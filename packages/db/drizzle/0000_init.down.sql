-- Rollback for the initial Spec 2 schema. Run against a disposable Neon branch.

DROP TRIGGER IF EXISTS verified_results_assert_verified ON verified_results;
DROP FUNCTION IF EXISTS assert_verified_run();

DROP TABLE IF EXISTS rate_limit_hits;
DROP TABLE IF EXISTS daily_boards;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS verification_jobs;
DROP TABLE IF EXISTS ranking_dirty;
DROP TABLE IF EXISTS ranking_snapshots;
DROP TABLE IF EXISTS game_bests;
DROP TABLE IF EXISTS verified_results;
DROP TABLE IF EXISTS score_submissions;
DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS attempts;
DROP TABLE IF EXISTS season_games;
DROP TABLE IF EXISTS game_versions;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS seasons;
DROP TABLE IF EXISTS profiles;

DROP TYPE IF EXISTS profile_status;
DROP TYPE IF EXISTS snapshot_scope;
DROP TYPE IF EXISTS seed_policy;
DROP TYPE IF EXISTS season_status;
DROP TYPE IF EXISTS job_state;
DROP TYPE IF EXISTS verification_status;
DROP TYPE IF EXISTS attempt_status;
