import Anthropic from "@anthropic-ai/sdk";
import { RedisService } from "./services/Redis";
import { TokenTracker } from "./utils/TokenTracer";
import "dotenv/config";
import axios from "axios";
import express, { Request, Response } from "express";
import path from "path";
import { DrizzleMessageHistoryDB } from "./db/messagesummary";
import cors from "cors";
import * as fs from "fs";

import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import messageRoutes, { setMessageDB } from "./routes/messages";
import {
  StatelessSessionManager,
} from "./routes/session";
import { initializeGenerationRoutes } from "./routes/generation";
import { initializeModificationRoutes } from "./routes/modification";
import {initializeAgentRoutes} from './routes/agents'

const PORT = process.env.PORT || 3000;
const anthropic = new Anthropic();
const app = express();
const redis = new RedisService();
const tokenTracker = new TokenTracker(true);

const DATABASE_URL = process.env.DATABASE_URL!;
const messageDB = new DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const sessionManager = new StatelessSessionManager(redis);

setMessageDB(messageDB);

// Basic middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  } else {
    next();
  }
});

// Initialize services
async function initializeServices() {
  try {
    const defaultSessionId = 'legacy-session-default';
    await messageDB.initializeSessionStats(defaultSessionId);
    
    const redisConnected = await redis.isConnected();
    console.log('✅ Services initialized successfully');
    console.log(`✅ Redis connected: ${redisConnected}`);
    
    if (!redisConnected) {
      console.warn('⚠️ Redis not connected - some features may be limited');
    }
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    console.log('🔄 Continuing without full initialization...');
  }
}

initializeServices();

// ESSENTIAL ENDPOINTS ONLY
// ========================

// Health check endpoint - used by frontend
app.get("/health", async (req: Request, res: Response) => {
  const redisConnected = await redis.isConnected();
  
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: "3.0.0-simplified",
    features: redisConnected ? [
      "Redis stateless sessions",
      "Session-based conversations",
      "Project integration"
    ] : [
      "Basic project support",
      "Message storage"
    ]
  });
});

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Backend is running - simplified version",
    timestamp: new Date().toISOString(),
    version: "3.0.0-simplified"
  });
});

// Main API routes - these are used by the frontend
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/messages", messageRoutes);


app.use("/api/generate", initializeGenerationRoutes(anthropic, messageDB, sessionManager));
app.use("/api/modify", initializeModificationRoutes(anthropic, messageDB, redis, sessionManager));
app.use("/api/design", initializeAgentRoutes(anthropic, messageDB, sessionManager));


// Cleanup function for temp directories
async function performCleanup(): Promise<void> {
  try {
    const tempBuildsDir = path.join(__dirname, "../temp-builds");
    
    if (!fs.existsSync(tempBuildsDir)) {
      return;
    }
    
    const entries = await fs.promises.readdir(tempBuildsDir, { withFileTypes: true });
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 100000);
    
    let cleanedCount = 0;
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(tempBuildsDir, entry.name);
        
        try {
          const stats = await fs.promises.stat(dirPath);
          
          if (stats.mtime.getTime() < oneHourAgo) {
            await fs.promises.rm(dirPath, { recursive: true, force: true });
            cleanedCount++;
          }
        } catch (statError) {
          console.warn(`⚠️ Could not stat directory ${entry.name}:`, statError);
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old temp directories`);
    }
    
  } catch (error) {
    console.warn('⚠️ Background cleanup job failed:', error);
  }
}

// Run cleanup every 30 minutes
const CLEANUP_INTERVAL = 30 * 60 * 1000;
setInterval(performCleanup, CLEANUP_INTERVAL);

// Optional manual cleanup endpoint
app.post("/api/cleanup/manual", async (req: Request, res: Response) => {
  try {
    await performCleanup();
    res.json({ 
      success: true, 
      message: 'Manual cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Manual cleanup failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧹 Cleanup system: 1 hour retention, check every 30 minutes`);
});