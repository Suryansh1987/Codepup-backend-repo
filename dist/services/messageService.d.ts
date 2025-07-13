import Anthropic from '@anthropic-ai/sdk';
interface CreateMessageRequest {
    content: string;
    messageType: 'user' | 'assistant' | 'system';
    userId?: number;
    sessionId?: string;
    metadata?: {
        fileModifications?: string[];
        modificationApproach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'FULL_FILE_GENERATION';
        modificationSuccess?: boolean;
        createdFiles?: string[];
        addedFiles?: string[];
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
        projectId?: number;
        [key: string]: any;
    };
    userData?: {
        clerkId?: string;
        email?: string;
        name?: string;
    };
}
interface MessageResponse {
    success: boolean;
    data?: {
        messageId: string;
        sessionId: string;
        userId: number;
        timestamp: string;
        metadata?: any;
    };
    error?: string;
    details?: string;
}
declare class MessageService {
    private messageDB;
    private redis;
    private sessionManager;
    constructor(databaseUrl: string, anthropic: Anthropic, redisUrl?: string);
    initialize(): Promise<void>;
    private resolveUserId;
    createMessage(request: CreateMessageRequest): Promise<MessageResponse>;
    getUserMessages(userId: number, limit?: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    getSessionMessages(sessionId: string): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    ensureUser(userId: number, userData?: {
        clerkId?: string;
        email?: string;
        name?: string;
    }): Promise<{
        success: boolean;
        data?: {
            userId: number;
            action: 'created' | 'existed';
        };
        error?: string;
    }>;
    getUserMessageStats(userId: number): Promise<{
        success: boolean;
        data?: {
            totalMessages: number;
            userMessages: number;
            assistantMessages: number;
            systemMessages: number;
            recentActivity: Date | null;
            modificationCount: number;
        };
        error?: string;
    }>;
    deleteUserMessages(userId: number, sessionId?: string): Promise<{
        success: boolean;
        data?: {
            deletedCount: number;
        };
        error?: string;
    }>;
    getUserConversationContext(userId: number, sessionId?: string): Promise<{
        success: boolean;
        data?: string;
        error?: string;
    }>;
    exportUserConversation(userId: number, format?: 'json' | 'csv'): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getServiceHealth(): Promise<{
        success: boolean;
        data?: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            database: boolean;
            redis: boolean;
            totalUsers: number;
            totalMessages: number;
            activeeSessions: number;
            uptime: string;
        };
        error?: string;
    }>;
    cleanupOldData(options?: {
        olderThanDays?: number;
        userId?: number;
        dryRun?: boolean;
    }): Promise<{
        success: boolean;
        data?: {
            messagesDeleted: number;
            sessionsCleared: number;
        };
        error?: string;
    }>;
}
export declare function createMessageService(databaseUrl: string, anthropic: Anthropic, redisUrl?: string): MessageService;
export default MessageService;
