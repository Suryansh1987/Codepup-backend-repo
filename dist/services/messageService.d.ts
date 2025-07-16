import Anthropic from '@anthropic-ai/sdk';
interface CreateMessageRequest {
    content: string;
    messageType: 'user' | 'assistant' | 'system';
    projectId: number;
    userId?: number;
    sessionId?: string;
    metadata?: {
        functionCalled?: string;
        success?: boolean;
        processingTimeMs?: number;
        tokenUsage?: any;
        [key: string]: any;
    };
}
interface MessageResponse {
    success: boolean;
    data?: {
        messageId: string;
        projectId: number;
        userId: number;
        timestamp: string;
    };
    error?: string;
}
declare class MessageService {
    private messageDB;
    private redis;
    private sessionManager;
    constructor(databaseUrl: string, anthropic: Anthropic, redisUrl?: string);
    initialize(): Promise<void>;
    createMessage(request: CreateMessageRequest): Promise<MessageResponse>;
    getProjectMessages(projectId: number, limit?: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    getSessionMessages(sessionId: string): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    getUserMessages(userId: number, limit?: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    getUserProjects(userId: number): Promise<{
        success: boolean;
        data?: any[];
        error?: string;
    }>;
    createProject(projectData: {
        userId: number;
        name: string;
        description: string;
        projectType?: string;
        framework?: string;
        template?: string;
        sessionId?: string;
    }): Promise<{
        success: boolean;
        data?: {
            projectId: number;
        };
        error?: string;
    }>;
    updateProject(projectId: number, updateData: {
        name?: string;
        description?: string;
        status?: string;
        deploymentUrl?: string;
        downloadUrl?: string;
        zipUrl?: string;
        buildId?: string;
        [key: string]: any;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    getProject(projectId: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getProjectConversation(projectId: number): Promise<{
        success: boolean;
        data?: any;
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
        };
        error?: string;
    }>;
    getServiceHealth(): Promise<{
        success: boolean;
        data?: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            database: boolean;
            uptime: string;
        };
        error?: string;
    }>;
    deleteProject(projectId: number): Promise<{
        success: boolean;
        error?: string;
    }>;
}
export declare function createMessageService(databaseUrl: string, anthropic: Anthropic, redisUrl?: string): MessageService;
export default MessageService;
