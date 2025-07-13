// services/redis.ts - FIXED VERSION WITH PROPER TYPE COMPATIBILITY
import Redis from 'ioredis';
import { ProjectFile, ASTNode, ModificationChange } from './filemodifier/types';

// FIXED: Ensure type compatibility for ModificationChange
type SafeModificationChange = ModificationChange;

export class RedisService {
  private redis: Redis;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly PROJECT_FILES_TTL = 7200; // 2 hours
  private readonly SESSION_TTL = 1800; // 30 minutes

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  // ==============================================================
  // PROJECT FILES CACHE METHODS - FIXED
  // ==============================================================

  /**
   * Store project files map for a session
   */
  async setProjectFiles(sessionId: string, projectFiles: Map<string, ProjectFile>): Promise<void> {
    const key = `project_files:${sessionId}`;
    
    // FIXED: Better serialization handling
    const serializedData: Record<string, any> = {};
    for (const [filePath, file] of projectFiles.entries()) {
      serializedData[filePath] = {
        ...file,
        // Ensure all required fields are present
        name: file.name || '',
        path: file.path || '',
        relativePath: file.relativePath || '',
        content: file.content || '',
        lines: file.lines || 0,
        size: file.size || 0,
        snippet: file.snippet || '',
        componentName: file.componentName || null,
        hasButtons: file.hasButtons || false,
        hasSignin: file.hasSignin || false,
        isMainFile: file.isMainFile || false
      };
    }
    
    const data = JSON.stringify(serializedData);
    await this.redis.setex(key, this.PROJECT_FILES_TTL, data);
  }

