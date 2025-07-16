// routes/session.ts - Session management routes
import express, { Request, Response } from "express";
import { RedisService } from '../services/Redis';

const router = express.Router();

export class StatelessSessionManager {
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