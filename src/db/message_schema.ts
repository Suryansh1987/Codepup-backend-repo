// db/unified_schema.ts - Single unified schema to prevent duplicates
import { pgTable, serial, varchar, text, timestamp, integer, jsonb, boolean, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// CORE TABLES (Users, Projects, etc.)
// ============================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }),
  profileImage: text('profile_image'),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  projectType: varchar('project_type', { length: 100 }).default('frontend'),
  generatedCode: jsonb('generated_code'),
  deploymentUrl: text('deployment_url'),
  downloadUrl: text('download_url'),
  zipUrl: text('zip_url'),
  buildId: text('build_id'),
  githubUrl: text('github_url'),
  
  aneonkey:varchar('aneon_key').notNull(),
  supabaseurl:varchar('supabase_url').notNull(),

  lastSessionId: text('last_session_id'),
  conversationTitle: varchar('conversation_title', { length: 255 }).default('Project Chat'),
  lastMessageAt: timestamp('last_message_at'),
  messageCount: integer('message_count').default(0),
  
  // Project metadata
  framework: varchar('framework', { length: 50 }).default('react'),
  template: varchar('template', { length: 100 }).default('vite-react-ts'),
  isPublic: boolean('is_public').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectFiles = pgTable('project_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileContent: text('file_content'),
  fileType: varchar('file_type', { length: 50 }),
  fileSize: integer('file_size'),
  lastModifiedAt: timestamp('last_modified_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userUsage = pgTable('user_usage', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  month: varchar('month', { length: 7 }).notNull(),
  tokensUsed: integer('tokens_used').default(0).notNull(),
  projectsCreated: integer('projects_created').default(0).notNull(),
  messagesCount: integer('messages_count').default(0).notNull(),
  modificationsCount: integer('modifications_count').default(0).notNull(),
  deploymentsCount: integer('deployments_count').default(0).notNull(),
  tokenLimit: integer('token_limit').default(100000).notNull(),
  projectLimit: integer('project_limit').default(5).notNull(),
  isOverLimit: boolean('is_over_limit').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// MESSAGING & CONVERSATION TABLES
// ============================================================================

export const messageSummaries = pgTable('ci_message_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  messageCount: integer('message_count').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  keyTopics: text('key_topics').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  createdAtIdx: index('idx_ci_summaries_created_at').on(table.createdAt),
  sessionIdIdx: index('idx_ci_summaries_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_summaries_project_id').on(table.projectId),
}));

export const ciMessages = pgTable('ci_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).notNull().$type<'user' | 'assistant' | 'system'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  
  // Metadata for file modifications
  fileModifications: text('file_modifications').array(),
  modificationApproach: varchar('modification_approach', { length: 30 }).$type<'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'FULL_FILE_GENERATION'>(),
  modificationSuccess: boolean('modification_success'),
  
  // Enhanced reasoning and context fields
  reasoning: text('reasoning'),
  selectedFiles: text('selected_files').array(),
  errorDetails: text('error_details'),
  stepType: varchar('step_type', { length: 50 }).$type<'analysis' | 'modification' | 'result' | 'fallback' | 'user_request'>(),
  
  // Modification details
  modificationRanges: text('modification_ranges'),
  
  // Reference to project summary
  projectSummaryId: uuid('project_summary_id').references(() => projectSummaries.id),
}, (table) => ({
  createdAtIdx: index('idx_ci_messages_created_at').on(table.createdAt.desc()),
  sessionIdIdx: index('idx_ci_messages_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_messages_project_id').on(table.projectId),
  stepTypeIdx: index('idx_ci_messages_step_type').on(table.stepType),
  projectSummaryIdIdx: index('idx_ci_messages_project_summary_id').on(table.projectSummaryId),
}));

export const conversationStats = pgTable('ci_conversation_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().unique(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  totalMessageCount: integer('total_message_count').default(0),
  summaryCount: integer('summary_count').default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastModificationAt: timestamp('last_modification_at', { withTimezone: true }),
  totalModifications: integer('total_modifications').default(0),
  successfulModifications: integer('successful_modifications').default(0),
  failedModifications: integer('failed_modifications').default(0),
  
  // Session metadata
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  lastActivity: timestamp('last_activity', { withTimezone: true }).defaultNow(),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_ci_stats_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_stats_project_id').on(table.projectId),
  isActiveIdx: index('idx_ci_stats_is_active').on(table.isActive),
}));

export const projectSummaries = pgTable('ci_project_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  originalPrompt: text('original_prompt').notNull(),
  
  // ZIP-based workflow fields
  zipUrl: text('zip_url'),
  buildId: text('build_id'),
  deploymentUrl: text('deployment_url'),
  
  // Summary metadata
  fileCount: integer('file_count').default(0),
  componentsCreated: text('components_created').array(),
  pagesCreated: text('pages_created').array(),
  technologiesUsed: text('technologies_used').array(),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  createdAtIdx: index('idx_ci_project_summaries_created_at').on(table.createdAt),
  sessionIdIdx: index('idx_ci_project_summaries_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_project_summaries_project_id').on(table.projectId),
  isActiveIdx: index('idx_ci_project_summaries_is_active').on(table.isActive),
  zipUrlIdx: index('idx_ci_project_summaries_zip_url').on(table.zipUrl),
}));

