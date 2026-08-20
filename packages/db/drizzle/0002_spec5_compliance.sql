ALTER TYPE "profile_status" ADD VALUE IF NOT EXISTS 'anonymised';--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('player', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."season_entry_policy" AS ENUM('invite', 'open');--> statement-breakpoint
CREATE TYPE "public"."ugc_report_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('dismiss', 'force_release_handle', 'suspend', 'unsuspend');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "role" "profile_role" DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email" "citext";--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "entry_policy" "season_entry_policy" DEFAULT 'open' NOT NULL;--> statement-breakpoint
CREATE TABLE "ranked_invites" (
	"email" "citext" PRIMARY KEY NOT NULL,
	"invited_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ugc_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid,
	"reporter_ip_hash" text NOT NULL,
	"target_user_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" "ugc_report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"action" "moderation_action" NOT NULL,
	"reason_code" text NOT NULL,
	"reason_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ranked_invites" ADD CONSTRAINT "ranked_invites_consumed_user_id_profiles_user_id_fk" FOREIGN KEY ("consumed_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_reports" ADD CONSTRAINT "ugc_reports_reporter_user_id_profiles_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_reports" ADD CONSTRAINT "ugc_reports_target_user_id_profiles_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_ugc_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."ugc_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_user_id_profiles_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_profiles_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ugc_reports_queue" ON "ugc_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_target" ON "moderation_actions" USING btree ("target_user_id","created_at");
