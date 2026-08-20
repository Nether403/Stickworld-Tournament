-- Rollback for the additive Spec 5 compliance schema.

DROP TABLE IF EXISTS moderation_actions;
DROP TABLE IF EXISTS ugc_reports;
DROP TABLE IF EXISTS ranked_invites;

ALTER TABLE profiles DROP COLUMN IF EXISTS role;
ALTER TABLE profiles DROP COLUMN IF EXISTS email;
ALTER TABLE seasons DROP COLUMN IF EXISTS entry_policy;

DROP TYPE IF EXISTS moderation_action;
DROP TYPE IF EXISTS ugc_report_status;
DROP TYPE IF EXISTS season_entry_policy;
DROP TYPE IF EXISTS profile_role;
