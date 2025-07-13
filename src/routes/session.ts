// routes/session.ts - Session management routes
import express, { Request, Response } from "express";
import { RedisService } from '../services/Redis';

const router = express.Router();

// Lightweight stateless helper using existing Redis service
class StatelessSessionManager {
  constructor(private redis: RedisService) {}

  generateSessionId(userContext?: string): string {
    const crypto = require('crypto');
    const base = userContext || 'default-user';
    return crypto.createHash('sha256').update(base + Date.now()).digest('hex').substring(0, 16);
  }

  async saveSessionContext(sessionId: string, context: {
    buildId: string;
    tempBuildDir: string;
    projectSummary?: any;
    lastActivity: number;
  }): Promise<void> {
    await this.redis.setSessionState(sessionId, 'session_context', context);
  }

  async getSessionContext(sessionId: string): Promise<any> {
    return await this.redis.getSessionState(sessionId, 'session_context');
  }

  async updateSessionContext(sessionId: string, updates: any): Promise<void> {
    const current = await this.getSessionContext(sessionId);
    if (current) {
      const updated = { ...current, ...updates, lastActivity: Date.now() };
      await this.saveSessionContext(sessionId, updated);
    }
  }

  async cacheProjectFiles(sessionId: string, files: { [path: string]: string }): Promise<void> {
    const projectFilesMap = new Map();
    
    Object.entries(files).forEach(([filePath, content]) => {
      projectFilesMap.set(filePath, {
        path: filePath,
        content: content,
        hash: this.redis.generateFileHash(content),
        lastModified: Date.now(),
        astNodes: []
      });
    });

    await this.redis.setProjectFiles(sessionId, projectFilesMap);
  }

  async getCachedProjectFiles(sessionId: string): Promise<{ [path: string]: string }> {
    const projectFiles = await this.redis.getProjectFiles(sessionId);
    if (!projectFiles) return {};

    const files: { [path: string]: string } = {};
    projectFiles.forEach((file, path) => {
      files[path] = file.content;
    });
    return files;
  }

  async cleanup(sessionId: string): Promise<void> {
    await this.redis.clearSession(sessionId);
  }
}

// Initialize session manager - this will be passed from main app
let sessionManager: StatelessSessionManager;

export function initializeSessionRoutes(redis: RedisService): express.Router {
  sessionManager = new StatelessSessionManager(redis);

  // Get session status
  router.get("/status/:sessionId", async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      
      const sessionContext = await sessionManager.getSessionContext(sessionId);
      const cachedFiles = await sessionManager.getCachedProjectFiles(sessionId);
      const redisStats = await redis.getStats();
      
      if (sessionContext) {
        res.json({
          success: true,
          data: {
            sessionId: sessionId,
            hasProject: !!sessionContext.projectSummary,
            projectSummary: sessionContext.projectSummary,
            cachedFileCount: Object.keys(cachedFiles).length,
            lastActivity: sessionContext.lastActivity,
            sessionAge: Date.now() - sessionContext.lastActivity,
            buildId: sessionContext.buildId,
            status: 'active',
            redisConnected: redisStats.connected
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            sessionId: sessionId,
            hasProject: false,
            status: 'not_found',
            redisConnected: redisStats.connected
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get session status'
      });
    }
  });

  // Create new session
  router.post("/create", async (req: Request, res: Response): Promise<void> => {
    try {
      const { userContext } = req.body;
      const sessionId = sessionManager.generateSessionId(userContext);
      
      const initialContext = {
        buildId: '',
        tempBuildDir: '',
        lastActivity: Date.now()
      };
      
      await sessionManager.saveSessionContext(sessionId, initialContext);
      
      res.json({
        success: true,
        data: {
          sessionId: sessionId,
          message: 'Session created successfully'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create session'
      });
    }
  });

  // Delete session
  router.delete("/:sessionId", async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      await sessionManager.cleanup(sessionId);
      
      res.json({
        success: true,
        data: {
          message: `Session ${sessionId} cleaned up successfully`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup session'
      });
    }
  });

  return router;
}

// Export session manager for use in other routes
export { StatelessSessionManager };