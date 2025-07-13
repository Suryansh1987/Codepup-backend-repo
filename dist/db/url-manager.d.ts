import { DrizzleMessageHistoryDB } from "../db/messagesummary";
export declare class EnhancedProjectUrlManager {
    private messageDB;
    constructor(messageDB: DrizzleMessageHistoryDB);
    /**
     * Main method to save or update project URLs with comprehensive identification and duplicate prevention
     */
    /**
     * Resolve user ID with proper fallback strategies
     */
    private resolveUserId;
    /**
     * Comprehensive duplicate checking with multiple criteria
     */
    private comprehensiveDuplicateCheck;
    /**
     * Check if project needs URL update
     */
    private needsUrlUpdate;
    /**
     * Find project for modification with comprehensive fallback strategies
     */
    private findProjectForModification;
    /**
     * Get project by ID with error handling
     */
    /**
     * Update existing project with new URLs and metadata
     */
    private updateExistingProject;
    /**
     * Create new project safely with comprehensive error handling and transaction-like behavior
     */
    /**
     * Emergency method to find recently created project
     */
    private findRecentlyCreatedProject;
    /**
     * Generate a smart project name from prompt
     */
    private generateProjectName;
    /**
     * Generate project description from prompt
     */
    private generateProjectDescription;
    /**
     * Public method to get project URLs by various identifiers
     */
    getProjectUrls(identifier: {
        projectId?: number;
        sessionId?: string;
        buildId?: string;
        userId?: number;
    }): Promise<{
        projectId: number;
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
        buildId: string;
        lastSessionId: string;
    } | null>;
    /**
     * Simple method for generation route (no complex duplicate checking needed for new projects)
     */
    saveNewProjectUrls(sessionId: string, projectId: number, urls: {
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
    }, userId: number, projectData: {
        name?: string;
        description?: string;
        framework?: string;
        template?: string;
    }): Promise<number>;
    getProjectById(projectId: number): Promise<any>;
    /**
     * Get user's project statistics
     */
    getUserProjectStats(userId: number): Promise<{
        totalProjects: number;
        activeProjects: number;
        totalDeployments: number;
        lastActivity: Date | null;
    }>;
    /**
     * Clean up old projects for a user (keep only latest N projects)
     */
    cleanupUserProjects(userId: number, keepLatest?: number): Promise<number>;
}
