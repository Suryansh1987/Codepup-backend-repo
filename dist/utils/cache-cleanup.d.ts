import { RedisService } from '../services/Redis';
export declare class CacheCleanupUtility {
    private redis;
    private reactBasePath;
    constructor(redis: RedisService, reactBasePath: string);
    /**
     * Comprehensive cache cleanup and sync with filesystem
     */
    cleanupAndSyncCache(sessionId: string): Promise<{
        totalCached: number;
        verified: number;
        removed: number;
        updated: number;
        issues: string[];
    }>;
    /**
     * Check and fix a single cached file
     */
    private checkAndFixFile;
    /**
     * Generate alternative paths to check for a file
     */
    private generateAlternativePaths;
    /**
     * Check if file exists
     */
    private fileExists;
    /**
     * Force rebuild cache from filesystem
     */
    rebuildCacheFromFilesystem(sessionId: string): Promise<void>;
    /**
     * Validate cache integrity
     */
    validateCacheIntegrity(sessionId: string): Promise<{
        isValid: boolean;
        totalFiles: number;
        missingFiles: number;
        issues: string[];
    }>;
    /**
     * Emergency cache reset
     */
    emergencyReset(sessionId: string): Promise<void>;
}
