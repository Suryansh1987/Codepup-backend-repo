CREATE TABLE "ci_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"project_id" integer,
	"content" text NOT NULL,
	"message_type" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"file_modifications" text[],
	"modification_approach" varchar(30),
	"modification_success" boolean,
	"reasoning" text,
	"selected_files" text[],
	"error_details" text,
	"step_type" varchar(50),
	"modification_ranges" text,
	"project_summary_id" uuid
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_message" text,
	"agent_response" text,
	"function_called" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ci_conversation_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"project_id" integer,
	"total_message_count" integer DEFAULT 0,
	"summary_count" integer DEFAULT 0,
	"last_message_at" timestamp with time zone,
	"last_modification_at" timestamp with time zone,
	"total_modifications" integer DEFAULT 0,
	"successful_modifications" integer DEFAULT 0,
	"failed_modifications" integer DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT now(),
	"last_activity" timestamp with time zone DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ci_conversation_stats_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"current_step" varchar(50) DEFAULT 'analysis',
	"design_choices" jsonb,
	"generated_files" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "ci_message_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"project_id" integer,
	"summary" text NOT NULL,
	"message_count" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"key_topics" text[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"build_id" text NOT NULL,
	"deployment_url" text NOT NULL,
	"download_url" text,
	"zip_url" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"build_time" integer,
	"error_message" text,
	"framework" varchar(50),
	"node_version" varchar(20),
	"package_manager" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_activity" timestamp DEFAULT now(),
	"message_count" integer DEFAULT 0,
	"user_agent" text,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "ci_project_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"project_id" integer,
	"summary" text NOT NULL,
	"original_prompt" text NOT NULL,
	"zip_url" text,
	"build_id" text,
	"deployment_url" text,
	"file_count" integer DEFAULT 0,
	"components_created" text[],
	"pages_created" text[],
	"technologies_used" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ci_session_modifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"project_id" integer,
	"message_id" uuid,
	"modification_prompt" text NOT NULL,
	"approach" varchar(30) NOT NULL,
	"files_modified" text[],
	"files_created" text[],
	"success" boolean NOT NULL,
	"error_message" text,
	"processing_time" integer,
	"had_conversation_history" boolean DEFAULT false,
	"had_project_summary" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "messages" CASCADE;--> statement-breakpoint
ALTER TABLE "project_files" DROP CONSTRAINT "project_files_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_usage" DROP CONSTRAINT "user_usage_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "project_type" SET DEFAULT 'frontend';--> statement-breakpoint
ALTER TABLE "project_files" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "project_files" ADD COLUMN "last_modified_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "download_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "zip_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "build_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "aneon_key" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "supabase_url" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_session_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "message_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "framework" varchar(50) DEFAULT 'react';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "template" varchar(100) DEFAULT 'vite-react-ts';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_usage" ADD COLUMN "modifications_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_usage" ADD COLUMN "deployments_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_usage" ADD COLUMN "token_limit" integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_usage" ADD COLUMN "project_limit" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_usage" ADD COLUMN "is_over_limit" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" varchar(50) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "ci_messages" ADD CONSTRAINT "ci_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_messages" ADD CONSTRAINT "ci_messages_project_summary_id_ci_project_summaries_id_fk" FOREIGN KEY ("project_summary_id") REFERENCES "public"."ci_project_summaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_conversation_stats" ADD CONSTRAINT "ci_conversation_stats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_message_summaries" ADD CONSTRAINT "ci_message_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deployments" ADD CONSTRAINT "project_deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sessions" ADD CONSTRAINT "project_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_project_summaries" ADD CONSTRAINT "ci_project_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_session_modifications" ADD CONSTRAINT "ci_session_modifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_session_modifications" ADD CONSTRAINT "ci_session_modifications_message_id_ci_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ci_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ci_messages_created_at" ON "ci_messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ci_messages_session_id" ON "ci_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ci_messages_project_id" ON "ci_messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ci_messages_step_type" ON "ci_messages" USING btree ("step_type");--> statement-breakpoint
CREATE INDEX "idx_ci_messages_project_summary_id" ON "ci_messages" USING btree ("project_summary_id");--> statement-breakpoint
CREATE INDEX "idx_ci_stats_session_id" ON "ci_conversation_stats" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ci_stats_project_id" ON "ci_conversation_stats" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ci_stats_is_active" ON "ci_conversation_stats" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ci_summaries_created_at" ON "ci_message_summaries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ci_summaries_session_id" ON "ci_message_summaries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ci_summaries_project_id" ON "ci_message_summaries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ci_project_summaries_created_at" ON "ci_project_summaries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ci_project_summaries_session_id" ON "ci_project_summaries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ci_project_summaries_project_id" ON "ci_project_summaries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ci_project_summaries_is_active" ON "ci_project_summaries" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ci_project_summaries_zip_url" ON "ci_project_summaries" USING btree ("zip_url");--> statement-breakpoint
CREATE INDEX "idx_ci_modifications_session_id" ON "ci_session_modifications" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ci_modifications_project_id" ON "ci_session_modifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ci_modifications_created_at" ON "ci_session_modifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ci_modifications_success" ON "ci_session_modifications" USING btree ("success");--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;