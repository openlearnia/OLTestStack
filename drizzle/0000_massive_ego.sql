CREATE TYPE "public"."test_report_status" AS ENUM('passed', 'failed', 'error');--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"browser_id" varchar(64) NOT NULL,
	"headless" varchar(8) NOT NULL,
	"recording_enabled" varchar(8) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browser_sessions_browser_id_unique" UNIQUE("browser_id")
);
--> statement-breakpoint
CREATE TABLE "page_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar(64) NOT NULL,
	"browser_id" varchar(64) NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_sessions_page_id_unique" UNIQUE("page_id")
);
--> statement-breakpoint
CREATE TABLE "recorded_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"browser_id" varchar(64) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"action" varchar(64) NOT NULL,
	"target" text,
	"page_id" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"browser_id" varchar(64),
	"test_name" varchar(512) NOT NULL,
	"status" "test_report_status" NOT NULL,
	"actions_performed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assertions_passed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assertions_failed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screenshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"network_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"console_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"execution_time_ms" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recorded_events" ADD CONSTRAINT "recorded_events_report_id_test_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."test_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browser_sessions_browser_id_idx" ON "browser_sessions" USING btree ("browser_id");--> statement-breakpoint
CREATE INDEX "page_sessions_page_id_idx" ON "page_sessions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_sessions_browser_id_idx" ON "page_sessions" USING btree ("browser_id");--> statement-breakpoint
CREATE INDEX "recorded_events_report_id_idx" ON "recorded_events" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "recorded_events_browser_id_idx" ON "recorded_events" USING btree ("browser_id");--> statement-breakpoint
CREATE INDEX "recorded_events_timestamp_idx" ON "recorded_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "test_reports_browser_id_idx" ON "test_reports" USING btree ("browser_id");