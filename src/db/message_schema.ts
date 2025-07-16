// db/simplified_schema.ts - Only 4 essential tables
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// CORE TABLES - ONLY 4 ESSENTIAL TABLES
// ============================================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  profileImage: text("profile_image"),
  plan: varchar("plan", { length: 50 }).default("free").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  projectType: varchar("project_type", { length: 100 }).default("frontend"),
  generatedCode: jsonb("generated_code"),
  deploymentUrl: text("deployment_url"),
  downloadUrl: text("download_url"),
  zipUrl: text("zip_url"),
  buildId: text("build_id"),
  githubUrl: text("github_url"),

  // Optional database credentials for full-stack projects
  aneonkey: varchar("aneon_key"),
  supabaseurl: varchar("supabase_url"),

  lastSessionId: text("last_session_id"),
  conversationTitle: varchar("conversation_title", { length: 255 }).default(
    "Project Chat"
  ),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),

  // Project metadata
  framework: varchar("framework", { length: 50 }).default("react"),
  template: varchar("template", { length: 100 }).default("vite-react-ts"),
  isPublic: boolean("is_public").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, {
      onDelete: "cascade",
    })
    .notNull()
    .unique(), 
  userId: integer("user_id")
    .references(() => users.id, {
      onDelete: "cascade",
    })
    .notNull(),

  // Current conversation state
  currentStep: varchar("current_step", { length: 50 }).default("analysis"),
  designChoices: jsonb("design_choices"),
  generatedFiles: jsonb("generated_files"),

  // Session information
  sessionId: text("session_id"),
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity").defaultNow(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .references(() => conversations.id, {
      onDelete: "cascade",
    })
    .notNull(),

  // Message content - keeping original structure for compatibility
  userMessage: text("user_message"),
  agentResponse: text("agent_response"),
  messageType: varchar("message_type", { length: 20 })
    .notNull()
    .$type<"user" | "assistant" | "system">()
    .default("user"), // Add default to make it not strictly required
  
  // Optional metadata
  functionCalled: varchar("function_called", { length: 100 }),
  metadata: jsonb("metadata"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  conversations: many(conversations),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [projects.id],
    references: [conversations.projectId],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(conversationMessages),
}));

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMessages.conversationId],
      references: [conversations.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;

// Additional interfaces for application logic
export interface SessionContext {
  sessionId: string;
  projectId?: number;
  hasActiveConversation: boolean;
  messageCount: number;
  lastActivity: Date;
}

export interface MessagePayload {
  content: string;
  messageType: "user" | "assistant" | "system";
  metadata?: any;
}