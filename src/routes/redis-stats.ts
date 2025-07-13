// routes/redis.ts - Redis health and stats routes
import express, { Request, Response } from "express";
import { RedisService } from '../services/Redis';

const router = express.Router();

export function initializeRedisRoutes(redis: RedisService): express.Router {

  // Redis health check
  router.get("/health", async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await redis.getStats();
      const isConnected = await redis.isConnected();
      
      res.json({
        success: true,
        data: {
          connected: isConnected,
          stats: stats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get Redis health status',
        connected: false
      });
    }
  });

  // Redis stats and memory info
  router.get("/stats", async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await redis.getStats();
      
      res.json({
        success: true,
        data: {
          ...stats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get Redis stats'
      });
    }
  });

  // Check if Redis has project files for a session
  router.get("/session/:sessionId/files", async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const hasFiles = await redis.hasProjectFiles(sessionId);
      
      if (hasFiles) {
        const projectFiles = await redis.getProjectFiles(sessionId);
        const fileCount = projectFiles ? projectFiles.size : 0;
        
        res.json({
          success: true,
          data: {
            sessionId,
            hasFiles: true,
            fileCount,
            message: `Session ${sessionId} has ${fileCount} cached files`
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            sessionId,
            hasFiles: false,
            fileCount: 0,
            message: `No cached files found for session ${sessionId}`
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to check session files'
      });
    }
  });

  // Get modification changes for a session
  router.get("/session/:sessionId/modifications", async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const changes = await redis.getModificationChanges(sessionId);
      
      res.json({
        success: true,
        data: {
          sessionId,
          modificationCount: changes.length,
          modifications: changes,
          message: `Found ${changes.length} modifications for session ${sessionId}`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get session modifications'
      });
    }
  });

  // Clear session data
  router.delete("/session/:sessionId", async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      await redis.clearSession(sessionId);
      
      res.json({
        success: true,
        data: {
          sessionId,
          message: `Session ${sessionId} data cleared successfully`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to clear session data'
      });
    }
  });

  return router;
}