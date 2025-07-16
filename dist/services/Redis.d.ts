import { ProjectFile, ASTNode, ModificationChange } from './filemodifier/types';
type SafeModificationChange = ModificationChange;
export declare class RedisService {
    private redis;
    private readonly DEFAULT_TTL;
    private readonly PROJECT_FILES_TTL;
    private readonly SESSION_TTL;
    constructor(redisUrl?: string);
    /**
     * Store project files map for a session
     */
    setProjectFiles(sessionId: string, projectFiles: Map<string, ProjectFile>): Promise<void>;
    /**
     * Get project files map for a session - FIXED
     */
    getProjectFiles(sessionId: string): Promise<Map<string, ProjectFile> | null>;
    /**
     * Check if project files exist for session
     */
    hasProjectFiles(sessionId: string): Promise<boolean>;
    /**
     * Add or update a single project file - FIXED
     */
    updateProjectFile(sessionId: string, filePath: string, projectFile: ProjectFile): Promise<void>;
    setModificationChanges(sessionId: string, changes: ModificationChange[]): Promise<void>;
    /**
     * Get modification changes for a session - FIXED
     */
    getModificationChanges(sessionId: string): Promise<ModificationChange[]>;
    /**
     * Add a single modification change - FIXED TYPE COMPATIBILITY
     */
    addModificationChange(sessionId: string, change: SafeModificationChange): Promise<void>;
    /**
     * Set session start time
     */
    setSessionStartTime(sessionId: string, startTime: string): Promise<void>;
    /**
     * Get session start time
     */
    getSessionStartTime(sessionId: string): Promise<string>;
    setASTAnalysis(filePath: string, fileHash: string, astNodes: ASTNode[]): Promise<void>;
    getASTAnalysis(fileHash: string): Promise<{
        filePath: string;
        astNodes: ASTNode[];
    } | null>;
    setSessionState(sessionId: string, key: string, value: any): Promise<void>;
    /**
     * Get session state data
     */
    getSessionState<T>(sessionId: string, key: string): Promise<T | null>;
    /**
     * Delete session state data
     */
    deleteSessionState(sessionId: string, key: string): Promise<void>;
    /**
     * Clear all session data
     */
    clearSession(sessionId: string): Promise<void>;
    /**
     * Cache build results
     */
    setBuildCache(buildId: string, data: any): Promise<void>;
    /**
     * Get build results
     */
    getBuildCache(buildId: string): Promise<any>;
    /**
     * Generate file hash for caching
     */
    generateFileHash(content: string): string;
    /**
     * Extend TTL for a key
     */
    extendTTL(key: string, ttl?: number): Promise<void>;
    /**
     * Check if Redis is connected
     */
    isConnected(): Promise<boolean>;
    /**
     * Get memory usage stats - FIXED
     */
    getStats(): Promise<{
        memoryUsage: string | null;
        keyCount: number;
        connected: boolean;
        error?: string;
    }>;
    /**
     * Close Redis connection
     */
    disconnect(): Promise<void>;
}
export {};
