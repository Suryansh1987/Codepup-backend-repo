// db/index.ts - Updated to use unified schema
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Import the unified schema (SINGLE SOURCE OF TRUTH)
import * as schema from "./message_schema";

// Create connection
const sql = neon(process.env.DATABASE_URL!);

// Create database instance with unified schema
export const db = drizzle(sql, {
  schema: {
    ...schema
  }
});

// Export all types from unified schema
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Project = typeof schema.projects.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;
export type ProjectFile = typeof schema.projectFiles.$inferSelect;
export type NewProjectFile = typeof schema.projectFiles.$inferInsert;
export type UserUsage = typeof schema.userUsage.$inferSelect;
export type NewUserUsage = typeof schema.userUsage.$inferInsert;
export type ProjectSession = typeof schema.projectSessions.$inferSelect;
export type NewProjectSession = typeof schema.projectSessions.$inferInsert;
export type ProjectDeployment = typeof schema.projectDeployments.$inferSelect;
export type NewProjectDeployment = typeof schema.projectDeployments.$inferInsert;

// Message types
export type CIMessage = typeof schema.ciMessages.$inferSelect;
export type NewCIMessage = typeof schema.ciMessages.$inferInsert;
export type MessageSummary = typeof schema.messageSummaries.$inferSelect;
export type NewMessageSummary = typeof schema.messageSummaries.$inferInsert;
export type ConversationStats = typeof schema.conversationStats.$inferSelect;
export type NewConversationStats = typeof schema.conversationStats.$inferInsert;
export type ProjectSummary = typeof schema.projectSummaries.$inferSelect;
export type NewProjectSummary = typeof schema.projectSummaries.$inferInsert;
export type SessionModification = typeof schema.sessionModifications.$inferSelect;
export type NewSessionModification = typeof schema.sessionModifications.$inferInsert;

// Export schema for use in other files
export { schema };
export default db;