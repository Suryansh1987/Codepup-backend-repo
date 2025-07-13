"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationStatsRelations = exports.sessionModificationsRelations = exports.projectSummariesRelations = exports.ciMessagesRelations = exports.messageSummariesRelations = exports.projectDeploymentsRelations = exports.projectSessionsRelations = exports.userUsageRelations = exports.projectFilesRelations = exports.projectsRelations = exports.usersRelations = exports.projectDeployments = exports.projectSessions = exports.sessionModifications = exports.projectSummaries = exports.conversationStats = exports.ciMessages = exports.messageSummaries = exports.userUsage = exports.projectFiles = exports.projects = exports.users = void 0;
// db/unified_schema.ts - Single unified schema to prevent duplicates
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// ============================================================================
// CORE TABLES (Users, Projects, etc.)
// ============================================================================
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    clerkId: (0, pg_core_1.varchar)('clerk_id', { length: 255 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    phoneNumber: (0, pg_core_1.varchar)('phone_number', { length: 20 }),
    profileImage: (0, pg_core_1.text)('profile_image'),
    plan: (0, pg_core_1.varchar)('plan', { length: 50 }).default('free').notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    lastLoginAt: (0, pg_core_1.timestamp)('last_login_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.projects = (0, pg_core_1.pgTable)('projects', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('pending').notNull(),
    projectType: (0, pg_core_1.varchar)('project_type', { length: 100 }).default('frontend'),
    generatedCode: (0, pg_core_1.jsonb)('generated_code'),
    deploymentUrl: (0, pg_core_1.text)('deployment_url'),
    downloadUrl: (0, pg_core_1.text)('download_url'),
    zipUrl: (0, pg_core_1.text)('zip_url'),
    buildId: (0, pg_core_1.text)('build_id'),
    githubUrl: (0, pg_core_1.text)('github_url'),
    aneonkey: (0, pg_core_1.varchar)('aneon_key').notNull(),
    supabaseurl: (0, pg_core_1.varchar)('supabase_url').notNull(),
    lastSessionId: (0, pg_core_1.text)('last_session_id'),
    conversationTitle: (0, pg_core_1.varchar)('conversation_title', { length: 255 }).default('Project Chat'),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at'),
    messageCount: (0, pg_core_1.integer)('message_count').default(0),
    // Project metadata
    framework: (0, pg_core_1.varchar)('framework', { length: 50 }).default('react'),
    template: (0, pg_core_1.varchar)('template', { length: 100 }).default('vite-react-ts'),
    isPublic: (0, pg_core_1.boolean)('is_public').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.projectFiles = (0, pg_core_1.pgTable)('project_files', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }).notNull(),
    fileName: (0, pg_core_1.varchar)('file_name', { length: 255 }).notNull(),
    filePath: (0, pg_core_1.text)('file_path').notNull(),
    fileContent: (0, pg_core_1.text)('file_content'),
    fileType: (0, pg_core_1.varchar)('file_type', { length: 50 }),
    fileSize: (0, pg_core_1.integer)('file_size'),
    lastModifiedAt: (0, pg_core_1.timestamp)('last_modified_at').defaultNow(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.userUsage = (0, pg_core_1.pgTable)('user_usage', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    month: (0, pg_core_1.varchar)('month', { length: 7 }).notNull(),
    tokensUsed: (0, pg_core_1.integer)('tokens_used').default(0).notNull(),
    projectsCreated: (0, pg_core_1.integer)('projects_created').default(0).notNull(),
    messagesCount: (0, pg_core_1.integer)('messages_count').default(0).notNull(),
    modificationsCount: (0, pg_core_1.integer)('modifications_count').default(0).notNull(),
    deploymentsCount: (0, pg_core_1.integer)('deployments_count').default(0).notNull(),
    tokenLimit: (0, pg_core_1.integer)('token_limit').default(100000).notNull(),
    projectLimit: (0, pg_core_1.integer)('project_limit').default(5).notNull(),
    isOverLimit: (0, pg_core_1.boolean)('is_over_limit').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// ============================================================================
// MESSAGING & CONVERSATION TABLES
// ============================================================================
exports.messageSummaries = (0, pg_core_1.pgTable)('ci_message_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }),
    summary: (0, pg_core_1.text)('summary').notNull(),
    messageCount: (0, pg_core_1.integer)('message_count').notNull(),
    startTime: (0, pg_core_1.timestamp)('start_time', { withTimezone: true }).notNull(),
    endTime: (0, pg_core_1.timestamp)('end_time', { withTimezone: true }).notNull(),
    keyTopics: (0, pg_core_1.text)('key_topics').array(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_summaries_created_at').on(table.createdAt),
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_summaries_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_summaries_project_id').on(table.projectId),
}));
exports.ciMessages = (0, pg_core_1.pgTable)('ci_messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }),
    content: (0, pg_core_1.text)('content').notNull(),
    messageType: (0, pg_core_1.varchar)('message_type', { length: 20 }).notNull().$type(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    // Metadata for file modifications
    fileModifications: (0, pg_core_1.text)('file_modifications').array(),
    modificationApproach: (0, pg_core_1.varchar)('modification_approach', { length: 30 }).$type(),
    modificationSuccess: (0, pg_core_1.boolean)('modification_success'),
    // Enhanced reasoning and context fields
    reasoning: (0, pg_core_1.text)('reasoning'),
    selectedFiles: (0, pg_core_1.text)('selected_files').array(),
    errorDetails: (0, pg_core_1.text)('error_details'),
    stepType: (0, pg_core_1.varchar)('step_type', { length: 50 }).$type(),
    // Modification details
    modificationRanges: (0, pg_core_1.text)('modification_ranges'),
    // Reference to project summary
    projectSummaryId: (0, pg_core_1.uuid)('project_summary_id').references(() => exports.projectSummaries.id),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_messages_created_at').on(table.createdAt.desc()),
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_messages_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_messages_project_id').on(table.projectId),
    stepTypeIdx: (0, pg_core_1.index)('idx_ci_messages_step_type').on(table.stepType),
    projectSummaryIdIdx: (0, pg_core_1.index)('idx_ci_messages_project_summary_id').on(table.projectSummaryId),
}));
exports.conversationStats = (0, pg_core_1.pgTable)('ci_conversation_stats', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull().unique(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }),
    totalMessageCount: (0, pg_core_1.integer)('total_message_count').default(0),
    summaryCount: (0, pg_core_1.integer)('summary_count').default(0),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at', { withTimezone: true }),
    lastModificationAt: (0, pg_core_1.timestamp)('last_modification_at', { withTimezone: true }),
    totalModifications: (0, pg_core_1.integer)('total_modifications').default(0),
    successfulModifications: (0, pg_core_1.integer)('successful_modifications').default(0),
    failedModifications: (0, pg_core_1.integer)('failed_modifications').default(0),
    // Session metadata
    startedAt: (0, pg_core_1.timestamp)('started_at', { withTimezone: true }).defaultNow(),
    lastActivity: (0, pg_core_1.timestamp)('last_activity', { withTimezone: true }).defaultNow(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_stats_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_stats_project_id').on(table.projectId),
    isActiveIdx: (0, pg_core_1.index)('idx_ci_stats_is_active').on(table.isActive),
}));
exports.projectSummaries = (0, pg_core_1.pgTable)('ci_project_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }),
    summary: (0, pg_core_1.text)('summary').notNull(),
    originalPrompt: (0, pg_core_1.text)('original_prompt').notNull(),
    // ZIP-based workflow fields
    zipUrl: (0, pg_core_1.text)('zip_url'),
    buildId: (0, pg_core_1.text)('build_id'),
    deploymentUrl: (0, pg_core_1.text)('deployment_url'),
    // Summary metadata
    fileCount: (0, pg_core_1.integer)('file_count').default(0),
    componentsCreated: (0, pg_core_1.text)('components_created').array(),
    pagesCreated: (0, pg_core_1.text)('pages_created').array(),
    technologiesUsed: (0, pg_core_1.text)('technologies_used').array(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at', { withTimezone: true }).defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_ci_project_summaries_created_at').on(table.createdAt),
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_project_summaries_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_project_summaries_project_id').on(table.projectId),
    isActiveIdx: (0, pg_core_1.index)('idx_ci_project_summaries_is_active').on(table.isActive),
    zipUrlIdx: (0, pg_core_1.index)('idx_ci_project_summaries_zip_url').on(table.zipUrl),
}));
exports.sessionModifications = (0, pg_core_1.pgTable)('ci_session_modifications', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sessionId: (0, pg_core_1.text)('session_id').notNull(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }),
    messageId: (0, pg_core_1.uuid)('message_id').references(() => exports.ciMessages.id),
    // Modification details
    modificationPrompt: (0, pg_core_1.text)('modification_prompt').notNull(),
    approach: (0, pg_core_1.varchar)('approach', { length: 30 }).notNull(),
    filesModified: (0, pg_core_1.text)('files_modified').array(),
    filesCreated: (0, pg_core_1.text)('files_created').array(),
    // Results
    success: (0, pg_core_1.boolean)('success').notNull(),
    errorMessage: (0, pg_core_1.text)('error_message'),
    processingTime: (0, pg_core_1.integer)('processing_time'),
    // Context
    hadConversationHistory: (0, pg_core_1.boolean)('had_conversation_history').default(false),
    hadProjectSummary: (0, pg_core_1.boolean)('had_project_summary').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    sessionIdIdx: (0, pg_core_1.index)('idx_ci_modifications_session_id').on(table.sessionId),
    projectIdIdx: (0, pg_core_1.index)('idx_ci_modifications_project_id').on(table.projectId),
    createdAtIdx: (0, pg_core_1.index)('idx_ci_modifications_created_at').on(table.createdAt),
    successIdx: (0, pg_core_1.index)('idx_ci_modifications_success').on(table.success),
}));
// ============================================================================
// SESSION MANAGEMENT TABLES
// ============================================================================
exports.projectSessions = (0, pg_core_1.pgTable)('project_sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }).notNull(),
    sessionId: (0, pg_core_1.text)('session_id').notNull().unique(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    lastActivity: (0, pg_core_1.timestamp)('last_activity').defaultNow(),
    messageCount: (0, pg_core_1.integer)('message_count').default(0),
    // Session metadata
    userAgent: (0, pg_core_1.text)('user_agent'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.projectDeployments = (0, pg_core_1.pgTable)('project_deployments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    projectId: (0, pg_core_1.integer)('project_id').references(() => exports.projects.id, { onDelete: 'cascade' }).notNull(),
    buildId: (0, pg_core_1.text)('build_id').notNull(),
    deploymentUrl: (0, pg_core_1.text)('deployment_url').notNull(),
    downloadUrl: (0, pg_core_1.text)('download_url'),
    zipUrl: (0, pg_core_1.text)('zip_url'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).default('pending').notNull(),
    buildTime: (0, pg_core_1.integer)('build_time'),
    errorMessage: (0, pg_core_1.text)('error_message'),
    // Deployment metadata
    framework: (0, pg_core_1.varchar)('framework', { length: 50 }),
    nodeVersion: (0, pg_core_1.varchar)('node_version', { length: 20 }),
    packageManager: (0, pg_core_1.varchar)('package_manager', { length: 20 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// ============================================================================
// RELATIONS
// ============================================================================
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    projects: many(exports.projects),
    usage: many(exports.userUsage),
}));
exports.projectsRelations = (0, drizzle_orm_1.relations)(exports.projects, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.projects.userId],
        references: [exports.users.id],
    }),
    files: many(exports.projectFiles),
    sessions: many(exports.projectSessions),
    deployments: many(exports.projectDeployments),
    messages: many(exports.ciMessages),
    projectSummaries: many(exports.projectSummaries),
    conversationStats: many(exports.conversationStats),
    sessionModifications: many(exports.sessionModifications),
}));
exports.projectFilesRelations = (0, drizzle_orm_1.relations)(exports.projectFiles, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.projectFiles.projectId],
        references: [exports.projects.id],
    }),
}));
exports.userUsageRelations = (0, drizzle_orm_1.relations)(exports.userUsage, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userUsage.userId],
        references: [exports.users.id],
    }),
}));
exports.projectSessionsRelations = (0, drizzle_orm_1.relations)(exports.projectSessions, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.projectSessions.projectId],
        references: [exports.projects.id],
    }),
}));
exports.projectDeploymentsRelations = (0, drizzle_orm_1.relations)(exports.projectDeployments, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.projectDeployments.projectId],
        references: [exports.projects.id],
    }),
}));
exports.messageSummariesRelations = (0, drizzle_orm_1.relations)(exports.messageSummaries, ({ one, many }) => ({
    project: one(exports.projects, {
        fields: [exports.messageSummaries.projectId],
        references: [exports.projects.id],
    }),
    messages: many(exports.ciMessages),
}));
exports.ciMessagesRelations = (0, drizzle_orm_1.relations)(exports.ciMessages, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.ciMessages.projectId],
        references: [exports.projects.id],
    }),
    projectSummary: one(exports.projectSummaries, {
        fields: [exports.ciMessages.projectSummaryId],
        references: [exports.projectSummaries.id],
    }),
}));
exports.projectSummariesRelations = (0, drizzle_orm_1.relations)(exports.projectSummaries, ({ one, many }) => ({
    project: one(exports.projects, {
        fields: [exports.projectSummaries.projectId],
        references: [exports.projects.id],
    }),
    messages: many(exports.ciMessages),
}));
exports.sessionModificationsRelations = (0, drizzle_orm_1.relations)(exports.sessionModifications, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.sessionModifications.projectId],
        references: [exports.projects.id],
    }),
    message: one(exports.ciMessages, {
        fields: [exports.sessionModifications.messageId],
        references: [exports.ciMessages.id],
    }),
}));
exports.conversationStatsRelations = (0, drizzle_orm_1.relations)(exports.conversationStats, ({ one }) => ({
    project: one(exports.projects, {
        fields: [exports.conversationStats.projectId],
        references: [exports.projects.id],
    }),
}));
//# sourceMappingURL=message_schema.js.map