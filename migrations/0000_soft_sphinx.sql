CREATE TABLE "access_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"user_id" varchar,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"space_id" varchar,
	"user_id" varchar,
	"model_name" text NOT NULL,
	"operation" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_cents" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_errors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text,
	"message" text NOT NULL,
	"stack" text,
	"component_stack" text,
	"route" text,
	"user_agent" text,
	"user_id" varchar,
	"participant_id" varchar,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"generated_by" varchar NOT NULL,
	"summary" text NOT NULL,
	"key_themes" text[],
	"top_ideas" jsonb,
	"insights" text NOT NULL,
	"recommendations" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_workspace_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"space_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "idea_contributions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"contribution_type" text DEFAULT 'create' NOT NULL,
	"revision_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"content" text NOT NULL,
	"content_plain" text,
	"content_type" text DEFAULT 'text' NOT NULL,
	"source_type" text DEFAULT 'participant' NOT NULL,
	"asset_url" text,
	"asset_type" text,
	"thumbnail_url" text,
	"asset_metadata" jsonb,
	"created_by_user_id" varchar,
	"created_by_participant_id" varchar,
	"manual_category_id" varchar,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"show_on_ideation_board" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"scope" text NOT NULL,
	"organization_id" varchar,
	"space_id" varchar,
	"tags" text[],
	"uploaded_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"note_id" varchar NOT NULL,
	"coins_allocated" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"is_ai_category" boolean DEFAULT false NOT NULL,
	"manual_category_id" varchar,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"visible_in_ranking" boolean DEFAULT true NOT NULL,
	"visible_in_marketplace" boolean DEFAULT true NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"source_idea_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"space_id" varchar,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"primary_color" text,
	"domain" text,
	"allowed_domains" text[],
	"invite_only" boolean DEFAULT false NOT NULL,
	"sso_enabled" boolean DEFAULT false NOT NULL,
	"sso_provider" text,
	"entra_tenant_id" text,
	"service_plan_id" varchar,
	"subscription_started_at" timestamp,
	"subscription_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"user_id" varchar,
	"display_name" text NOT NULL,
	"email" text,
	"is_guest" boolean DEFAULT false NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"profile_data" jsonb,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "personalized_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"cohort_result_id" varchar,
	"personal_summary" text NOT NULL,
	"alignment_score" integer,
	"top_contributions" jsonb,
	"insights" text NOT NULL,
	"recommendations" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priority_matrices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"module_run_id" varchar,
	"x_axis_label" text DEFAULT 'Impact' NOT NULL,
	"y_axis_label" text DEFAULT 'Effort' NOT NULL,
	"x_min" text DEFAULT 'Low' NOT NULL,
	"x_max" text DEFAULT 'High' NOT NULL,
	"y_min" text DEFAULT 'Low' NOT NULL,
	"y_max" text DEFAULT 'High' NOT NULL,
	"snap_to_grid" boolean DEFAULT false NOT NULL,
	"grid_size" integer DEFAULT 4,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priority_matrix_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" varchar NOT NULL,
	"note_id" varchar NOT NULL,
	"module_run_id" varchar,
	"x_coord" real NOT NULL,
	"y_coord" real NOT NULL,
	"locked_by" varchar,
	"locked_at" timestamp,
	"participant_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "priority_matrix_positions_matrix_id_note_id_module_run_id_unique" UNIQUE("matrix_id","note_id","module_run_id")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_organization_id_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"note_id" varchar NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"max_workspaces" integer DEFAULT 1 NOT NULL,
	"max_team_seats" integer DEFAULT 5 NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"trial_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "space_facilitators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"space_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"project_id" varchar,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"code" varchar(9) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"guest_allowed" boolean DEFAULT false NOT NULL,
	"icon" text DEFAULT 'brain' NOT NULL,
	"session_mode" text DEFAULT 'live' NOT NULL,
	"pairwise_scope" text DEFAULT 'all' NOT NULL,
	"created_by" varchar,
	"ideation_starts_at" timestamp,
	"ideation_ends_at" timestamp,
	"voting_starts_at" timestamp,
	"voting_ends_at" timestamp,
	"ranking_starts_at" timestamp,
	"ranking_ends_at" timestamp,
	"marketplace_starts_at" timestamp,
	"marketplace_ends_at" timestamp,
	"marketplace_coin_budget" integer DEFAULT 100 NOT NULL,
	"survey_starts_at" timestamp,
	"survey_ends_at" timestamp,
	"ai_results_enabled" boolean DEFAULT false NOT NULL,
	"results_public_after_close" boolean DEFAULT false NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_scope" text DEFAULT 'organization',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "staircase_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"module_run_id" varchar,
	"min_score" real DEFAULT 0 NOT NULL,
	"max_score" real DEFAULT 10 NOT NULL,
	"step_count" integer DEFAULT 11 NOT NULL,
	"allow_decimals" boolean DEFAULT false NOT NULL,
	"min_label" text DEFAULT 'Lowest' NOT NULL,
	"max_label" text DEFAULT 'Highest' NOT NULL,
	"show_distribution" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staircase_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staircase_id" varchar NOT NULL,
	"note_id" varchar NOT NULL,
	"module_run_id" varchar,
	"participant_id" varchar,
	"score" real NOT NULL,
	"slot_offset" integer DEFAULT 0,
	"locked_by" varchar,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staircase_positions_staircase_id_note_id_module_run_id_unique" UNIQUE("staircase_id","note_id","module_run_id")
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"question_text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"note_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_organization_id_key_unique" UNIQUE("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password" text,
	"organization_id" varchar,
	"role" text DEFAULT 'user' NOT NULL,
	"display_name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"orion_id" text,
	"orion_tenant_id" text,
	"entra_id" text,
	"entra_tenant_id" text,
	"auth_provider" text DEFAULT 'local' NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_orion_id_unique" UNIQUE("orion_id"),
	CONSTRAINT "users_entra_id_unique" UNIQUE("entra_id")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"participant_id" varchar NOT NULL,
	"winner_note_id" varchar NOT NULL,
	"loser_note_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_module_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" varchar NOT NULL,
	"space_id" varchar NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_modules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"module_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_modules_space_id_module_type_unique" UNIQUE("space_id","module_type")
);
--> statement-breakpoint
CREATE TABLE "workspace_template_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_template_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"organization_id" varchar,
	"source_space_id" varchar,
	"settings" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_results" ADD CONSTRAINT "cohort_results_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_results" ADD CONSTRAINT "cohort_results_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_admins" ADD CONSTRAINT "company_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_admins" ADD CONSTRAINT "company_admins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_workspace_access" ADD CONSTRAINT "document_workspace_access_document_id_knowledge_base_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_base_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_workspace_access" ADD CONSTRAINT "document_workspace_access_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_contributions" ADD CONSTRAINT "idea_contributions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_contributions" ADD CONSTRAINT "idea_contributions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_created_by_participant_id_participants_id_fk" FOREIGN KEY ("created_by_participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_manual_category_id_categories_id_fk" FOREIGN KEY ("manual_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_documents" ADD CONSTRAINT "knowledge_base_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_documents" ADD CONSTRAINT "knowledge_base_documents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_documents" ADD CONSTRAINT "knowledge_base_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_allocations" ADD CONSTRAINT "marketplace_allocations_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_allocations" ADD CONSTRAINT "marketplace_allocations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_allocations" ADD CONSTRAINT "marketplace_allocations_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_manual_category_id_categories_id_fk" FOREIGN KEY ("manual_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_source_idea_id_ideas_id_fk" FOREIGN KEY ("source_idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_service_plan_id_service_plans_id_fk" FOREIGN KEY ("service_plan_id") REFERENCES "public"."service_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personalized_results" ADD CONSTRAINT "personalized_results_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personalized_results" ADD CONSTRAINT "personalized_results_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personalized_results" ADD CONSTRAINT "personalized_results_cohort_result_id_cohort_results_id_fk" FOREIGN KEY ("cohort_result_id") REFERENCES "public"."cohort_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrices" ADD CONSTRAINT "priority_matrices_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrices" ADD CONSTRAINT "priority_matrices_module_run_id_workspace_module_runs_id_fk" FOREIGN KEY ("module_run_id") REFERENCES "public"."workspace_module_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrix_positions" ADD CONSTRAINT "priority_matrix_positions_matrix_id_priority_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "public"."priority_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrix_positions" ADD CONSTRAINT "priority_matrix_positions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrix_positions" ADD CONSTRAINT "priority_matrix_positions_module_run_id_workspace_module_runs_id_fk" FOREIGN KEY ("module_run_id") REFERENCES "public"."workspace_module_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrix_positions" ADD CONSTRAINT "priority_matrix_positions_locked_by_participants_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priority_matrix_positions" ADD CONSTRAINT "priority_matrix_positions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_facilitators" ADD CONSTRAINT "space_facilitators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_facilitators" ADD CONSTRAINT "space_facilitators_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_modules" ADD CONSTRAINT "staircase_modules_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_modules" ADD CONSTRAINT "staircase_modules_module_run_id_workspace_module_runs_id_fk" FOREIGN KEY ("module_run_id") REFERENCES "public"."workspace_module_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_positions" ADD CONSTRAINT "staircase_positions_staircase_id_staircase_modules_id_fk" FOREIGN KEY ("staircase_id") REFERENCES "public"."staircase_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_positions" ADD CONSTRAINT "staircase_positions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_positions" ADD CONSTRAINT "staircase_positions_module_run_id_workspace_module_runs_id_fk" FOREIGN KEY ("module_run_id") REFERENCES "public"."workspace_module_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_positions" ADD CONSTRAINT "staircase_positions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staircase_positions" ADD CONSTRAINT "staircase_positions_locked_by_participants_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_winner_note_id_notes_id_fk" FOREIGN KEY ("winner_note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_loser_note_id_notes_id_fk" FOREIGN KEY ("loser_note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_module_runs" ADD CONSTRAINT "workspace_module_runs_module_id_workspace_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."workspace_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_module_runs" ADD CONSTRAINT "workspace_module_runs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_modules" ADD CONSTRAINT "workspace_modules_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_template_documents" ADD CONSTRAINT "workspace_template_documents_template_id_workspace_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workspace_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_template_notes" ADD CONSTRAINT "workspace_template_notes_template_id_workspace_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workspace_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_templates" ADD CONSTRAINT "workspace_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_templates" ADD CONSTRAINT "workspace_templates_source_space_id_spaces_id_fk" FOREIGN KEY ("source_space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_templates" ADD CONSTRAINT "workspace_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_space" ON "categories" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_cohort_results_space" ON "cohort_results" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_document_workspace_access_document" ON "document_workspace_access" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_workspace_access_space" ON "document_workspace_access" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_idea_contributions_idea" ON "idea_contributions" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX "idx_idea_contributions_participant" ON "idea_contributions" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_ideas_space" ON "ideas" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_allocations_space" ON "marketplace_allocations" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_notes_space" ON "notes" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_notes_participant" ON "notes" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_participants_space" ON "participants" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_participants_user" ON "participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_personalized_results_space" ON "personalized_results" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_personalized_results_participant" ON "personalized_results" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_user" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_project" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_projects_organization" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_rankings_space" ON "rankings" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_rankings_participant" ON "rankings" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_space_facilitators_user" ON "space_facilitators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_space_facilitators_space" ON "space_facilitators" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_spaces_organization" ON "spaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_spaces_project" ON "spaces" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_survey_questions_space" ON "survey_questions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_space" ON "survey_responses" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_votes_space" ON "votes" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_votes_participant" ON "votes" USING btree ("participant_id");