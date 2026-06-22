ALTER TABLE "test_reports" ADD COLUMN "saved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "test_reports" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "test_reports" ADD COLUMN "saved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "test_reports_expires_at_idx" ON "test_reports" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "test_reports_saved_idx" ON "test_reports" USING btree ("saved");