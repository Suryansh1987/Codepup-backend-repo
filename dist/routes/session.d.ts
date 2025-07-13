import express from "express";
import { RedisService } from '../services/Redis';
declare class StatelessSessionManager {
    private redis;
    constructor(redis: RedisService);
    generateSessionId(userContext?: string): string;
    saveSessionContext(sessionId: string, context: {
        buildId: string;
        tempBuildDir: string;
        projectSummary?: any;
        lastActivity: number;
    }): Promise<void>;
    getSessionContext(sessionId: string): Promise<any>;
    updateSessionContext(sessionId: string, updates: any): Promise<void>;
    cacheProjectFiles(sessionId: string, files: {
        [path: string]: string;
    }): Promise<void>;
    getCachedProjectFiles(sessionId: string): Promise<{
        [path: string]: string;
    }>;
    cleanup(sessionId: string): Promise<void>;
}
export declare function initializeSessionRoutes(redis: RedisService): express.Router;
export { StatelessSessionManager };