export const sessionModifications = pgTable('ci_session_modifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => ciMessages.id),
  
  // Modification details
  modificationPrompt: text('modification_prompt').notNull(),
  approach: varchar('approach', { length: 30 }).notNull(),
  filesModified: text('files_modified').array(),
  filesCreated: text('files_created').array(),
  
  // Results
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  processingTime: integer('processing_time'),
  
  // Context
  hadConversationHistory: boolean('had_conversation_history').default(false),
  hadProjectSummary: boolean('had_project_summary').default(false),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_ci_modifications_session_id').on(table.sessionId),
  projectIdIdx: index('idx_ci_modifications_project_id').on(table.projectId),
  createdAtIdx: index('idx_ci_modifications_created_at').on(table.createdAt),
  successIdx: index('idx_ci_modifications_success').on(table.success),
}));

// ============================================================================
// SESSION MANAGEMENT TABLES
// ============================================================================

export const projectSessions = pgTable('project_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  sessionId: text('session_id').notNull().unique(),
  isActive: boolean('is_active').default(true),
  lastActivity: timestamp('last_activity').defaultNow(),
  messageCount: integer('message_count').default(0),
  
  // Session metadata
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectDeployments = pgTable('project_deployments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  buildId: text('build_id').notNull(),
  deploymentUrl: text('deployment_url').notNull(),
  downloadUrl: text('download_url'),
  zipUrl: text('zip_url'),
  
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  buildTime: integer('build_time'),
  errorMessage: text('error_message'),
  
  // Deployment metadata
  framework: varchar('framework', { length: 50 }),
  nodeVersion: varchar('node_version', { length: 20 }),
  packageManager: varchar('package_manager', { length: 20 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  usage: many(userUsage),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  files: many(projectFiles),
  sessions: many(projectSessions),
  deployments: many(projectDeployments),
  messages: many(ciMessages),
  projectSummaries: many(projectSummaries),
  conversationStats: many(conversationStats),
  sessionModifications: many(sessionModifications),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
}));

export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id],
  }),
}));

export const projectSessionsRelations = relations(projectSessions, ({ one }) => ({
  project: one(projects, {
    fields: [projectSessions.projectId],
    references: [projects.id],
  }),
}));

export const projectDeploymentsRelations = relations(projectDeployments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDeployments.projectId],
    references: [projects.id],
  }),
}));

export const messageSummariesRelations = relations(messageSummaries, ({ one, many }) => ({
  project: one(projects, {
    fields: [messageSummaries.projectId],
    references: [projects.id],
  }),
  messages: many(ciMessages),
}));

export const ciMessagesRelations = relations(ciMessages, ({ one }) => ({
  project: one(projects, {
    fields: [ciMessages.projectId],
    references: [projects.id],
  }),
  projectSummary: one(projectSummaries, {
    fields: [ciMessages.projectSummaryId],
    references: [projectSummaries.id],
  }),
}));

export const projectSummariesRelations = relations(projectSummaries, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectSummaries.projectId],
    references: [projects.id],
  }),
  messages: many(ciMessages),
}));

export const sessionModificationsRelations = relations(sessionModifications, ({ one }) => ({
  project: one(projects, {
    fields: [sessionModifications.projectId],
    references: [projects.id],
  }),
  message: one(ciMessages, {
    fields: [sessionModifications.messageId],
    references: [ciMessages.id],
  }),
}));

export const conversationStatsRelations = relations(conversationStats, ({ one }) => ({
  project: one(projects, {
    fields: [conversationStats.projectId],
    references: [projects.id],
  }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type UserUsage = typeof userUsage.$inferSelect;
export type NewUserUsage = typeof userUsage.$inferInsert;
export type ProjectSession = typeof projectSessions.$inferSelect;
export type NewProjectSession = typeof projectSessions.$inferInsert;
export type ProjectDeployment = typeof projectDeployments.$inferSelect;
export type NewProjectDeployment = typeof projectDeployments.$inferInsert;

// Message types
export type CIMessage = typeof ciMessages.$inferSelect;
export type NewCIMessage = typeof ciMessages.$inferInsert;
export type MessageSummary = typeof messageSummaries.$inferSelect;
export type NewMessageSummary = typeof messageSummaries.$inferInsert;
export type ConversationStats = typeof conversationStats.$inferSelect;
export type NewConversationStats = typeof conversationStats.$inferInsert;
export type ProjectSummary = typeof projectSummaries.$inferSelect;
export type NewProjectSummary = typeof projectSummaries.$inferInsert;
export type SessionModification = typeof sessionModifications.$inferSelect;
export type NewSessionModification = typeof sessionModifications.$inferInsert;

// Additional interfaces
export interface ModificationDetails {
  file: string;
  range: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    originalCode: string;
  };
  modifiedCode: string;
}

export interface SessionContext {
  sessionId: string;
  projectId?: number;
  hasActiveConversation: boolean;
  messageCount: number;
  lastActivity: Date;
  summaryExists: boolean;
}