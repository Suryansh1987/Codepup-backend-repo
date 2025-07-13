import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./message_schema";
const db = drizzle(process.env.DATABASE_URL);




export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Project = typeof schema.projects.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;
export type ProjectFile = typeof schema.projectFiles.$inferSelect;
export type NewProjectFile = typeof schema.projectFiles.$inferInsert;
export type UserUsage = typeof schema.userUsage.$inferSelect;
export type NewUserUsage = typeof schema.userUsage.$inferInsert;