CREATE TYPE "public"."attempt_status" AS ENUM('issued', 'active', 'submitted', 'abandoned', 'expired');--> statement-breakpoint
CREATE TYPE "public"."job_state" AS ENUM('queued', 'locked', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('scheduled', 'active', 'closing', 'closed');--> statement-breakpoint
CREATE TYPE "public"."seed_policy" AS ENUM('fixed-course', 'daily-seed', 'weekly-seed');--> statement-breakpoint
CREATE TYPE "public"."snapshot_scope" AS ENUM('game', 'championship', 'daily', 'best6');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_game_id" uuid NOT NULL,
	"game_version_id" uuid NOT NULL,
	"seed" "bytea" NOT NULL,
	"nonce" "bytea" NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "attempt_status" DEFAULT 'issued' NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_nonce_unique" UNIQUE("nonce"),
	CONSTRAINT "attempts_seed_len" CHECK (octet_length("attempts"."seed") = 16),
	CONSTRAINT "attempts_nonce_len" CHECK (octet_length("attempts"."nonce") = 16)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor" uuid,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"request_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_game_id" uuid NOT NULL,
	"utc_date" date NOT NULL,
	"seed" "bytea" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_boards_unique" UNIQUE("season_game_id","utc_date"),
	CONSTRAINT "daily_boards_seed_len" CHECK (octet_length("daily_boards"."seed") = 16)
);
--> statement-breakpoint
CREATE TABLE "game_bests" (
	"season_game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"verified_result_id" uuid NOT NULL,
	"score" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_bests_season_game_id_user_id_pk" PRIMARY KEY("season_game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "game_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"game_version" text NOT NULL,
	"simulation_version" integer NOT NULL,
	"scoring_version" integer NOT NULL,
	"rapier_build_hash" text NOT NULL,
	"detmath_version" integer NOT NULL,
	"replay_format_version" integer NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"released_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_versions_pin" UNIQUE("game_id","game_version","simulation_version","scoring_version"),
	CONSTRAINT "game_versions_hash_len" CHECK (length("game_versions"."rapier_build_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"registry_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug"),
	CONSTRAINT "games_registry_id_unique" UNIQUE("registry_id"),
	CONSTRAINT "games_registry_id_u16" CHECK ("games"."registry_id" >= 0 AND "games"."registry_id" <= 65535)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"handle" "citext",
	"handle_claimed_at" timestamp with time zone,
	"handle_changed_at" timestamp with time zone,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "ranking_dirty" (
	"season_id" uuid PRIMARY KEY NOT NULL,
	"dirty_at" timestamp with time zone NOT NULL,
	"last_recomputed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"scope" "snapshot_scope" NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limit_hits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"claimed_score" bigint NOT NULL,
	"total_ticks" integer NOT NULL,
	"replay" "bytea" NOT NULL,
	"final_state_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "runs_ticks_positive" CHECK ("runs"."total_ticks" > 0),
	CONSTRAINT "runs_hash_len" CHECK (octet_length("runs"."final_state_hash") = 8)
);
--> statement-breakpoint
CREATE TABLE "score_submissions" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"reason_code" text,
	"first_divergent_tick" integer,
	"verified_score" bigint,
	"verified_hash" "bytea",
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"game_version_id" uuid NOT NULL,
	"seed_policy" "seed_policy" NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_to" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_games_unique" UNIQUE("season_id","game_id","seed_policy")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "season_status" NOT NULL,
	"rules_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "verification_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"state" "job_state" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_jobs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "verified_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_game_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"score" bigint NOT NULL,
	"tiebreak_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"achieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verified_results_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_season_game_id_season_games_id_fk" FOREIGN KEY ("season_game_id") REFERENCES "public"."season_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_boards" ADD CONSTRAINT "daily_boards_season_game_id_season_games_id_fk" FOREIGN KEY ("season_game_id") REFERENCES "public"."season_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_bests" ADD CONSTRAINT "game_bests_season_game_id_season_games_id_fk" FOREIGN KEY ("season_game_id") REFERENCES "public"."season_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_bests" ADD CONSTRAINT "game_bests_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_bests" ADD CONSTRAINT "game_bests_verified_result_id_verified_results_id_fk" FOREIGN KEY ("verified_result_id") REFERENCES "public"."verified_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_dirty" ADD CONSTRAINT "ranking_dirty_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_submissions" ADD CONSTRAINT "score_submissions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_games" ADD CONSTRAINT "season_games_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_games" ADD CONSTRAINT "season_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_games" ADD CONSTRAINT "season_games_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_jobs" ADD CONSTRAINT "verification_jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_results" ADD CONSTRAINT "verified_results_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_results" ADD CONSTRAINT "verified_results_season_game_id_season_games_id_fk" FOREIGN KEY ("season_game_id") REFERENCES "public"."season_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_results" ADD CONSTRAINT "verified_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_issued" ON "attempts" USING btree ("user_id","issued_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "game_bests_board" ON "game_bests" USING btree ("season_game_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_snapshots_live" ON "ranking_snapshots" USING btree ("season_id","scope","subject_id") WHERE "ranking_snapshots"."frozen" = false;--> statement-breakpoint
CREATE INDEX "jobs_claim" ON "verification_jobs" USING btree ("state","id");--> statement-breakpoint
CREATE INDEX "verified_results_board" ON "verified_results" USING btree ("season_game_id","score" DESC NULLS LAST,"achieved_at");