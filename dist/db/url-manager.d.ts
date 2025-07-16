import { DrizzleMessageHistoryDB } from "../db/messagesummary";
export declare class EnhancedProjectUrlManager {
    private messageDB;
    constructor(messageDB: DrizzleMessageHistoryDB);
    getProjectUrls(identifier: {
        projectId?: number;
        userId?: number;
    }): Promise<{
        projectId: number;
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
        buildId: string;
        lastSessionId: string;
    } | null>;
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
    /**
     * Get user's project statistics
     */
    getUserProjectStats(userId: number): Promise<{
        totalProjects: number;
        activeProjects: number;
        totalDeployments: number;
        lastActivity: Date | null;
    }>;
    cleanupUserProjects(userId: number, keepLatest?: number): Promise<number>;
}
