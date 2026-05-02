-- Additive performance-index migration.
-- All tables already exist in production; this migration only adds the
-- secondary indexes declared in shared/schema.ts via Drizzle's index() helper.
-- IF NOT EXISTS guards make this safe to apply against populated databases
-- where some indexes may have been created out-of-band.
CREATE INDEX IF NOT EXISTS "idx_categories_space" ON "categories" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cohort_results_space" ON "cohort_results" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_workspace_access_document" ON "document_workspace_access" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_workspace_access_space" ON "document_workspace_access" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idea_contributions_idea" ON "idea_contributions" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_idea_contributions_participant" ON "idea_contributions" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ideas_space" ON "ideas" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_marketplace_allocations_space" ON "marketplace_allocations" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notes_space" ON "notes" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notes_participant" ON "notes" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_participants_space" ON "participants" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_participants_user" ON "participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personalized_results_space" ON "personalized_results" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_personalized_results_participant" ON "personalized_results" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_members_user" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_members_project" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_organization" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rankings_space" ON "rankings" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rankings_participant" ON "rankings" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_space_facilitators_user" ON "space_facilitators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_space_facilitators_space" ON "space_facilitators" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_spaces_organization" ON "spaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_spaces_project" ON "spaces" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_survey_questions_space" ON "survey_questions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_survey_responses_space" ON "survey_responses" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_votes_space" ON "votes" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_votes_participant" ON "votes" USING btree ("participant_id");
