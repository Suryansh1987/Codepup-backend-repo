"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationMessagesRelations = exports.conversationsRelations = exports.projectsRelations = exports.usersRelations = exports.conversationMessages = exports.conversations = exports.projects = exports.users = void 0;
// db/simplified_schema.ts - Only 4 essential tables
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// ============================================================================
// CORE TABLES - ONLY 4 ESSENTIAL TABLES
// ============================================================================
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    clerkId: (0, pg_core_1.varchar)("clerk_id", { length: 255 }).notNull().unique(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    phoneNumber: (0, pg_core_1.varchar)("phone_number", { length: 20 }),
    profileImage: (0, pg_core_1.text)("profile_image"),
    plan: (0, pg_core_1.varchar)("plan", { length: 50 }).default("free").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    lastLoginAt: (0, pg_core_1.timestamp)("last_login_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
exports.projects = (0, pg_core_1.pgTable)("projects", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id")
        .references(() => exports.users.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("pending").notNull(),
    projectType: (0, pg_core_1.varchar)("project_type", { length: 100 }).default("frontend"),
    generatedCode: (0, pg_core_1.jsonb)("generated_code"),
    deploymentUrl: (0, pg_core_1.text)("deployment_url"),
    downloadUrl: (0, pg_core_1.text)("download_url"),
    zipUrl: (0, pg_core_1.text)("zip_url"),
    buildId: (0, pg_core_1.text)("build_id"),
    githubUrl: (0, pg_core_1.text)("github_url"),
    // Optional database credentials for full-stack projects
    aneonkey: (0, pg_core_1.varchar)("aneon_key"),
    supabaseurl: (0, pg_core_1.varchar)("supabase_url"),
    lastSessionId: (0, pg_core_1.text)("last_session_id"),
    conversationTitle: (0, pg_core_1.varchar)("conversation_title", { length: 255 }).default("Project Chat"),
    lastMessageAt: (0, pg_core_1.timestamp)("last_message_at"),
    messageCount: (0, pg_core_1.integer)("message_count").default(0),
    // Project metadata
    framework: (0, pg_core_1.varchar)("framework", { length: 50 }).default("react"),
    template: (0, pg_core_1.varchar)("template", { length: 100 }).default("vite-react-ts"),
    isPublic: (0, pg_core_1.boolean)("is_public").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
exports.conversations = (0, pg_core_1.pgTable)("conversations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    projectId: (0, pg_core_1.integer)("project_id")
        .references(() => exports.projects.id, {
        onDelete: "cascade",
    })
        .notNull()
        .unique(),
    userId: (0, pg_core_1.integer)("user_id")
        .references(() => exports.users.id, {
        onDelete: "cascade",
    })
        .notNull(),
    // Current conversation state
    currentStep: (0, pg_core_1.varchar)("current_step", { length: 50 }).default("analysis"),
    designChoices: (0, pg_core_1.jsonb)("design_choices"),
    generatedFiles: (0, pg_core_1.jsonb)("generated_files"),
    // Session information
    sessionId: (0, pg_core_1.text)("session_id"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    lastActivity: (0, pg_core_1.timestamp)("last_activity").defaultNow(),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
exports.conversationMessages = (0, pg_core_1.pgTable)("conversation_messages", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    conversationId: (0, pg_core_1.integer)("conversation_id")
        .references(() => exports.conversations.id, {
        onDelete: "cascade",
    })
        .notNull(),
    // Message content - keeping original structure for compatibility
    userMessage: (0, pg_core_1.text)("user_message"),
    agentResponse: (0, pg_core_1.text)("agent_response"),
    messageType: (0, pg_core_1.varchar)("message_type", { length: 20 })
        .notNull()
        .$type()
        .default("user"), // Add default to make it not strictly required
    // Optional metadata
    functionCalled: (0, pg_core_1.varchar)("function_called", { length: 100 }),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// ============================================================================
// RELATIONS
// ============================================================================
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    projects: many(exports.projects),
    conversations: many(exports.conversations),
}));
exports.projectsRelations = (0, drizzle_orm_1.relations)(exports.projects, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.projects.userId],
        references: [exports.users.id],
    }),
    conversation: one(exports.conversations, {
        fields: [exports.projects.id],
        references: [exports.conversations.projectId],
    }),
}));
exports.conversationsRelations = (0, drizzle_orm_1.relations)(exports.conversations, ({ one, many }) => ({
    project: one(exports.projects, {
        fields: [exports.conversations.projectId],
        references: [exports.projects.id],
    }),
    user: one(exports.users, {
        fields: [exports.conversations.userId],
        references: [exports.users.id],
    }),
    messages: many(exports.conversationMessages),
}));
exports.conversationMessagesRelations = (0, drizzle_orm_1.relations)(exports.conversationMessages, ({ one }) => ({
    conversation: one(exports.conversations, {
        fields: [exports.conversationMessages.conversationId],
        references: [exports.conversations.id],
    }),
}));
//# sourceMappingURL=message_schema.js.map