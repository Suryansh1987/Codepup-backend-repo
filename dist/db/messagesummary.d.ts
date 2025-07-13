import Anthropic from '@anthropic-ai/sdk';
import { type CIMessage as Message, type MessageSummary, type ConversationStats, type ProjectSummary } from './message_schema';
interface ModificationResult {
    success: boolean;
    selectedFiles?: string[];
    approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
    reasoning?: string;
    modifiedRanges?: Array<{
        file: string;
        range: {
            startLine: number;
            endLine: number;
            startColumn: number;
            endColumn: number;
            originalCode: string;
        };
        modifiedCode: string;
    }>;
    addedFiles?: string[];
    createdFiles?: Array<{
        path: string;
        content: string;
        type: 'component' | 'page' | 'utility';
    }>;
    modificationSummary?: string;
    error?: string;
}
interface ModificationRecord {
    prompt: string;
    result: ModificationResult;
    approach: string;
    filesModified: string[];
    filesCreated: string[];
    timestamp: string;
}
export declare class DrizzleMessageHistoryDB {
    private db;
    private anthropic;
    private defaultSessionId;
    constructor(databaseUrl: string, anthropic: Anthropic);
    getProject(projectId: number): Promise<any>;
    /**
     * Update project title and conversation metadata
     */
    updateProjectTitle(projectId: number, updateData: {
        conversationTitle?: string;
        updatedAt: Date;
    }): Promise<void>;
    getProjectSecretsById(projectId: number): Promise<{
        aneonkey: string;
        supabaseurl: string;
    }>;
    getProjectMessages(projectId: number, limit?: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    /**
     * Get messages for a specific user
     */
    getUserMessages(userId: number, limit?: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    /**
     * Get messages for a specific session
     */
    getSessionMessages(sessionId: string): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    /**
     * Delete messages for a specific project
     */
    deleteProjectMessages(projectId: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    /**
     * Get conversation context for a specific project
     */
    getProjectConversationContext(projectId: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    /**
     * Enhanced addMessage method to support project linking
     */
    addMessage(content: string, messageType: 'user' | 'assistant' | 'system', metadata?: {
        fileModifications?: string[];
        modificationApproach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'FULL_FILE_GENERATION' | null;
        modificationSuccess?: boolean;
        createdFiles?: string[];
        addedFiles?: string[];
        duration?: number;
        projectSummaryId?: string;
        promptType?: string;
        requestType?: string;
        relatedUserMessageId?: string;
        success?: boolean;
        processingTimeMs?: number;
        tokenUsage?: any;
        responseLength?: number;
        buildId?: string;
        previewUrl?: string;
        downloadUrl?: string;
        zipUrl?: string;
        sessionId?: string;
        userId?: number;
        projectId?: number;
    }): Promise<string>;
    validateUserExists(userId: number): Promise<boolean>;
    ensureUserExists(userId: number, userData?: {
        clerkId?: string;
        email?: string;
        name?: string;
    }): Promise<number>;
    getMostRecentUserId(): Promise<number | null>;
    getRecentProjects(limit?: number): Promise<any[]>;
    getUserProjects(userId: number): Promise<any[]>;
    getAllProjectsWithUrls(): Promise<any[]>;
    getProjectBySessionId(sessionId: string): Promise<any>;
    getProjectByBuildId(buildId: string): Promise<any>;
    updateProjectUrls(projectId: number, updateData: {
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
        buildId: string;
        status: string;
        lastSessionId: string;
        lastMessageAt: Date;
        updatedAt: Date;
    }): Promise<void>;
    createProject(projectData: {
        userId: number;
        name: string;
        description: string;
        status: string;
        projectType: string;
        deploymentUrl: string;
        downloadUrl: string;
        zipUrl: string;
        buildId: string;
        lastSessionId: string;
        framework: string;
        template: string;
        lastMessageAt: Date;
        messageCount: number;
        supabaseurl: string;
        aneonkey: string;
    }): Promise<number>;
    updateProject(projectId: number, updateData: {
        name?: string;
        description?: string;
        conversationTitle?: string;
        lastMessageAt?: Date;
        updatedAt?: Date;
        status?: string;
        buildId?: string;
        lastSessionId?: string;
        framework?: string;
        template?: string;
        deploymentUrl?: string;
        downloadUrl?: string;
        zipUrl?: string;
        supabaseurl?: string;
        aneonkey?: string;
        [key: string]: any;
    }): Promise<void>;
    getProjectWithHistory(projectId: number): Promise<any>;
    updateProjectStatus(projectId: number, status: string): Promise<void>;
    linkSessionToProject(sessionId: string, projectId: number): Promise<void>;
    incrementProjectMessageCount(sessionId: string): Promise<void>;
    saveProjectSummary(summary: string, prompt: string, zipUrl?: string, buildId?: string, userId?: number): Promise<string | null>;
    /**
     * Update existing project summary with new ZIP URL and buildId
     */
    updateProjectSummary(summaryId: string, zipUrl: string, buildId: string): Promise<boolean>;
    /**
     * Get the active project summary with ZIP URL and buildId
     */
    getActiveProjectSummary(): Promise<{
        id: string;
        summary: string;
        zipUrl?: string;
        buildId?: string;
    } | null>;
    /**
     * Get project summary for scope analysis
     */
    getProjectSummaryForScope(): Promise<string | null>;
    /**
     * Override the getEnhancedContext method to include project summary
     */
    getEnhancedContext(): Promise<string>;
    /**
     * Get all project summaries
     */
    getAllProjectSummaries(): Promise<ProjectSummary[]>;
    /**
     * Delete a project summary by ID
     */
    deleteProjectSummary(id: string): Promise<boolean>;
    initializeStats(): Promise<void>;
    /**
     * Save modification details for future context
     */
    saveModification(modification: ModificationRecord): Promise<void>;
    /**
     * Generate a comprehensive modification summary
     */
    private generateModificationSummary;
    /**
     * Get recent modifications for context
     */
    getRecentModifications(limit?: number): Promise<ModificationRecord[]>;
    private extractPromptFromSummary;
    private maintainRecentMessages;
    fixConversationStats(): Promise<void>;
    private updateGrowingSummary;
    private generateSummaryUpdate;
    getConversationContext(): Promise<string>;
    getRecentConversation(): Promise<{
        messages: Message[];
        summaryCount: number;
        totalMessages: number;
    }>;
    getCurrentSummary(): Promise<{
        summary: string;
        messageCount: number;
    } | null>;
    getConversationStats(): Promise<ConversationStats | null>;
    getAllSummaries(): Promise<MessageSummary[]>;
    clearAllData(): Promise<void>;
    getModificationStats(): Promise<{
        totalModifications: number;
        successfulModifications: number;
        failedModifications: number;
        mostModifiedFiles: Array<{
            file: string;
            count: number;
        }>;
        approachUsage: Record<string, number>;
    }>;
    /**
     * Initialize stats for a specific session (new method)
     */
    initializeSessionStats(sessionId: string, projectId?: number): Promise<void>;
    getProjectSessions(projectId: number): Promise<any[]>;
}
export {};
