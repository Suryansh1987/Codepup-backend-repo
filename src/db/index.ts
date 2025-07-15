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
    ...schema,
  },
});

export { schema };
export default db;