  /**
   * Get project files map for a session - FIXED
   */
  async getProjectFiles(sessionId: string): Promise<Map<string, ProjectFile> | null> {
    const key = `project_files:${sessionId}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      const projectFiles = new Map<string, ProjectFile>();
      
      //@ts-ignore
      for (const [filePath, fileData] of Object.entries(parsed)) {
        const file = fileData as any;
         //@ts-ignore
        const projectFile: ProjectFile = {
          name: file.name || '',
          path: file.path || '',
          relativePath: file.relativePath || '',
          content: file.content || '',
          lines: file.lines || 0,
          size: file.size || 0,
          snippet: file.snippet || '',
          componentName: file.componentName || null,
          hasButtons: Boolean(file.hasButtons),
          hasSignin: Boolean(file.hasSignin),
          isMainFile: Boolean(file.isMainFile)
        };
        projectFiles.set(filePath, projectFile);
      }
      
      return projectFiles;
    } catch (error) {
      console.error('Error parsing project files from Redis:', error);
      return null;
    }
  }

  /**
   * Check if project files exist for session
   */
  async hasProjectFiles(sessionId: string): Promise<boolean> {
    const key = `project_files:${sessionId}`;
    return (await this.redis.exists(key)) === 1;
  }

  /**
   * Add or update a single project file - FIXED
   */
  async updateProjectFile(sessionId: string, filePath: string, projectFile: ProjectFile): Promise<void> {
    const key = `project_files:${sessionId}`;
    const existingData = await this.redis.get(key);
    
    let projectFiles: Record<string, any> = {};
    if (existingData) {
      try {
        projectFiles = JSON.parse(existingData);
      } catch (error) {
        console.error('Error parsing existing project files:', error);
      }
    }
    
    // FIXED: Ensure proper serialization
    projectFiles[filePath] = {
      name: projectFile.name || '',
      path: projectFile.path || '',
      relativePath: projectFile.relativePath || '',
      content: projectFile.content || '',
      lines: projectFile.lines || 0,
      size: projectFile.size || 0,
      snippet: projectFile.snippet || '',
      componentName: projectFile.componentName || null,
      hasButtons: Boolean(projectFile.hasButtons),
      hasSignin: Boolean(projectFile.hasSignin),
      isMainFile: Boolean(projectFile.isMainFile)
    };
    
    await this.redis.setex(key, this.PROJECT_FILES_TTL, JSON.stringify(projectFiles));
  }

  
  async setModificationChanges(sessionId: string, changes: ModificationChange[]): Promise<void> {
    const key = `mod_changes:${sessionId}`;
    
    // FIXED: Ensure proper serialization of changes
    const serializedChanges = changes.map(change => ({
      type: change.type,
      file: change.file,
      description: change.description,
      timestamp: change.timestamp,
      approach: change.approach || undefined,
      success: change.success !== undefined ? Boolean(change.success) : undefined,
      details: change.details ? {
        linesChanged: change.details.linesChanged || undefined,
        componentsAffected: change.details.componentsAffected || undefined,
        reasoning: change.details.reasoning || undefined
      } : undefined
    }));
    
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(serializedChanges));
  }

  /**
   * Get modification changes for a session - FIXED
   */
  async getModificationChanges(sessionId: string): Promise<ModificationChange[]> {
    const key = `mod_changes:${sessionId}`;
    const data = await this.redis.get(key);
    
    if (!data) return [];
    
    try {
      const parsed = JSON.parse(data);
      
      // FIXED: Proper reconstruction of ModificationChange objects
      return parsed.map((change: any): ModificationChange => ({
        type: change.type,
        file: change.file,
        description: change.description,
        timestamp: change.timestamp,
        approach: change.approach || undefined,
        success: change.success !== undefined ? Boolean(change.success) : undefined,
        details: change.details ? {
          linesChanged: change.details.linesChanged || undefined,
          componentsAffected: change.details.componentsAffected || undefined,
          reasoning: change.details.reasoning || undefined
        } : undefined
      }));
    } catch (error) {
      console.error('Error parsing modification changes from Redis:', error);
      return [];
    }
  }

  /**
   * Add a single modification change - FIXED TYPE COMPATIBILITY
   */
  async addModificationChange(sessionId: string, change: SafeModificationChange): Promise<void> {
    const existing = await this.getModificationChanges(sessionId);
    existing.push(change);
    await this.setModificationChanges(sessionId, existing);
  }

  /**
   * Set session start time
   */
  async setSessionStartTime(sessionId: string, startTime: string): Promise<void> {
    const key = `session_start:${sessionId}`;
    await this.redis.setex(key, this.SESSION_TTL, startTime);
  }

  /**
   * Get session start time
   */
  async getSessionStartTime(sessionId: string): Promise<string> {
    const key = `session_start:${sessionId}`;
    const startTime = await this.redis.get(key);
    return startTime || new Date().toISOString();
  }


  async setASTAnalysis(filePath: string, fileHash: string, astNodes: ASTNode[]): Promise<void> {
    const key = `ast_analysis:${fileHash}`;
    const data = {
      filePath,
      astNodes,
      timestamp: Date.now()
    };
    await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(data));
  }

 
  async getASTAnalysis(fileHash: string): Promise<{ filePath: string; astNodes: ASTNode[] } | null> {
    const key = `ast_analysis:${fileHash}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      return {
        filePath: parsed.filePath,
        astNodes: parsed.astNodes
      };
    } catch (error) {
      console.error('Error parsing AST analysis from Redis:', error);
      return null;
    }
  }

 
  async setSessionState(sessionId: string, key: string, value: any): Promise<void> {
    const redisKey = `session:${sessionId}:${key}`;
    await this.redis.setex(redisKey, this.SESSION_TTL, JSON.stringify(value));
  }

  /**
   * Get session state data
   */
  async getSessionState<T>(sessionId: string, key: string): Promise<T | null> {
    const redisKey = `session:${sessionId}:${key}`;
    const data = await this.redis.get(redisKey);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error parsing session state ${key} from Redis:`, error);
      return null;
    }
  }

  /**
   * Delete session state data
   */
  async deleteSessionState(sessionId: string, key: string): Promise<void> {
    const redisKey = `session:${sessionId}:${key}`;
    await this.redis.del(redisKey);
  }

  /**
   * Clear all session data
   */
  async clearSession(sessionId: string): Promise<void> {
    const pattern = `*${sessionId}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ==============================================================
  // BUILD CACHE METHODS
  // ==============================================================

  /**
   * Cache build results
   */
  async setBuildCache(buildId: string, data: any): Promise<void> {
    const key = `build:${buildId}`;
    await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(data));
  }

  /**
   * Get build results
   */
  async getBuildCache(buildId: string): Promise<any> {
    const key = `build:${buildId}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing build cache from Redis:', error);
      return null;
    }
  }

  // ==============================================================
  // UTILITY METHODS
  // ==============================================================

  /**
   * Generate file hash for caching
   */
  generateFileHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Extend TTL for a key
   */
  async extendTTL(key: string, ttl: number = this.DEFAULT_TTL): Promise<void> {
    await this.redis.expire(key, ttl);
  }

  /**
   * Check if Redis is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get memory usage stats - FIXED
   */
  async getStats(): Promise<{
    memoryUsage: string | null;
    keyCount: number;
    connected: boolean;
    error?: string;
  }> {
    try {
      const info = await this.redis.call('info', 'memory') as string;
      const keyCount = await this.redis.dbsize();

      return {
        memoryUsage: info,
        keyCount,
        connected: true
      };
    } catch (error) {
      return {
        memoryUsage: null,
        keyCount: 0,
        connected: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}